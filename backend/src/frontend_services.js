const express = require("express");
const router = express.Router();

const pool = require("./db");
router.use(express.json());

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

module.exports = router;
