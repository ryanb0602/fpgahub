const pool = require("./db");
const bcrypt = require("bcrypt");

async function cli_token_check(token) {
	try {
		const uuid = token.split(":::")[0];
		const token_value = token.split(":::")[1];
		const user = await pool.query(
			"SELECT cli_token FROM users WHERE uuid = $1",
			[uuid],
		);
		if (user.rows.length > 0) {
			return await bcrypt.compare(token_value, user.rows[0].cli_token);
		}
	} catch (err) {
		console.error("Error in middleware authenticating token:", err);
		return false;
	}
}

async function auth_session(req) {
	try {
		if (!req.session || !req.session.userId) {
			return false;
		}
	} catch (err) {
		console.error("Error in middleware authenticating session:", err);
		return false;
	}
}

async function protectRoute(req, res, next) {
	const token = req.headers["x-fpgahub-cli-auth-token"];

	let pass = false;
	if (token) {
		pass = await cli_token_check(token);
	} else {
		pass = await auth_session(req);
	}

	if (pass) {
		next();
	} else {
		res.status(401).json({ error: "Unauthorized" });
	}
}

module.exports = protectRoute;
