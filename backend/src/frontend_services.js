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

module.exports = router;
