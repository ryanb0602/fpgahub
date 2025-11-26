const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const pool = require("./db");
router.use(express.json());

router.post("/register", async (req, res) => {
	const { email, password, firstname, lastname } = req.body;

	if (!email || !password || !firstname || !lastname) {
		return res.status(400).json({ message: "All fields are required." });
	}

	// Email regex: simple, safe, max length 320 chars
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

	// Password regex: at least one lowercase, one uppercase, one number, one special char, 8-128 chars
	const passwordRegex =
		/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,128}$/;

	if (!emailRegex.test(email)) {
		return res.status(400).json({ message: "Invalid email format." });
	}
	if (!passwordRegex.test(password)) {
		return res.status(400).json({
			message:
				"Password does not meet complexity requirements. Need one lowercase, one uppercase, one number, one special char, and atleast 8 characters.",
		});
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
		});
	} catch (err) {
		console.log(err);
	}
});

router.post("/login", async (req, res) => {
	const { email, password } = req.body;
	let uuid = null;

	try {
		const result = await pool.query("SELECT * FROM users WHERE email = $1", [
			email,
		]);
		const users = result.rows;

		if (users.length < 1 || users.length > 1) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		const user = users[0];

		if (user.password === "") {
			return res
				.status(401)
				.json({ message: "User account has yet to be activated" });
		}

		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		uuid = user.uuid;
	} catch (err) {
		console.log(err);
	}

	req.session.userId = uuid;
	res.json({ message: "Logged in successfully" });
});

router.post("/cli-token", async (req, res) => {
	const { email, password } = req.body;
	let uuid = null;

	try {
		const result = await pool.query("SELECT * FROM users WHERE email = $1", [
			email,
		]);
		const users = result.rows;

		if (users.length < 1 || users.length > 1) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		const user = users[0];

		if (user.password === "") {
			return res
				.status(401)
				.json({ message: "User account has yet to be activated" });
		}

		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		uuid = user.uuid;
	} catch (err) {
		console.log(err);
	}

	const cli_token = crypto.randomBytes(64).toString("hex");
	const hashedToken = await bcrypt.hash(cli_token, 10);

	try {
		await pool.query("UPDATE users SET cli_token = $1 WHERE uuid = $2", [
			hashedToken,
			uuid,
		]);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ message: "Internal server error" });
	}

	const final_token = `${uuid}:::${cli_token}`;

	res.json({ message: "Issued token successfully", token: final_token });
});

router.get("/me", (req, res) => {
	if (req.session.userId) {
		return res.json({ loggedIn: true, userId: req.session.userId });
	} else {
		return res.json({ loggedIn: false });
	}
});

module.exports = router;
