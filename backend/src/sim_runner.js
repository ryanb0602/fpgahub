const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const minioClient = require('./minio');
const Docker = require('dockerode');
const { PassThrough } = require('stream');
const tarStream = require('tar-stream');

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

const RUNS_DIR = process.env.SIM_RUNS_DIR || '/tmp/fpgahub_runs';
const SIM_IMAGE = process.env.SIM_IMAGE || 'fpga_simulator:latest';
const MAX_RUN_TIME_MS = parseInt(process.env.SIM_MAX_RUNTIME_MS || '300000'); // 5 minutes default

if (!fs.existsSync(RUNS_DIR)) {
	fs.mkdirSync(RUNS_DIR, { recursive: true });
}

// In-memory run registry
const runs = new Map();

function writeStreamToFile(stream, destPath) {
	return new Promise((resolve, reject) => {
		const ws = fs.createWriteStream(destPath);
		stream.pipe(ws);
		stream.on('end', () => ws.end());
		ws.on('finish', resolve);
		ws.on('error', reject);
		stream.on('error', reject);
	});
}

async function fetchFileToPath(storedName, destPath) {
	return new Promise((resolve, reject) => {
		const bucketName = 'data';
		minioClient.getObject(bucketName, storedName, (err, dataStream) => {
			if (err) return reject(err);
			writeStreamToFile(dataStream, destPath).then(resolve).catch(reject);
		});
	});
}

async function collectModuleFiles(commitHash, startModule) {
	// Gather modules by traversing edges table
	const toVisit = [startModule];
	const visited = new Set();
	while (toVisit.length > 0) {
		const m = toVisit.shift();
		if (visited.has(m)) continue;
		visited.add(m);
		try {
			const res = await pool.query('SELECT child_module FROM edges WHERE parent_module = $1', [m]);
			for (const r of res.rows) {
				if (!visited.has(r.child_module)) toVisit.push(r.child_module);
			}
		} catch (err) {
			console.error('Error querying edges for', m, err);
		}
	}

	// For each module find the file in the given commit
	const files = [];
	for (const moduleName of Array.from(visited)) {
		try {
			const res = await pool.query(
				`SELECT f.stored_name, f.filename FROM files f
				 JOIN commits c ON f.hash = ANY(c.hashes)
				 WHERE $1 = ANY(f.modules) AND c.commit_hash = $2 LIMIT 1`,
				[moduleName, commitHash]
			);
			if (res.rows.length > 0) {
				files.push({ module: moduleName, stored_name: res.rows[0].stored_name, filename: res.rows[0].filename });
			} else {
				console.warn(`Module ${moduleName} not found in commit ${commitHash}`);
			}
		} catch (err) {
			console.error('DB error looking up module file', moduleName, err);
		}
	}

	return files;
}

function parseEntityNameFromVHDL(content) {
	const m = content.match(/entity\s+([a-zA-Z0-9_]+)\s+is/i);
	if (m) return m[1];
	return null;
}

