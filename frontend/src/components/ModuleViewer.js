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
						<Button variant="primary" size="2" /*onClick={}*/>
							<PlayIcon />
						</Button>
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
						value={"placeholder"}
					/>
				</Card>
			</Section>
		</>
	);
};

export default ModuleViewer;
