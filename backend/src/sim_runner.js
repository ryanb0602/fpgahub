const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pool = require('./db');
const minioClient = require('./minio');

const RUNS_DIR = process.env.SIM_RUNS_DIR || '/tmp/fpgahub_runs';
const SIM_IMAGE = process.env.SIM_IMAGE || 'ghdl/ghdl:latest';
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

function startDockerSimulation(runId, workDir, topEntity, stopTimeStr, onStdoutLine, onExit) {
	// Build the command to run inside the container
	// We will run a bash -c "ghdl -a *.vhd tb.vhd && ghdl -e <entity> && ghdl -r <entity> --vcd=waveform.vcd --stop-time=<stopTime>"
	const innerCmd = `ghdl -a *.vhd tb.vhd && ghdl -e ${topEntity} && ghdl -r ${topEntity} --vcd=waveform.vcd --stop-time=${stopTimeStr}`;

	const dockerArgs = [
		'run', '--rm',
		'-v', `${workDir}:/work:ro`, // mount read-only to be safe
		'-w', '/work',
		SIM_IMAGE,
		'bash', '-lc', innerCmd
	];

	console.log('Starting docker with args', dockerArgs.join(' '));
	const proc = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

	let stdoutBuf = '';
	proc.stdout.on('data', (chunk) => {
		const s = chunk.toString('utf-8');
		stdoutBuf += s;
		// emit lines
		s.split(/\r?\n/).forEach(line => {
			if (line.length > 0) onStdoutLine(line);
		});
	});
	proc.stderr.on('data', (chunk) => {
		const s = chunk.toString('utf-8');
		stdoutBuf += s;
		s.split(/\r?\n/).forEach(line => {
			if (line.length > 0) onStdoutLine('[ERR] ' + line);
		});
	});

	proc.on('close', (code, signal) => {
		onExit(code, signal);
	});

	return proc;
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

		// Build stop time string
		const stopTimeStr = `${duration}${unit}`;

		// Start docker run
		const onStdoutLine = (line) => {
			run.stdoutLines.push(line);
			// notify clients
			for (const res of run.clients) {
				try {
					res.write(`data: ${line.replace(/\\n/g, '\\n')}\n\n`);
				} catch (e) {
					// ignore
				}
			}
		};

		const onExit = (code, signal) => {
			run.finished = true;
			run.exitCode = code;
			// waveform path expected
			const waveform = path.join(runDir, 'waveform.vcd');
			if (fs.existsSync(waveform)) {
				run.waveformPath = waveform;
			}
			// notify clients
			for (const res of run.clients) {
				try {
					res.write(`event: done\ndata: ${JSON.stringify({code, signal})}\n\n`);
					res.end();
				} catch (e) {}
			}
			// schedule cleanup in 10 minutes
			setTimeout(() => {
				runs.delete(runId);
				try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) {}
			}, 10 * 60 * 1000);
		};

		// For safety mount read-only — we already wrote files into runDir; ghdl will try to write waveform.vcd which will fail if mount is read-only.
		// So we need to mount read-write. We'll mount as read-write but isolate to this directory.
		// Adjust startDockerSimulation to mount rw

		// Replace startDockerSimulation to mount read-write
		const innerCmd = `ghdl -a *.vhd tb.vhd && ghdl -e ${topEntity} && ghdl -r ${topEntity} --vcd=waveform.vcd --stop-time=${stopTimeStr}`;
		const dockerArgs = [
			'run', '--rm',
			'-v', `${runDir}:/work`,
			'-w', '/work',
			SIM_IMAGE,
			'bash', '-lc', innerCmd
		];

		const proc = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

		let stdoutBuf = '';
		proc.stdout.on('data', (chunk) => {
			const s = chunk.toString('utf-8');
			stdoutBuf += s;
			s.split(/\r?\n/).forEach(line => { if (line.length>0) onStdoutLine(line); });
		});
		proc.stderr.on('data', (chunk) => {
			const s = chunk.toString('utf-8');
			stdoutBuf += s;
			s.split(/\r?\n/).forEach(line => { if (line.length>0) onStdoutLine('[ERR] ' + line); });
		});

		// enforce a wallclock timeout for safety
		const runtimeLimit = Math.min(MAX_RUN_TIME_MS, Math.max(10000, duration * (unit === 's' ? 1000 : unit === 'ms' ? 1 : unit === 'ns' ? 0.000001 : 1000)) + 10000);
		const killTimer = setTimeout(() => {
			try { proc.kill('SIGKILL'); } catch (e) {}
			onExit(null, 'killed');
		}, runtimeLimit);

		proc.on('close', (code, signal) => {
			clearTimeout(killTimer);
			onExit(code, signal);
		});

		run.proc = proc;

		return runId;

	} catch (err) {
		runs.delete(runId);
		try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) {}
		throw err;
	}
}

function attachSSE(runId, res) {
	const run = runs.get(runId);
	if (!run) {
		res.status(404).end();
		return;
	}

	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	});
	res.write('\n');

	// send backlog
	for (const line of run.stdoutLines) {
		res.write(`data: ${line.replace(/\\n/g, '\\n')}\n\n`);
	}

	if (run.finished) {
		res.write(`event: done\ndata: ${JSON.stringify({code: run.exitCode})}\n\n`);
		res.end();
		return;
	}

	run.clients.push(res);

	reqOnClose(res, () => {
		// remove client
		run.clients = run.clients.filter(r => r !== res);
	});
}

function reqOnClose(res, cb) {
	res.on('close', cb);
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
