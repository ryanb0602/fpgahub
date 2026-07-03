// src/components/CommitDiffSelector.js
import React, { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE;

export const CommitDiffSelector = ({ onDiffLoaded, onClearDiff }) => {
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. Fetch available commits on component mount
  useEffect(() => {
    async function loadCommits() {
      try {
        const res = await fetch(`${API_BASE}/api/commits-list`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCommits(data);
        }
      } catch (err) {
        console.error("Failed to load commits:", err);
      }
    }
    loadCommits();
  }, []);

  // 2. When user selects a commit, fetch its AST diff summary
  const handleCommitChange = async (e) => {
    const commitId = e.target.value;
    setSelectedCommit(commitId);

    if (!commitId) {
      onClearDiff();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/commit-diff/${commitId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const diffData = await res.json();
        onDiffLoaded(diffData);
      }
    } catch (err) {
      console.error("Failed to fetch diff:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 24,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "rgba(26, 7, 3, 0.85)",
        padding: "8px 16px",
        borderRadius: "8px",
        border: "1px solid rgba(255, 124, 57, 0.4)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
    >
      <span style={{ color: "#ffc850", fontSize: "14px", fontWeight: 600 }}>
        Compare Diff:
      </span>

      <select
        value={selectedCommit}
        onChange={handleCommitChange}
        style={{
          background: "#0d0302",
          color: "#ffffff",
          padding: "6px 10px",
          borderRadius: "4px",
          border: "1px solid rgba(255, 124, 57, 0.6)",
          outline: "none",
          fontSize: "13px",
          cursor: "pointer",
        }}
      >
        <option value="">-- None (View Current State) --</option>
        {commits.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id.slice(0, 7)}... ({new Date(c.timestamp).toLocaleDateString()})
          </option>
        ))}
      </select>

      {loading && (
        <span
          style={{ color: "#ff7c39", fontSize: "12px", fontStyle: "italic" }}
        >
          Calculating Diffs...
        </span>
      )}

      {selectedCommit && !loading && (
        <button
          onClick={() => {
            setSelectedCommit("");
            onClearDiff();
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#ff5050",
            fontSize: "12px",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
};
