const pool = require("./db");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const minioClient = require("./minio");

const STAGING_DIR = "/tmp";

function fnv1a64FromBytes(bytes) {
	let h = BigInt("0xcbf29ce484222325"); // offset basis
	const prime = BigInt("0x100000001b3");

	for (let i = 0; i < bytes.length; i++) {
		h ^= BigInt(bytes[i]); // use the byte directly
		h = (h * prime) & BigInt("0xFFFFFFFFFFFFFFFF"); // force 64-bit overflow
	}

	// Return 16-char hex (8 bytes)
	return h.toString(16).padStart(16, "0");
}

class tracked_file {
	constructor(filename, last_change, hash) {
		this.filename = filename;
		this.last_change = last_change;
		this.hash = hash;
		this.modules = [];
		this.recieved = false;
	}
}

class transaction {
	constructor(id) {
		this.id = id;
		this.status = "pending"; //pending, commit, modules, finishing, ok
		this.last_time_update = Date.now();
		this.files = [];
		this.edges = [];
	}
}

function parseBlob(blob) {
	// Convert byte blob to UTF-8 string
	try {
		const text = new TextDecoder().decode(blob);

		// Split the text into parts
		const parts = text.split(":::");

		// Each file entry has 3 fields: filename, last_change, hash
		const files = [];
		for (let i = 0; i < parts.length - 1; i += 3) {
			const [filename, last_change, hash] = parts.slice(i, i + 3);
			if (filename && last_change && hash) {
				files.push(new tracked_file(filename, last_change, hash));
			}
		}

		return files;
	} catch (error) {
		throw new Error("Failed to parse blob: " + error.message);
	}
}

class transaction_handler {
	constructor() {
		this.transactions = new Map();
	}

	createTransaction(blob) {
		try {
			const hash = fnv1a64FromBytes(blob);
			const tx = new transaction(hash);
			tx.files = parseBlob(blob);
			this.transactions.set(hash, tx);
			tx.status = "commit";
			return hash;
		} catch (error) {
			throw error;
		}
	}

	moduleProcessing(txid, blob) {
		const tx = this.transactions.get(txid);
		if (!tx) {
			throw new Error("Transaction not found");
		}
		if (tx.status !== "commit") {
			throw new Error("Transaction not in commit state");
		}

		try {
			const text = new TextDecoder().decode(blob);
			const temp_split = text.split("&&&");
			const file_module_map = temp_split[0];
			const module_links = temp_split[1];

			// Process file_module_map
			// Format :::filehash:::modulename:::modulename::::::filehash
			// Split by ::::::
			const fileModules = file_module_map.split("::::::");

			fileModules[0] = fileModules[0].replace(":::", ""); // Remove leading :::
			fileModules[fileModules.length - 1] = fileModules[
				fileModules.length - 1
			].slice(0, -3); // Remove trailing :::

			for (const f_m of fileModules) {
				const [filehash, ...modules] = f_m.split(":::");
				const file = tx.files.find((f) => f.hash === filehash);
				if (file) {
					file.modules.push(...modules);
				}
			}

			// Process module_links
			// Format :::modulename:::link:::link::::::modulename:::link::::::modulename...
			// Split by ::::::
			const moduleLinks = module_links.split("::::::");
			moduleLinks[0] = moduleLinks[0].replace(":::", ""); // Remove leading :::
			moduleLinks[moduleLinks.length - 1] = moduleLinks[
				moduleLinks.length - 1
			].slice(0, -3);

			for (const m_l of moduleLinks) {
				const [modulename, ...links] = m_l.split(":::");
				tx.edges.push([modulename, links]);
			}
		} catch (error) {
			throw new Error("Failed to process modules: " + error.message);
		}
	}

	async findNeededFiles(id) {
		const tx = this.transactions.get(id);
		if (!tx) {
			throw new Error("Transaction not found");
		}

		let neededFiles = [];

		for (const file of tx.files) {
			const query = await pool.query(
				"SELECT COUNT(*) AS count FROM files WHERE hash = $1",
				[file.hash],
			);
			if (+query.rows[0].count === 0) {
				neededFiles.push(file.filename);
			}
		}

		tx.status = "modules";

		tx.neededFiles = neededFiles;

		return neededFiles;
	}

	async fileTransfer(id, number, sum, filename, req) {
		const tx = this.transactions.get(id);
		if (!tx) {
			throw new Error("Transaction not found");
		}

		const file_stored_name = uuidv4();
		const save_path = path.join(STAGING_DIR, file_stored_name);

		await new Promise((resolve, reject) => {
			const stream = fs.createWriteStream(save_path);
			req.pipe(stream);

			stream.on("finish", resolve);
			stream.on("error", reject);
		});

		// Now the file finished writing

		const file = tx.files.find((f) => f.filename === filename);
		if (!file) {
			throw new Error("File not found in transaction");
		}

		file.recieved = true;
		file.stored_name = file_stored_name;

		// check if all files received
		if (number == sum) {
			const files = tx.files.filter(
				(f) => !f.recieved && tx.neededFiles.includes(f.filename),
			);
			if (files.length === 0) {
				tx.status = "finishing";
				return true;
			}
		}

		return false;
	}

	async finalizeTransaction(id, uuid) {
		const tx = this.transactions.get(id);

		if (!tx) {
			throw new Error("Transaction not found");
		}

		if (tx.status !== "finishing") {
			throw new Error("Transaction not in finishing state");
		}

		await (async () => {
			const bucket = "data";
			const exists = await minioClient.bucketExists(bucket).catch(() => false);
			if (!exists) await minioClient.makeBucket(bucket);
		})();

		for (const file of tx.files) {
			await minioClient.fPutObject(
				"data",
				file.stored_name,
				path.join(STAGING_DIR, file.stored_name),
			);

			await pool.query(
				"INSERT INTO files (hash, filename, stored_name, last_change, modules) VALUES ($1, $2, $3, $4, $5)",
				[
					file.hash,
					file.filename,
					file.stored_name,
					file.last_change,
					file.modules,
				],
			);
		}

		for (const [parent, children] of tx.edges) {
			for (const child of children) {
				//this doesn't support the parent and child module hashes yet
				//im not 100% sure how to manage that yet, can cause issues if a child is changed seperate from its parent, i dont know if i want to bind edge links to versions basically

				await pool.query(
					"INSERT INTO edges (parent_module, child_module) VALUES ($1, $2)",
					[parent, child],
				);
			}
		}

		await pool.query(
			"INSERT INTO commits (commit_hash, commit_by, message, hashes) VALUES ($1, $2, $3, $4)",
			[tx.id, uuid, "placeholder", tx.files.map((f) => f.hash)],
		);
		tx.status = "ok";
	}
}

module.exports = transaction_handler;