async function runContainerCommand(runId, runDir, innerCmd, onStdoutLine, onExit, durationMs) {
	// Read resource limits from environment (basic sane defaults)
	const memMb = parseInt(process.env.SIM_MEMORY_MB || '2048', 10); // MB (increased default to reduce OOMs)
	const cpus = parseFloat(process.env.SIM_CPUS || '0.5'); // CPU cores
	const memoryBytes = Math.max(32, memMb) * 1024 * 1024;
	const nanoCpus = Math.max(0.01, cpus) * 1e9; // dockerode expects NanoCPUs

	const hostConfig = {
		// Only set Memory if memMb > 0. Setting Memory=0 would cause Docker to reject the value.
		// If SIM_MEMORY_MB is 0, we omit the Memory key to allow the container to use host memory (use cautiously).
		...(memMb > 0 ? { Memory: memoryBytes } : {}),
		NanoCpus: Math.floor(nanoCpus),
		PidsLimit: parseInt(process.env.SIM_PIDS_LIMIT || '1024', 10),
	};

	// Create a short-lived container that sleeps; we'll upload files then exec the command
	const container = await docker.createContainer({
		Image: SIM_IMAGE,
		Cmd: ['bash', '-lc', 'tail -f /dev/null'],
		HostConfig: hostConfig,
		WorkingDir: '/work',
		Tty: false,
	});

	// Start the container
	await container.start();

	// Upload runDir contents into the container
	try {
		// ensure /work exists inside container
		const mkdirExec = await container.exec({ Cmd: ['bash', '-lc', 'mkdir -p /work && chmod 755 /work'], AttachStdout: true, AttachStderr: true });
		await new Promise((resolve, reject) => {
			mkdirExec.start((err, stream) => {
				if (err) return reject(err);
				container.modem.demuxStream(stream, process.stdout, process.stderr);
				mkdirExec.inspect((err2, data) => {
					if (err2) return reject(err2);
					if (typeof data.ExitCode === 'number' && data.ExitCode !== 0) return reject(new Error('mkdir exec failed: ' + data.ExitCode));
					resolve();
				});
			});
		});

		const { spawn } = require('child_process');
		const tarPath = path.join('/tmp', `run-${runId}.tar`);
		// create tar file
		await new Promise((resolve, reject) => {
			const tarCreate = spawn('tar', ['-C', runDir, '-cf', tarPath, '.']);
			tarCreate.on('error', reject);
			tarCreate.on('close', (code) => {
				if (code !== 0) return reject(new Error('tar create failed with ' + code));
				resolve();
			});
		});

		// stream tar into container
		await new Promise((resolve, reject) => {
			const rs = fs.createReadStream(tarPath);
			container.putArchive(rs, { path: '/work' }, (err) => {
				if (err) return reject(err);
				resolve();
			});
			rs.on('error', reject);
			rs.on('close', () => {
				try { fs.unlinkSync(tarPath); } catch (e) {}
			});
		});

		onStdoutLine('Uploaded run directory into container');
	} catch (e) {
		onStdoutLine('[ERR] Failed to upload run directory into container: ' + String(e));
		// proceed anyway
	}

	// Create an exec to run the ghdl process
	const execObj = await container.exec({
		Cmd: ['bash', '-lc', innerCmd],
		AttachStdout: true,
		AttachStderr: true,
	});

	const execStream = await new Promise((resolve, reject) => {
		execObj.start((err, stream) => {
			if (err) return reject(err);
			resolve(stream);
		});
	});

	// Demux and forward exec output
	const out = new PassThrough();
	const err = new PassThrough();
	container.modem.demuxStream(execStream, out, err);

	out.on('data', (chunk) => {
		const s = chunk.toString('utf-8');
		s.split(/\r?\n/).forEach(line => { if (line.length>0) onStdoutLine(line); });
	});
	err.on('data', (chunk) => {
		const s = chunk.toString('utf-8');
		s.split(/\r?\n/).forEach(line => { if (line.length>0) onStdoutLine('[ERR] ' + line); });
	});

	// Poll for exec completion
	const inspectExec = async () => {
		return new Promise((resolve, reject) => {
			execObj.inspect((err, data) => {
				if (err) return reject(err);
				resolve(data);
			});
		});
	};

	const start = Date.now();
	let done = false;
	while (!done) {
		const info = await inspectExec();
		if (typeof info.ExitCode === 'number') {
			done = true;
			// Inspect container state to see if OOM killed
			let oomKilled = false;
			try {
				const cinfo = await container.inspect();
				if (cinfo && cinfo.State && cinfo.State.OOMKilled) oomKilled = true;
				// annotate run record for downstream reporting
				try { const r = runs.get(runId); if (r) r.oomKilled = !!oomKilled; } catch (e) {}
			} catch (e) {
				console.warn('Failed to inspect container for OOM state', e);
			}
			// Try to copy waveform.vcd out of the container into runDir before exiting
			try {
				const archiveStream = await new Promise((resolve, reject) => {
					container.getArchive({ path: '/work/waveform.vcd' }, (err, stream) => {
						if (err) return reject(err);
						resolve(stream);
					});
				});

				await new Promise((resolve, reject) => {
					const extract = tarStream.extract();
					extract.on('entry', (header, stream, next) => {
						const outfile = path.join(runDir, path.basename(header.name));
						const ws = fs.createWriteStream(outfile);
						stream.pipe(ws);
						stream.on('end', next);
						stream.on('error', next);
					});
					extract.on('finish', resolve);
					extract.on('error', reject);
					archiveStream.pipe(extract);
				});

				// ensure file exists
				const wf = path.join(runDir, 'waveform.vcd');
				if (fs.existsSync(wf)) {
					onStdoutLine('Extracted waveform.vcd to host run dir');
				} else {
					onStdoutLine('[ERR] waveform.vcd not found after extraction');
				}
			} catch (e) {
				onStdoutLine('[ERR] Failed to extract waveform from container: ' + String(e));
			}

			// forward exit
			onExit(info.ExitCode, null);
			break;
		}
		if (Date.now() - start > durationMs + 10000) {
			try { await execObj.kill(); } catch (e) {}
			onExit(null, 'killed');
			break;
		}
		await new Promise((r) => setTimeout(r, 200));
	}

	try { container.remove({ force: true }); } catch (e) {}

	return container;
}

