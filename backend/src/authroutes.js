const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const pool = require("./db");
router.use(express.json());

router.post("/register", async (req, res) => {
	const { email, password, firstname, lastname } = req.body;

	if (!email || !password || !firstname || !lastname) {
		return res.status(400).json({ message: "All fields are required." });
	}

	try {
		const result = await pool.query("SELECT * FROM users WHERE email = $1", [
			email,
		]);
		const users = result.rows;

		if (users.length > 0) {
			return res.status(409).json({ message: "Email already registered." });
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const result2 = await pool.query(
			"INSERT INTO users (email, password, firstName, lastName)\
            VALUES ($1, $2, $3, $4)",
			[email, hashedPassword, firstname, lastname],
		);

		const resulttest = await pool.query("SELECT * FROM users");

		res.status(201).json({
			message: "User registered successfully.",
			user: resulttest.rows[0],
		});
	} catch (err) {
		console.log(err);
	}
});

module.exports = router;
