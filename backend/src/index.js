const express = require("express");
const http = require("http");
const app = express();
const port = 5000;

const cors = require("cors");

const session = require("express-session");
const MemoryStore = require("memorystore")(session);

const authRouter = require("./authroutes.js");
const protectRoute = require("./middleware.js");
const fileTracking = require("./filetracking.js");
const frontendAPI = require("./frontend_services.js");
const runRoutes = require("./run_routes.js");
const { setupYjsWebSocketServer } = require("./yjs-server.js");

// Create shared session store
const sessionStore = new MemoryStore({
	checkPeriod: 1000 * 60 * 60,
});

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
		store: sessionStore,
	}),
);

app.use("/auth", authRouter);

app.use("/ft", fileTracking);

// Public run endpoints (SSE and waveform) - no auth so EventSource works cross-origin
app.use("/run", runRoutes);

// Serve wavedrom script proxy to avoid CDN MIME/CORS issues
const fetch = require('node-fetch');
app.get('/wavedrom.min.js', async (req, res) => {
	const cdns = [
		'https://unpkg.com/wavedrom@2.0.0/dist/wavedrom.min.js',
		'https://cdn.jsdelivr.net/npm/wavedrom@2.0.0/dist/wavedrom.min.js',
		'https://wavedrom.com/wavedrom.min.js',
	];
	for (const url of cdns) {
		try {
			const r = await fetch(url, { timeout: 10000 });
			if (!r.ok) throw new Error('bad status ' + r.status);
			const text = await r.text();
			res.set('Content-Type', 'application/javascript; charset=utf-8');
			res.set('Cache-Control', 'public, max-age=86400');
			return res.send(text);
		} catch (e) {
			console.warn('wavedrom proxy failed for', url, e.message ? e.message : e);
			continue;
		}
	}
	res.status(502).send('Failed to fetch WaveDrom');
});

app.use("/api", protectRoute, frontendAPI);

// Create HTTP server and setup WebSocket for Yjs
const server = http.createServer(app);
setupYjsWebSocketServer(server, sessionStore);

server.listen(port, () => {
	console.log(`Server listening on port ${port} with WebSocket support`);
});
