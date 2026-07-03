// src/pages/NetworkGraph.js
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useNavigate, useLocation } from "react-router-dom";
import { DashTopBar } from "../components/DashTopBar";
// 1. IMPORT THE NEW COMPONENT
import { CommitDiffSelector } from "../components/CommitDiffSelector";

const API_BASE = process.env.REACT_APP_API_BASE;

export const NetworkGraph = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const navigate = useNavigate();
  const location = useLocation();

  const initialHighlight = new URLSearchParams(location.search).get(
    "highlight",
  );
  const [highlightedNode, setHighlightedNode] = useState(
    initialHighlight || null,
  );
  const pendingZoomRef = useRef(initialHighlight || null);
  const fgRef = useRef();

  // 2. STATE FOR ACTIVE AST DIFF
  const [activeDiff, setActiveDiff] = useState(null);

  // Optimized Filter Logic
  const processedData = useMemo(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) {
      return { nodes: [], links: [] };
    }

    const validNodeIds = new Set(graphData.nodes.map((n) => String(n.id)));

    const filteredLinks = graphData.links.filter((link) => {
      const s =
        typeof link.source === "object" ? link.source.id : String(link.source);
      const t =
        typeof link.target === "object" ? link.target.id : String(link.target);

      const sourceExists = validNodeIds.has(s);
      const targetExists = validNodeIds.has(t);

      if (!sourceExists || !targetExists) {
        console.warn(
          `Link rejected: Source(${s}): ${sourceExists}, Target(${t}): ${targetExists}`,
        );
        return false;
      }
      return true;
    });

    return {
      nodes: graphData.nodes,
      links: filteredLinks,
    };
  }, [graphData]);

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

  useEffect(() => {
    if (!fgRef.current || processedData.nodes.length === 0) return;
    fgRef.current.d3Force("link").distance(50);
    fgRef.current.d3Force("charge").strength(-150);
    fgRef.current.d3ReheatSimulation();
  }, [processedData]);

  const handleNodeClick = useCallback(
    (node) => {
      navigate(`/module?id=${encodeURIComponent(node.id)}`);
    },
    [navigate],
  );

  const handleSearchSelect = useCallback(
    (moduleName) => {
      setHighlightedNode(moduleName);
      pendingZoomRef.current = moduleName;
      if (!fgRef.current) return;
      const node = processedData.nodes.find((n) => n.id === moduleName);
      if (node && node.x != null && node.y != null) {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(6, 600);
      }
    },
    [processedData.nodes],
  );

  // 3. HELPER FUNCTION TO COLOR NODES BY AST DIFF ACTION
  const getNodeStyle = useCallback(
    (nodeId, isHighlighted) => {
      if (isHighlighted) {
        return {
          fill: "rgba(180, 70, 0, 0.95)",
          stroke: "rgba(255, 200, 80, 1)",
          text: "rgba(255, 230, 150, 1)",
        };
      }

      if (!activeDiff) {
        // Default Orange Theme
        return {
          fill: "rgba(59, 18, 5, 0.9)",
          stroke: "rgba(255, 124, 57, 0.8)",
          text: "rgba(255, 255, 255, 0.9)",
        };
      }

      if (activeDiff.add && activeDiff.add.includes(nodeId)) {
        return {
          fill: "rgba(6, 95, 70, 0.9)", // 🟢 Green
          stroke: "rgba(16, 185, 129, 1)",
          text: "#a7f3d0",
        };
      }
      if (activeDiff.update && activeDiff.update.includes(nodeId)) {
        return {
          fill: "rgba(30, 58, 138, 0.9)", // 🔵 Blue
          stroke: "rgba(59, 130, 246, 1)",
          text: "#bfdbfe",
        };
      }
      if (activeDiff.move && activeDiff.move.includes(nodeId)) {
        return {
          fill: "rgba(88, 28, 135, 0.9)", // 🟣 Purple
          stroke: "rgba(168, 85, 247, 1)",
          text: "#e9d5ff",
        };
      }
      if (activeDiff.disconnect && activeDiff.disconnect.includes(nodeId)) {
        return {
          fill: "rgba(127, 29, 29, 0.9)", // 🔴 Red
          stroke: "rgba(239, 68, 68, 1)",
          text: "#fecaca",
        };
      }

      // Untouched nodes fade into background slightly when a diff is active
      return {
        fill: "rgba(30, 10, 5, 0.4)",
        stroke: "rgba(100, 50, 25, 0.3)",
        text: "rgba(180, 180, 180, 0.5)",
      };
    },
    [activeDiff],
  );

  // 4. UPDATED NODE RENDERER WITH DYNAMIC DIFF STYLING
  const nodeCanvasObject = useCallback(
    (node, ctx, globalScale) => {
      const isHighlighted = node.id === highlightedNode;
      const label = node.id;
      const fontSize = Math.max(10 / globalScale, 4);
      ctx.font = `${fontSize}px Sans-Serif`;

      const textWidth = ctx.measureText(label).width;
      const rectWidth = textWidth + fontSize * 0.8 * 2;
      const rectHeight = fontSize + fontSize * 0.5 * 2;

      // Grab dynamic style based on commit diff
      const style = getNodeStyle(node.id, isHighlighted);

      if (isHighlighted) {
        ctx.shadowColor = "rgba(255, 180, 80, 0.9)";
        ctx.shadowBlur = Math.max(12 / globalScale, 4);
      }

      ctx.fillStyle = style.fill;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = isHighlighted
        ? Math.max(2 / globalScale, 1)
        : Math.max(1 / globalScale, 0.5);

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

      ctx.shadowColor = "transparent";
      ctx.fillStyle = style.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, node.x, node.y);

      node.__rectWidth = rectWidth;
      node.__rectHeight = rectHeight;
    },
    [highlightedNode, getNodeStyle],
  );

  const nodePointerAreaPaint = useCallback((node, color, ctx) => {
    const w = node.__rectWidth || 20;
    const h = node.__rectHeight || 10;
    ctx.fillStyle = color;
    ctx.fillRect(node.x - w / 2, node.y - h / 2, w, h);
  }, []);

  return (
    <>
      <DashTopBar onSelect={handleSearchSelect} />
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
        {/* 5. ADD THE COMMIT DIFF SELECTOR OVERLAY */}
        <CommitDiffSelector
          onDiffLoaded={(diffData) => {
            setActiveDiff(diffData);
          }}
          onClearDiff={() => {
            setActiveDiff(null);
          }}
        />

        {loading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "rgba(255, 124, 57, 0.8)",
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
            }}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && processedData.nodes.length > 0 && (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={processedData}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            onNodeClick={handleNodeClick}
            linkColor={() => "rgba(255, 124, 57, 0.4)"}
            linkWidth={1.5}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.5}
            backgroundColor="transparent"
            d3AlphaDecay={0.02}
            onEngineStop={() => {
              if (pendingZoomRef.current) {
                const node = processedData.nodes.find(
                  (n) => n.id === pendingZoomRef.current,
                );
                if (node?.x != null) {
                  fgRef.current.centerAt(node.x, node.y, 600);
                  fgRef.current.zoom(6, 600);
                }
                pendingZoomRef.current = null;
              } else {
                fgRef.current.zoomToFit(400, 50);
              }
            }}
          />
        )}
      </div>
    </>
  );
};

export default NetworkGraph;
