const express = require("express");
const router = express.Router();

const pool = require("./db");
router.use(express.json());

const minioClient = require("./minio");

router.get("/commits", async (req, res) => {
	const id = req.query.id;

	try {
		const commits = await pool.query(
			`SELECT DISTINCT c.*
        FROM commits c
        JOIN files f
        ON f.hash = ANY(c.hashes)
        WHERE $1 = ANY(f.modules);`,
			[id],
		);

		res.json(commits.rows);
	} catch (err) {
		console.log(err);
	}
});

router.get("/mymodules", async (req, res) => {
	const userUUID = req.uuid;
	console.log(userUUID);
	try {
		const modules = await pool.query(
			`SELECT DISTINCT unnest(f.modules) AS module
			 FROM commits c
			 JOIN files f
			   ON f.hash = ANY(c.hashes)
			 WHERE c.commit_by = $1`,
			[userUUID],
		);

		res.json(modules.rows.map((r) => r.module));
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/module", async (req, res) => {
	const { name, commit } = req.query;
	console.log(name, commit);

	if (!name || !commit) {
		return res.status(400).json({ error: "Missing name or commit parameters" });
	}

	try {
		const file = await pool.query(
			`SELECT f.stored_name
                            FROM files f
                            JOIN commits c ON f.hash = ANY(c.hashes)
                            WHERE $1 = ANY(f.modules)
                            AND c.commit_hash = $2`,
			[name, commit],
		);

		if (file.rows.length === 0) {
			return res.status(404).json({ error: "File not found in DB" });
		}

		const objectName = file.rows[0].stored_name;
		const bucketName = "data";

		minioClient.getObject(bucketName, objectName, (err, dataStream) => {
			if (err) {
				console.error("MinIO Error:", err);
				return res.status(404).json({ error: "File not found in storage" });
			}

			dataStream.pipe(res);
		});
	} catch (err) {
		console.error("Server Error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/search", async (req, res) => {
	const { q } = req.query;

	if (!q || q.trim().length === 0) {
		return res.json([]);
	}

	const query = q.trim();

	try {
		const result = await pool.query(
			`SELECT DISTINCT module
			 FROM (SELECT unnest(modules) AS module FROM files) t
			 WHERE module ILIKE '%' || $1 || '%'
			 ORDER BY
			   CASE WHEN LOWER(module) = LOWER($1) THEN 3
			        WHEN module ILIKE $1 || '%' THEN 2
			        ELSE 1 END DESC,
			   module ASC
			 LIMIT 20`,
			[query],
		);

		res.json(result.rows.map((r) => r.module));
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

module.exports = router;
