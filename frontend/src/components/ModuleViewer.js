import React, { useState, useEffect, useRef } from "react";
import { Section, Heading, Card, Button, Text, Badge } from "@radix-ui/themes";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import { basicSetup } from "codemirror";
import { monokai } from "@uiw/codemirror-theme-monokai";
import { PlayIcon } from "@radix-ui/react-icons";
import CodeMirror from "@uiw/react-codemirror";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { yCollab } from "y-codemirror.next";

const API_BASE = process.env.REACT_APP_API_BASE;
const WS_BASE = process.env.REACT_APP_WS_BASE || "ws://localhost:5000";

export const ModuleViewer = ({ name, commit }) => {
	const [moduleTextVal, setModuleTextVal] = useState("");
	const [connectionStatus, setConnectionStatus] = useState("disconnected");
	const [simOutput, setSimOutput] = useState("");
	const [currentRunId, setCurrentRunId] = useState(null);
	const testbenchEditorRef = useRef(null);
	const testbenchViewRef = useRef(null);
	const yjsProviderRef = useRef(null);
	const yjsDocRef = useRef(null);

	const fetchModuleText = async () => {
		try {
			const res = await fetch(
				`${API_BASE}/api/module?name=${name}&commit=${commit}`,
				{
					credentials: "include",
				},
			);

			if (!res.ok) {
				throw new Error(`Server responded with ${res.status}`);
			}

			const data = await res.text();
			setModuleTextVal(data);
		} catch (error) {
			console.error("Error fetching module text:", error);
		}
	};

	useEffect(() => {
		fetchModuleText();
	}, [name, commit]);

	// Setup Yjs collaborative editor for testbench
	useEffect(() => {
		if (!name || !commit || !testbenchEditorRef.current) {
			return;
		}

		console.log("Setting up Yjs connection:");
		console.log("  - name:", name);
		console.log("  - commit:", commit);

		// Create Yjs document
		const ydoc = new Y.Doc();
		yjsDocRef.current = ydoc;
		const yText = ydoc.getText("codemirror");

		// Connect to WebSocket provider with authentication (cookies auto-sent)
		const wsUrl = `${WS_BASE}/yjs?commit=${encodeURIComponent(commit)}&module=${encodeURIComponent(name)}`;
		console.log("  - WebSocket URL:", wsUrl);
		
		const provider = new WebsocketProvider(wsUrl, "", ydoc, {
			// WebSocket will use cookies for authentication
		});
		yjsProviderRef.current = provider;

		// Track connection status
		provider.on("status", ({ status }) => {
			console.log("WebSocket status:", status);
			setConnectionStatus(status);
		});

		provider.on("sync", (isSynced) => {
			console.log("Yjs synced:", isSynced);
		});

		// Create CodeMirror editor with Yjs binding
		const state = EditorState.create({
			doc: yText.toString(),
			extensions: [
				basicSetup,
				StreamLanguage.define(vhdl),
				monokai,
				yCollab(yText, provider.awareness),
				EditorView.theme({
					"&": { height: "100%" },
					".cm-scroller": { overflow: "auto" }
				}),
			],
		});

		const view = new EditorView({
			state,
			parent: testbenchEditorRef.current,
		});
		testbenchViewRef.current = view;

		// Cleanup on unmount or when commit/module changes
		return () => {
			if (testbenchViewRef.current) {
				testbenchViewRef.current.destroy();
				testbenchViewRef.current = null;
			}
			if (yjsProviderRef.current) {
				yjsProviderRef.current.destroy();
				yjsProviderRef.current = null;
			}
			if (yjsDocRef.current) {
				yjsDocRef.current.destroy();
				yjsDocRef.current = null;
			}
		};
	}, [name, commit]);

	const handleStartSim = async () => {
		try {
			setSimOutput('');
			const durationEl = document.getElementById('sim-duration');
			const unitEl = document.getElementById('sim-unit');
			const duration = durationEl ? parseInt(durationEl.value) : 100;
			const unit = unitEl ? unitEl.value : 'ns';

			const body = { commit, module: name, duration, unit };
			const r = await fetch(`${API_BASE}/api/simulate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body),
			});
			if (!r.ok) throw new Error('Failed to start simulation');
			const j = await r.json();
			const runId = j.runId;
			setCurrentRunId(runId);

			const es = new EventSource(`${API_BASE}/api/run/${runId}/events`);
			es.onmessage = (ev) => {
				setSimOutput((s) => s + ev.data + "\n");
			};
			es.addEventListener('done', (ev) => {
				es.close();
			});
		} catch (err) {
			console.error('start sim error', err);
			setSimOutput((s) => s + 'Error starting simulation: ' + err.message + "\n");
		}
	};

	return (
		<>
			<Section
				style={{
					width: "100%",
					display: "flex",
					flexDirection: "row",
					justifyContent: "space-between",
				}}
			>
				<Card
					style={{
						width: "100%",
						display: "flex",
						flexDirection: "column",
					}}
				>
					<div
						style={{
							width: "100%",
							display: "flex",
							flexDirection: "row",
							alignContent: "center",
							justifyContent: "space-between",
							paddingBottom: "10px",
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<label style={{ fontSize: '14px' }}>Duration</label>
							<input id="sim-duration" type="number" defaultValue={100} style={{ width: '90px' }} />
							<select id="sim-unit" defaultValue={'ns'} style={{ padding: '4px' }}>
								<option value="ns">ns</option>
								<option value="us">us</option>
								<option value="ms">ms</option>
								<option value="s">s</option>
							</select>
							<Button variant="primary" size="2" onClick={() => handleStartSim()}>
								<PlayIcon />
							</Button>
							<Button variant="ghost" size="2" onClick={() => {
								if (currentRunId) {
									window.open(`${API_BASE}/api/run/${currentRunId}/waveform`, '_blank');
								}
							}} disabled={!currentRunId}>
								<Text>Waveform</Text>
							</Button>
						</div>
						<Badge 
							color={connectionStatus === "connected" ? "green" : connectionStatus === "connecting" ? "yellow" : "red"}
							size="2"
						>
							{connectionStatus === "connected" ? "🟢 Connected" : connectionStatus === "connecting" ? "🟡 Connecting..." : "🔴 Disconnected"}
						</Badge>
					</div>
					<div
						style={{
							display: "flex",
							flexDirection: "row",
							gap: "10px",
							width: "100%",
						}}
					>
						{/* Left: Module code (read-only for now) */}
						<CodeMirror
							style={{ width: "50%" }}
							height="70vh"
							extensions={[StreamLanguage.define(vhdl)]}
							editable={false}
							theme={monokai}
							value={moduleTextVal}
						/>
						{/* Right: Testbench code (collaborative editing with Yjs) */}
						<div 
							ref={testbenchEditorRef}
							style={{ 
								width: "50%", 
								height: "70vh",
								overflow: "auto",
								border: "1px solid #333",
								borderRadius: "4px",
								display: "flex",
								flexDirection: "column"
							}}
						/>
					</div>
					<div style={{ height: "10px" }} />
					{/* Bottom: Simulation output placeholder */}
					<CodeMirror
						style={{ width: "100%" }}
						height="20vh"
						extensions={[]}
						editable={false}
						theme={monokai}
						basicSetup={{
							lineNumbers: false,
							highlightActiveLine: false,
						}}
						value={simOutput}
					/>
				</Card>
			</Section>
		</>
	);
};

export default ModuleViewer;
