const express = require("express");
const app = express();
const port = 3000;

const session = require("express-session");
const MemoryStore = require("memorystore")(session);

const authRouter = require("./authroutes.js");
const protectRoute = require("./middleware.js");
const fileTracking = require("./filetracking.js");

app.use(
	session({
		secret: "fake_key", // choose a strong random key in production
		resave: true,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			secure: false, // set to true if using HTTPS
			sameSite: "lax", // or 'strict' for tighter security
			maxAge: 1000 * 60 * 60 * 24, // 1 day
		},
		store: new MemoryStore({
			checkPeriod: 1000 * 60 * 60, // prune expired entries every hour
		}),
	}),
);

app.use("/auth", authRouter);

app.use("/ft", fileTracking);

app.get("/", protectRoute, (req, res) => {
	res.send("Hello World!");
});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
