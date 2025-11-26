const express = require("express");
const app = express();
const port = 5000;

const cors = require("cors");

const session = require("express-session");
const MemoryStore = require("memorystore")(session);

const authRouter = require("./authroutes.js");
const protectRoute = require("./middleware.js");
const fileTracking = require("./filetracking.js");

app.use(
	cors({
		origin: "http://localhost:3000",
		credentials: true,
	}),
);

app.use(
	session({
		secret: "fake_key",
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			secure: false,
			sameSite: "lax",
			maxAge: 1000 * 60 * 60 * 24,
		},
		store: new MemoryStore({
			checkPeriod: 1000 * 60 * 60,
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
