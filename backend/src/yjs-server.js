const Y = require("yjs");
const { WebSocketServer } = require("ws");
const syncProtocol = require("y-protocols/sync");
const awarenessProtocol = require("y-protocols/awareness");
const encoding = require("lib0/encoding");
const decoding = require("lib0/decoding");
const http = require("http");
const url = require("url");
const cookie = require("cookie");
const pool = require("./db");
const minioClient = require("./minio");
const { Readable } = require("stream");

// Store for Yjs documents
const docs = new Map();

// Track which documents need to be saved
const pendingSaves = new Map();
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

const messageSync = 0;
const messageAwareness = 1;

/**
 * Load testbench content from MinIO
 */
async function loadTestbenchFromMinio(testbenchFileId) {
	return new Promise((resolve, reject) => {
		const bucketName = "data";
		
		minioClient.getObject(bucketName, testbenchFileId, (err, dataStream) => {
			if (err) {
				console.error("MinIO Error loading testbench:", err);
				return reject(err);
			}

			let content = "";
			dataStream.on("data", (chunk) => {
				content += chunk.toString("utf-8");
			});
			dataStream.on("end", () => {
				resolve(content);
			});
			dataStream.on("error", reject);
		});
	});
}

/**
 * Save Yjs document content back to MinIO
 */
async function saveTestbenchToMinio(testbenchFileId, content) {
	return new Promise((resolve, reject) => {
		const bucketName = "data";
		const buffer = Buffer.from(content, "utf-8");
		const stream = Readable.from([buffer]);

		minioClient.putObject(bucketName, testbenchFileId, stream, buffer.length, (err, etag) => {
			if (err) {
				console.error("MinIO Error saving testbench:", err);
				return reject(err);
			}
			console.log(`Saved testbench ${testbenchFileId} to MinIO`);
			resolve(etag);
		});
	});
}

/**
 * Mark a document for auto-save
 */
function scheduleSave(docName, testbenchFileId) {
	if (!pendingSaves.has(docName)) {
		pendingSaves.set(docName, {
			testbenchFileId,
			timeout: setTimeout(async () => {
				await performSave(docName);
			}, AUTOSAVE_INTERVAL),
		});
	} else {
		// Reset the timer
		const existing = pendingSaves.get(docName);
		clearTimeout(existing.timeout);
		existing.timeout = setTimeout(async () => {
			await performSave(docName);
		}, AUTOSAVE_INTERVAL);
	}
}

/**
 * Actually perform the save operation
 */
async function performSave(docName) {
	const doc = docs.get(docName);
	const saveInfo = pendingSaves.get(docName);
	
	if (!doc || !saveInfo) {
		return;
	}

	try {
		const yText = doc.getText("codemirror");
		const content = yText.toString();
		
		await saveTestbenchToMinio(saveInfo.testbenchFileId, content);
		console.log(`Auto-saved document: ${docName}`);
		
		pendingSaves.delete(docName);
	} catch (err) {
		console.error(`Error auto-saving document ${docName}:`, err);
		// Reschedule on error
		scheduleSave(docName, saveInfo.testbenchFileId);
	}
}

/**
 * Initialize a Yjs document with content from MinIO
 */
async function initializeDocument(docName, testbenchFileId) {
	try {
		const content = await loadTestbenchFromMinio(testbenchFileId);
		const doc = docs.get(docName);
		
		if (doc) {
			const yText = doc.getText("codemirror");
			// Only set initial content if the document is empty
			if (yText.length === 0) {
				doc.transact(() => {
					yText.insert(0, content);
				});
				console.log(`Initialized document ${docName} from MinIO`);
			}
		}
	} catch (err) {
		console.error(`Error initializing document ${docName}:`, err);
	}
}

/**
 * Get or create a Yjs document
 */
function getYDoc(docName) {
	if (!docs.has(docName)) {
		const doc = new Y.Doc();
		docs.set(docName, doc);
	}
	return docs.get(docName);
}

/**
 * Send a message to a WebSocket client
 */
function send(conn, message) {
	if (conn.readyState !== 1) {
		return;
	}
	conn.send(message, (err) => {
		if (err) {
			console.error("Error sending message:", err);
		}
	});
}

/**
 * Handle incoming messages from clients
 */
function messageHandler(conn, doc, message) {
	const encoder = encoding.createEncoder();
	const decoder = decoding.createDecoder(message);
	const messageType = decoding.readVarUint(decoder);

	switch (messageType) {
		case messageSync:
			encoding.writeVarUint(encoder, messageSync);
			syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
			if (encoding.length(encoder) > 1) {
				send(conn, encoding.toUint8Array(encoder));
			}
			break;
		case messageAwareness:
			awarenessProtocol.applyAwarenessUpdate(
				conn.awareness,
				decoding.readVarUint8Array(decoder),
				conn
			);
			break;
	}
}

/**
 * Setup connection with Yjs document
 */
