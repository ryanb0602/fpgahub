import React, { useEffect, useState, useCallback, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";
import { DashTopBar } from "../components/DashTopBar";

const API_BASE = process.env.REACT_APP_API_BASE;

// BFS from each node to count all unique reachable descendants (cycle-safe).
function computeDescendantCounts(nodes, links) {
	const children = {};
	nodes.forEach((n) => {
		children[n.id] = [];
	});
	links.forEach((l) => {
		const src = typeof l.source === "object" ? l.source.id : l.source;
		const tgt = typeof l.target === "object" ? l.target.id : l.target;
		if (children[src]) children[src].push(tgt);
	});

	const counts = {};
	nodes.forEach((n) => {
		const visited = new Set([n.id]);
		const queue = [n.id];
		while (queue.length > 0) {
			const curr = queue.shift();
			for (const child of children[curr] || []) {
				if (!visited.has(child)) {
					visited.add(child);
					queue.push(child);
				}
			}
		}
		counts[n.id] = visited.size - 1; // exclude the node itself
	});
	return counts;
}

// Fix the y-coordinate of each node so nodes with more descendants sit higher.
// canvasHeight is the pixel height of the ForceGraph canvas.
function assignHierarchicalY(nodes, counts, canvasHeight) {
	const values = nodes.map((n) => counts[n.id] || 0);
	const maxCount = Math.max(...values, 1);
	const yRange = canvasHeight * 0.2; // nodes spread ±20% of canvas height
	nodes.forEach((n) => {
		const ratio = (counts[n.id] || 0) / maxCount;
		// ratio=1 (most descendants) → top (-yRange); ratio=0 (leaf) → bottom (+yRange)
		n.fy = yRange * (1 - 2 * ratio);
	});
}

export const NetworkGraph = () => {
	const [graphData, setGraphData] = useState({ nodes: [], links: [] });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const containerRef = useRef(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
	const navigate = useNavigate();

	// Keep refs to the live node objects and their counts so we can re-apply fy
	// when the canvas size changes without refetching.
	const nodesRef = useRef([]);
	const countsRef = useRef({});
	const fgRef = useRef();
	const chargeApplied = useRef(false);

	useEffect(() => {
		const fetchGraph = async () => {
			try {
				const res = await fetch(`${API_BASE}/api/graph`, {
					credentials: "include",
				});
				if (!res.ok) throw new Error("Failed to fetch graph data");
				const data = await res.json();

				const counts = computeDescendantCounts(data.nodes, data.links);
				assignHierarchicalY(data.nodes, counts, dimensions.height);

				nodesRef.current = data.nodes;
				countsRef.current = counts;
				chargeApplied.current = false;
				setGraphData(data);
			} catch (err) {
				console.error(err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchGraph();
		// dimensions.height is intentionally omitted: the resize effect (below)
		// re-applies fy whenever height changes, so the initial fetch only needs
		// the dimension snapshot at mount time.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				setDimensions({
					width: containerRef.current.offsetWidth,
					height: containerRef.current.offsetHeight,
				});
			}
		};

		updateDimensions();
		window.addEventListener("resize", updateDimensions);
		return () => window.removeEventListener("resize", updateDimensions);
	}, [loading]);

	// Re-apply fy whenever the canvas height changes so positions stay proportional.
	useEffect(() => {
		if (nodesRef.current.length === 0) return;
		assignHierarchicalY(nodesRef.current, countsRef.current, dimensions.height);
		setGraphData((prev) => ({ ...prev }));
	}, [dimensions.height]);

	const handleNodeClick = useCallback(
		(node) => {
			navigate(`/module?id=${encodeURIComponent(node.id)}`);
		},
		[navigate],
	);

	const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
		const BASE_FONT_SIZE = 10;
		const MIN_FONT_SIZE = 3;
		const PADDING_X_MULTIPLIER = 0.8;
		const PADDING_Y_MULTIPLIER = 0.5;

		const label = node.id;
		const fontSize = Math.max(BASE_FONT_SIZE / globalScale, MIN_FONT_SIZE);
		ctx.font = `${fontSize}px Sans-Serif`;

		const textWidth = ctx.measureText(label).width;
		const paddingX = fontSize * PADDING_X_MULTIPLIER;
		const paddingY = fontSize * PADDING_Y_MULTIPLIER;
		const rectWidth = textWidth + paddingX * 2;
		const rectHeight = fontSize + paddingY * 2;

		// Node background
		ctx.fillStyle = "rgba(59, 18, 5, 0.9)";
		ctx.strokeStyle = "rgba(255, 124, 57, 0.8)";
		ctx.lineWidth = Math.max(1 / globalScale, 0.5);
		ctx.beginPath();
		ctx.roundRect(
			node.x - rectWidth / 2,
			node.y - rectHeight / 2,
			rectWidth,
			rectHeight,
			fontSize * 0.4,
		);
		ctx.fill();
		ctx.stroke();

		// Node label
		ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(label, node.x, node.y);

		node.__rectWidth = rectWidth;
		node.__rectHeight = rectHeight;
	}, []);

	const DEFAULT_NODE_WIDTH = 20;
	const DEFAULT_NODE_HEIGHT = 10;

	const nodePointerAreaPaint = useCallback((node, color, ctx) => {
		ctx.fillStyle = color;
		ctx.fillRect(
			node.x - (node.__rectWidth || DEFAULT_NODE_WIDTH) / 2,
			node.y - (node.__rectHeight || DEFAULT_NODE_HEIGHT) / 2,
			node.__rectWidth || DEFAULT_NODE_WIDTH,
			node.__rectHeight || DEFAULT_NODE_HEIGHT,
		);
	}, []);

	return (
		<>
			<DashTopBar />
			<div
				ref={containerRef}
				style={{
					width: "100%",
					height: "calc(100vh - 8vh)",
					background: "linear-gradient(135deg, #0d0302 0%, #1a0703 100%)",
					position: "relative",
					overflow: "hidden",
				}}
			>
				{loading && (
					<div
						style={{
							position: "absolute",
							top: "50%",
							left: "50%",
							transform: "translate(-50%, -50%)",
							color: "rgba(255, 124, 57, 0.8)",
							fontSize: "1.2rem",
						}}
					>
						Loading graph…
					</div>
				)}

				{error && (
					<div
						style={{
							position: "absolute",
							top: "50%",
							left: "50%",
							transform: "translate(-50%, -50%)",
							color: "rgba(255, 80, 80, 0.9)",
							fontSize: "1rem",
						}}
					>
						Error: {error}
					</div>
				)}

				{!loading && !error && graphData.nodes.length === 0 && (
					<div
						style={{
							position: "absolute",
							top: "50%",
							left: "50%",
							transform: "translate(-50%, -50%)",
							color: "rgba(255, 255, 255, 0.5)",
							fontSize: "1rem",
						}}
					>
						No modules found. Upload some VHDL files to get started.
					</div>
				)}

				{!loading && !error && graphData.nodes.length > 0 && (
					<ForceGraph2D
						ref={fgRef}
						width={dimensions.width}
						height={dimensions.height}
						graphData={graphData}
						nodeCanvasObject={nodeCanvasObject}
						nodePointerAreaPaint={nodePointerAreaPaint}
						onNodeClick={handleNodeClick}
						linkColor={() => "rgba(255, 124, 57, 0.4)"}
						linkWidth={1.5}
						linkDirectionalArrowLength={6}
						linkDirectionalArrowRelPos={1}
						backgroundColor="transparent"
						nodeLabel=""
						onEngineStop={() => {
							if (!chargeApplied.current && fgRef.current) {
								chargeApplied.current = true;
								fgRef.current.d3Force("charge").strength(-200);
								fgRef.current.d3ReheatSimulation();
							}
						}}
					/>
				)}
			</div>
		</>
	);
};

export default NetworkGraph;
