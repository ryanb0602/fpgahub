import React, { useEffect, useState, useCallback, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";
import { DashTopBar } from "../components/DashTopBar";

const API_BASE = process.env.REACT_APP_API_BASE;

export const NetworkGraph = () => {
	const [graphData, setGraphData] = useState({ nodes: [], links: [] });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const containerRef = useRef(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
	const navigate = useNavigate();

	useEffect(() => {
		const fetchGraph = async () => {
			try {
				const res = await fetch(`${API_BASE}/api/graph`, {
					credentials: "include",
				});
				if (!res.ok) throw new Error("Failed to fetch graph data");
				const data = await res.json();
				setGraphData(data);
			} catch (err) {
				console.error(err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchGraph();
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
					/>
				)}
			</div>
		</>
	);
};

export default NetworkGraph;