async function createRun({ commit, module, duration, unit }) {
	const runId = uuidv4();
	const runDir = path.join(RUNS_DIR, runId);
	fs.mkdirSync(runDir, { recursive: true });

	const run = {
		runId,
		commit,
		module,
		duration,
		unit,
		runDir,
		createdAt: Date.now(),
		stdoutLines: [],
		clients: [],
		finished: false,
		exitCode: null,
		waveformPath: null,
	};

	runs.set(runId, run);

	try {
		// Collect module files
		const moduleFiles = await collectModuleFiles(commit, module);

		// Fetch each file and write to workdir
		for (const f of moduleFiles) {
			const safeName = (f.module.replace(/[^a-zA-Z0-9_\.\-]/g, '_')) + '.vhd';
			const destPath = path.join(runDir, safeName);
			console.log(`Fetching ${f.stored_name} -> ${destPath}`);
			await fetchFileToPath(f.stored_name, destPath);
		}

		// Get testbench file id from commit_testbenches table
		const tbRes = await pool.query(
			"SELECT testbench_file_id FROM commit_testbenches WHERE commit_id = $1 AND module_name = $2 LIMIT 1",
			[commit, module]
		);
		if (tbRes.rows.length === 0) {
			throw new Error('No testbench configured for this module/commit');
		}
		const tbId = tbRes.rows[0].testbench_file_id;
		const tbDest = path.join(runDir, 'tb.vhd');
		console.log('Fetching testbench', tbId);
		await fetchFileToPath(tbId, tbDest);

		// Read testbench and detect top entity
		const tbContent = fs.readFileSync(tbDest, 'utf-8');
		const topEntity = parseEntityNameFromVHDL(tbContent) || 'tb';

		// Build stop time string (e.g. "100ns") — no space so GHDL parses it correctly
		const stopTimeStr = `${duration}${unit}`;

		// Compute requested_ns and wallclock timeout (ms)
		let requested_ns = 0;
		if (unit === 'ns') requested_ns = Number(duration) * 1;
		else if (unit === 'us') requested_ns = Number(duration) * 1e3;
		else if (unit === 'ms') requested_ns = Number(duration) * 1e6;
		else if (unit === 's') requested_ns = Number(duration) * 1e9;
		else requested_ns = Number(duration) * 1; // fallback assume ns

		const requested_seconds = requested_ns / 1e9;
		let wallTimeoutMs = Math.ceil(requested_seconds * 1000 * 10);
		if (!Number.isFinite(wallTimeoutMs) || wallTimeoutMs <= 0) wallTimeoutMs = 5000;
		wallTimeoutMs = Math.max(5000, wallTimeoutMs);
		wallTimeoutMs = Math.min(MAX_RUN_TIME_MS, wallTimeoutMs);

		console.log(`Run ${runId}: stopTime=${stopTimeStr}, requested_ns=${requested_ns}, wallTimeoutMs=${wallTimeoutMs}`);

		// Start container run
		const onStdoutLine = (line) => {
			run.stdoutLines.push(line);
			for (const res of run.clients) {
				try { res.write(`data: ${line.replace(/\n/g, '\\n')}\n\n`); } catch (e) {}
			}
		};

		const onExit = (code, signal) => {
			run.finished = true;
			run.exitCode = code;
			const waveform = path.join(runDir, 'waveform.vcd');
			if (fs.existsSync(waveform)) run.waveformPath = waveform;
			for (const res of run.clients) {
			try {
				const payload = { code, signal };
				const wfPath = path.join(run.runDir, 'waveform.vcd');
				if (fs.existsSync(wfPath)) {
					// include a base64 payload of the VCD so the frontend can receive it immediately
					try {
						const buf = fs.readFileSync(wfPath);
						payload.waveform_b64 = buf.toString('base64');
						payload.waveformName = 'waveform.vcd';
						// compute max time from VCD (#<num>) markers
						try {
							const txt = buf.toString('utf8');
							let max = null;
							const re = /#(\d+)/g;
							let m;
							while ((m = re.exec(txt)) !== null) {
								const v = parseInt(m[1], 10);
								if (Number.isFinite(v)) {
									if (max === null || v > max) max = v;
								}
							}
							if (max !== null) payload.waveform_end_time = max;
						} catch (e) {
							console.error('Failed to parse waveform times:', e);
						}
						// include requested end time converted to VCD numeric units (assume ns base)
						try {
							const unit = run.unit || 'ns';
							const dur = Number(run.duration) || 0;
							let factor = 1; // ns -> 1
							if (unit === 'us') factor = 1e3;
							else if (unit === 'ms') factor = 1e6;
							else if (unit === 's') factor = 1e9;
							const requested_numeric = dur * factor;
							payload.requested_end_time = requested_numeric;
						} catch (e) {
							console.error('Failed to compute requested_end_time', e);
						}
					} catch (e) {
						console.error('Failed to read waveform for embedding:', e);
					}
				}
				res.write(`event: done\ndata: ${JSON.stringify(payload)}\n\n`);
				res.end();
			} catch (e) {}
			}
			setTimeout(() => {
				runs.delete(runId);
				try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) {}
			}, 10 * 60 * 1000);
		};


		// Debug: list runDir contents on the host side before starting container
		try {
			const hostFiles = fs.readdirSync(runDir);
			console.log(`Run directory ${runDir} contains:`, hostFiles);
		} catch (e) {
			console.warn('Could not read runDir contents:', e);
		}

		// Build a robust inner command that lists files and runs ghdl with explicit filenames
		let vhdFilesList = [];
		try {
			vhdFilesList = fs.readdirSync(runDir).filter((f) => f.toLowerCase().endsWith('.vhd'));
			console.log('Host-detected VHD files for run:', vhdFilesList);
		} catch (e) {
			console.warn('Could not read runDir for vhd list:', e);
		}

		if (vhdFilesList.length === 0) {
			throw new Error('No VHD files available in run directory');
		}

		// Quote filenames to be safe
		const vhdFilesArg = vhdFilesList.map((f) => `"${f}"`).join(' ');

		const innerCmd = [
			'pwd',
			'ls -la',
			'echo "VHD files inside container:"',
			'ls -1 *.vhd || true',
			`ghdl -a ${vhdFilesArg} tb.vhd && ghdl -e ${topEntity} && ghdl -r ${topEntity} --vcd=waveform.vcd --stop-time=${stopTimeStr}`,
		].join(' && ');

		// Use the computed wallTimeoutMs as the kill timeout
		const durationMs = wallTimeoutMs;

		console.log(`Starting simulation run ${runId} with stopTime=${stopTimeStr} and cmd: ${innerCmd}`);
		onStdoutLine(`Starting simulation with stopTime=${stopTimeStr}, wallTimeoutMs=${durationMs}ms`);
		const container = await runContainerCommand(runId, runDir, innerCmd, onStdoutLine, onExit, durationMs);
		run.container = container;

		return runId;

	} catch (err) {
		runs.delete(runId);
		try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) {}
		throw err;
	}
}

function attachSSE(runId, res) {
	const run = runs.get(runId);
	if (!run) { res.status(404).end(); return; }

	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	});
	res.write('\n');

	for (const line of run.stdoutLines) res.write(`data: ${line.replace(/\n/g, '\\n')}\n\n`);

	if (run.finished) {
		res.write(`event: done\ndata: ${JSON.stringify({code: run.exitCode})}\n\n`);
		res.end();
		return;
	}

	run.clients.push(res);

	res.on('close', () => {
		run.clients = run.clients.filter(r => r !== res);
	});
}

function getWaveformPath(runId) {
	const run = runs.get(runId);
	if (!run) return null;
	if (run.waveformPath && fs.existsSync(run.waveformPath)) return run.waveformPath;
	const candidate = path.join(run.runDir, 'waveform.vcd');
	if (fs.existsSync(candidate)) return candidate;
	return null;
}

module.exports = { createRun, attachSSE, getWaveformPath, runs };