function setupWSConnection(conn, doc, awareness) {
	conn.awareness = awareness;

	// Send sync step 1
	const encoder = encoding.createEncoder();
	encoding.writeVarUint(encoder, messageSync);
	syncProtocol.writeSyncStep1(encoder, doc);
	send(conn, encoding.toUint8Array(encoder));

	// Send awareness states
	const awarenessStates = awareness.getStates();
	if (awarenessStates.size > 0) {
		const encoder2 = encoding.createEncoder();
		encoding.writeVarUint(encoder2, messageAwareness);
		encoding.writeVarUint8Array(
			encoder2,
			awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
		);
		send(conn, encoding.toUint8Array(encoder2));
	}

	// Listen for updates from this connection
	const updateHandler = (update, origin) => {
		if (origin !== conn) {
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, messageSync);
			syncProtocol.writeUpdate(encoder, update);
			send(conn, encoding.toUint8Array(encoder));
		}
	};
	doc.on("update", updateHandler);

	// Listen for awareness changes
	const awarenessChangeHandler = ({ added, updated, removed }, origin) => {
		const changedClients = added.concat(updated).concat(removed);
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageAwareness);
		encoding.writeVarUint8Array(
			encoder,
			awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
		);
		send(conn, encoding.toUint8Array(encoder));
	};
	awareness.on("update", awarenessChangeHandler);

	// Handle messages from client
	conn.on("message", (message) => {
		messageHandler(conn, doc, new Uint8Array(message));
	});

	// Cleanup on close
	conn.on("close", () => {
		doc.off("update", updateHandler);
		awareness.off("update", awarenessChangeHandler);
		awarenessProtocol.removeAwarenessStates(awareness, [conn.clientID], null);
	});

	// Assign a client ID
	conn.clientID = Math.floor(Math.random() * 1000000000);
}

/**
 * Setup WebSocket server with authentication
 */
function setupYjsWebSocketServer(server, sessionStore) {
	const wss = new WebSocketServer({ noServer: true });

	// Store awareness instances per document
	const awarenessMap = new Map();

	// Handle WebSocket upgrade with authentication
	server.on("upgrade", (request, socket, head) => {
		const pathname = url.parse(request.url).pathname;
		
		if (pathname === "/yjs") {
			// Parse cookies and check session
			const cookies = cookie.parse(request.headers.cookie || "");
			const sessionId = cookies["connect.sid"];

			console.log("WebSocket upgrade attempt:");
			console.log("  - Cookie header:", request.headers.cookie);
			console.log("  - Parsed sessionId:", sessionId);

			if (!sessionId) {
				console.log("  - Rejected: No session cookie");
				socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
				socket.destroy();
				return;
			}

			// Decode session ID (remove 's:' prefix and signature)
			const realSessionId = sessionId.startsWith("s:")
				? sessionId.slice(2).split(".")[0]
				: sessionId;

			console.log("  - Real session ID:", realSessionId);

			// Check if session exists
			sessionStore.get(realSessionId, (err, session) => {
				if (err) {
					console.log("  - Rejected: Session store error:", err);
					socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
					socket.destroy();
					return;
				}

				if (!session) {
					console.log("  - Rejected: Session not found in store");
					socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
					socket.destroy();
					return;
				}

				if (!session.userId) {
					console.log("  - Rejected: Session has no userId");
					socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
					socket.destroy();
					return;
				}

				console.log("  - Accepted: userId =", session.userId);

				// Session is valid, upgrade the connection
				wss.handleUpgrade(request, socket, head, (ws) => {
					wss.emit("connection", ws, request, session.userId);
				});
			});
		}
	});

	wss.on("connection", async (conn, req, userId) => {
		console.log("WebSocket connection established");
		console.log("  - Full URL:", req.url);
		
		const params = new URLSearchParams(url.parse(req.url).query);
		const commit = params.get("commit");
		let module = params.get("module");

		// Trim trailing slash if present (sometimes added by y-websocket client)
		if (module && module.endsWith("/")) {
			module = module.slice(0, -1);
		}

		console.log("  - Parsed params:");
		console.log("    - commit:", commit);
		console.log("    - module:", module);
		console.log("    - module length:", module?.length);

		if (!commit || !module) {
			console.error("Missing commit or module parameter");
			conn.close();
			return;
		}

		try {
			// Look up testbench file ID from database
			const result = await pool.query(
				"SELECT testbench_file_id FROM commit_testbenches WHERE commit_id = $1 AND module_name = $2",
				[commit, module],
			);

			if (result.rows.length === 0) {
				console.error(`No testbench found for commit=${commit}, module=${module}`);
				conn.close();
				return;
			}

			const testbenchFileId = result.rows[0].testbench_file_id;
			const docName = `${commit}::${module}`;

			console.log(`User ${userId} connecting to document: ${docName}`);

			// Get or create the Yjs document
			const doc = getYDoc(docName);

			// Get or create awareness for this document
			if (!awarenessMap.has(docName)) {
				awarenessMap.set(docName, new awarenessProtocol.Awareness(doc));
			}
			const awareness = awarenessMap.get(docName);

			// Initialize document if it doesn't have content yet
			const yText = doc.getText("codemirror");
			if (yText.length === 0) {
				await initializeDocument(docName, testbenchFileId);
			}

			// Setup the WebSocket connection for this document
			setupWSConnection(conn, doc, awareness);

			// Listen for document updates to schedule auto-save
			const updateHandler = (update, origin) => {
				// Only schedule save for remote updates (not from initial load)
				if (origin !== null) {
					scheduleSave(docName, testbenchFileId);
				}
			};
			doc.on("update", updateHandler);

			// Clean up when connection closes
			conn.on("close", () => {
				console.log(`User ${userId} disconnected from document: ${docName}`);
				
				// Check if there are still active connections
				// Note: We need to check awareness state since we don't track connections directly
				setTimeout(() => {
					const states = awareness.getStates();
					if (states.size === 0) {
						doc.off("update", updateHandler);
						
						// Perform final save if there are pending changes
						if (pendingSaves.has(docName)) {
							performSave(docName);
						}
						
						// Optional: Clean up document after some time of inactivity
						// setTimeout(() => {
						//   if (awareness.getStates().size === 0) {
						//     docs.delete(docName);
						//     awarenessMap.delete(docName);
						//   }
						// }, 60000); // 1 minute
					}
				}, 1000);
			});
		} catch (err) {
			console.error("Error setting up WebSocket connection:", err);
			conn.close();
		}
	});

	return wss;
}

module.exports = { setupYjsWebSocketServer };
