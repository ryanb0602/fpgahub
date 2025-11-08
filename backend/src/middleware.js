const pool = require("./db");
const bcrypt = require("bcrypt");

async function cli_token_check(token) {
	const [uuid, token_value] = token.split(":::");

	try {
		const user = await pool.query(
			"SELECT cli_token FROM users WHERE uuid = $1",
			[uuid],
		);

		if (user.rows.length > 0) {
			const match = await bcrypt.compare(token_value, user.rows[0].cli_token);
			return { ok: match, uuid };
		}
	} catch (err) {
		console.error("Error authenticating token:", err);
	}

	return { ok: false, uuid: null };
}

async function auth_session(req) {
	if (req.session && req.session.userId) {
		return { ok: true, uuid: req.session.userId };
	}
	return { ok: false, uuid: null };
}

async function protectRoute(req, res, next) {
	let result;

	const token = req.headers["x-fpgahub-cli-auth-token"];
	if (token) {
		result = await cli_token_check(token);
	} else {
		result = await auth_session(req);
	}

	if (result.ok) {
		req.uuid = result.uuid;
		return next();
	}

	return res.status(401).json({ error: "Unauthorized" });
}

module.exports = protectRoute;
