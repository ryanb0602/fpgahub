import React, { useEffect, useState, useRef } from 'react';

// Minimal VCD parser and SVG waveform renderer

function parseVCD(text) {
  const lines = text.split(/\r?\n/);
  const idToSignal = {}; // id -> name
  let inVar = false;
  let inDefinitions = true;
  let currentTime = 0;
  const events = []; // {time, id, value}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    if (line.startsWith('$')) {
      if (line.startsWith('$var')) {
        // example: $var wire 1 ! clk $end
        const parts = line.split(/\s+/);
        // parts[0] = $var
        // parts[3] = id
        // parts[4] = name
        const id = parts[3];
        const name = parts.slice(4, parts.length - 1).join(' ');
        idToSignal[id] = name;
      }
      if (line.startsWith('$enddefinitions')) {
        inDefinitions = false;
      }
      continue;
    }

    if (line.startsWith('#')) {
      currentTime = parseInt(line.slice(1));
      continue;
    }

    // value change. Could be single-bit like "1!" or vector like "b101 id"
    if (line[0] === 'b' || line[0] === 'B') {
      // vector
      const m = line.match(/^b([01xXzZ]+)\s+(\S+)/);
      if (m) {
        const val = m[1];
        const id = m[2];
        events.push({ time: currentTime, id, value: val });
      }
    } else {
      // single-bit change
      const m = line.match(/^([01xzXZ])(.+)$/);
      if (m) {
        const val = m[1];
        const id = m[2].trim();
        events.push({ time: currentTime, id, value: val });
      }
    }
  }

  // Build per-signal timeline
  const signals = {};
  for (const id of Object.keys(idToSignal)) {
    signals[id] = { name: idToSignal[id], changes: [] };
  }
  // If unknown id occurs in events, add it
  for (const ev of events) {
    if (!signals[ev.id]) signals[ev.id] = { name: ev.id, changes: [] };
    signals[ev.id].changes.push({ time: ev.time, value: ev.value });
  }

  // Sort changes
  for (const id of Object.keys(signals)) {
    signals[id].changes.sort((a, b) => a.time - b.time);
  }

  // Build global timepoints
  const timeSet = new Set();
  for (const ev of events) timeSet.add(ev.time);
  const times = Array.from(timeSet).sort((a, b) => a - b);

  return { signals, times };
}

// Simple SVG renderer
function WaveSVG({ signals, times }) {
  // layout
  const rowH = 28;
  const labelW = 160;
  const width = Math.max(800, times.length * 6 + labelW + 40);
  const height = Object.keys(signals).length * rowH + 40;

  // Determine max time for scaling
  const maxTime = times.length ? times[times.length - 1] : 1;
  const timeToX = (t) => {
    if (maxTime === 0) return labelW + 10;
    return labelW + 10 + (t / maxTime) * (width - labelW - 40);
  };

  const rows = Object.values(signals);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ border: '1px solid #ccc' }}>
      {/* time grid */}
      {times.map((t, i) => {
        const x = timeToX(t);
        return (
          <g key={`g-${i}`}>
            <line x1={x} y1={0} x2={x} y2={height} stroke="#eee" strokeWidth={1} />
            <text x={x + 2} y={12} fontSize={10} fill="#666">{t}</text>
          </g>
        );
      })}

      {/* signals */}
      {rows.map((sig, idx) => {
        const y = idx * rowH + 30;
        // build segments from changes
        const segs = [];
        if (sig.changes.length === 0) {
          // undefined
          segs.push({ start: 0, end: maxTime || 1, value: 'x' });
        } else {
          // initial: before first change, set to last known? We'll set to x
          let prevT = 0;
          let prevV = 'x';
          for (const ch of sig.changes) {
            if (ch.time > prevT) {
              segs.push({ start: prevT, end: ch.time, value: prevV });
            }
            prevT = ch.time;
            prevV = ch.value;
          }
          // tail
          segs.push({ start: prevT, end: maxTime || prevT + 1, value: prevV });
        }

        return (
          <g key={`sig-${idx}`}>
            <text x={4} y={y + 4} fontSize={12} fill="#000">{sig.name}</text>
            {/* waveform baseline */}
            <line x1={labelW} y1={y} x2={width - 20} y2={y} stroke="#ddd" strokeWidth={1} />

            {segs.map((s, si) => {
              const x1 = timeToX(s.start);
              const x2 = timeToX(s.end);
              const val = String(s.value);
              // For multi-bit, treat any non-zero/one as x fill
              const isHigh = val === '1' || (val.length > 1 && val.includes('1'));
              const isLow = val === '0' || (val.length > 1 && !val.includes('1'));

              const yTop = y - 8;
              const yBot = y + 8;

              if (val === 'x' || val === 'z' || val === 'X' || val === 'Z') {
                // draw dashed rectangle to indicate unknown/highZ
                return (
                  <rect key={si} x={x1} y={yTop} width={Math.max(1, x2 - x1)} height={16} fill="#f6f6f6" stroke="#999" strokeDasharray="4,2" />
                );
              }

              if (isHigh) {
                // draw high line
                return (
                  <g key={si}>
                    <rect x={x1} y={yTop} width={Math.max(1, x2 - x1)} height={8} fill="#4caf50" />
                    <rect x={x1} y={y} width={Math.max(1, x2 - x1)} height={2} fill="#333" />
                  </g>
                );
              }

              // low
              return (
                <g key={si}>
                  <rect x={x1} y={y} width={Math.max(1, x2 - x1)} height={8} fill="#e0e0e0" />
                  <rect x={x1} y={y - 2} width={Math.max(1, x2 - x1)} height={2} fill="#333" />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

export default function WaveformViewer({ location }) {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get('runId');
  const [vcdText, setVcdText] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!runId) return setError('Missing runId');
    fetch(`${process.env.REACT_APP_API_BASE}/api/run/${runId}/waveform`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`);
        const t = await r.text();
        setVcdText(t);
        const p = parseVCD(t);
        setParsed(p);
      })
      .catch((err) => setError(err.message));
  }, [runId]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Waveform Viewer - run {runId}</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!error && !parsed && <div>Loading...</div>}
      {parsed && <WaveSVG signals={parsed.signals} times={parsed.times} />}
      <div style={{ marginTop: 16 }}>
        <a href={`${process.env.REACT_APP_API_BASE}/api/run/${runId}/waveform`} target="_blank" rel="noreferrer">Download VCD</a>
      </div>
    </div>
  );
}
