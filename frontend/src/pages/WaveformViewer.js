import React, { useEffect, useState, useRef } from 'react';

// VCD parser (times converted to nanoseconds) and WaveDrom renderer

function parseVCD(text) {
  const lines = text.split(/\r?\n/);
  const idToSignal = {}; // id -> name
  let currentTime = 0;
  const events = []; // {time, id, value}

  // detect timescale (e.g. "$timescale 1 ns $end")
  let timescale_ns = 1; // default assume 1 ns per tick
  const tsMatch = text.match(/\$timescale\s*([0-9.eE+-]+)?\s*(fs|ps|ns|us|ms|s)?\s*\$end/i);
  if (tsMatch) {
    const v = tsMatch[1] ? parseFloat(tsMatch[1]) : 1;
    const unit = tsMatch[2] ? tsMatch[2].toLowerCase() : 'ns';
    const unitToNs = { s: 1e9, ms: 1e6, us: 1e3, ns: 1, ps: 1e-3, fs: 1e-6 };
    const factor = unitToNs[unit] || 1;
    timescale_ns = v * factor;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('$')) {
      if (line.startsWith('$var')) {
        const parts = line.split(/\s+/);
        // $var <type> <size> <id> <name> $end
        if (parts.length >= 5) {
          const id = parts[3];
          const name = parts.slice(4, parts.length - 1).join(' ');
          idToSignal[id] = name;
        }
      }
      continue;
    }
    if (line.startsWith('#')) {
      currentTime = parseInt(line.slice(1), 10);
      continue;
    }
    // value changes
    if (line[0] === 'b' || line[0] === 'B') {
      const m = line.match(/^b([01xXzZ]+)\s+(\S+)/);
      if (m) events.push({ time: currentTime, id: m[2], value: m[1] });
    } else {
      const m = line.match(/^([01xzXZ])(.+)$/);
      if (m) events.push({ time: currentTime, id: m[2].trim(), value: m[1] });
    }
  }

  // convert to nanoseconds
  for (const ev of events) ev.time_ns = ev.time * timescale_ns;

  // build signals map
  const signals = {};
  for (const id of Object.keys(idToSignal)) signals[id] = { name: idToSignal[id], changes: [] };
  for (const ev of events) {
    if (!signals[ev.id]) signals[ev.id] = { name: ev.id, changes: [] };
    signals[ev.id].changes.push({ time: ev.time_ns, value: ev.value });
  }
  for (const id of Object.keys(signals)) signals[id].changes.sort((a, b) => a.time - b.time);

  const timeSet = new Set();
  for (const ev of events) timeSet.add(ev.time_ns);
  const times = Array.from(timeSet).sort((a, b) => a - b);

  return { signals, times, timescale_ns };
}

// D3-based waveform renderer
function renderWithD3(container, signals, times, requestedEndTime) {
  // load d3 if needed
  const ensureD3 = () => new Promise((resolve, reject) => {
    if (window.d3) return resolve(window.d3);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/d3@7/dist/d3.min.js';
    script.onload = () => resolve(window.d3);
    script.onerror = (e) => reject(new Error('Failed to load d3'));
    document.head.appendChild(script);
  });

  ensureD3().then((d3) => {
    // clear container
    container.innerHTML = '';
    const signalsArr = Object.values(signals);
    const rowH = 28;
    const labelW = 160;
    const padding = { top: 20, bottom: 20, left: 10, right: 20 };
    const height = signalsArr.length * rowH + padding.top + padding.bottom;
    const width = Math.max(800, Math.min(2000, container.clientWidth || 1000));

    // compute times in ns array
    const tarr = times.length ? times.slice().sort((a,b) => a-b) : [0];
    if (tarr[0] !== 0) tarr.unshift(0);
    const maxTime = (requestedEndTime && requestedEndTime > 0) ? Math.min(tarr[tarr.length-1], requestedEndTime) : tarr[tarr.length-1];

    const svg = d3.select(container).append('svg')
      .attr('width', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', '#fff');

    const x = d3.scaleLinear().domain([0, maxTime || 1]).range([labelW, width - padding.right]);
    const xAxis = d3.axisTop(x).ticks(10).tickFormat(d => d);
    svg.append('g').attr('transform', `translate(0,${padding.top})`).call(xAxis).selectAll('text').style('font-size', '10px');

    // rows
    const g = svg.append('g').attr('transform', `translate(0,${padding.top + 20})`);

    const tooltip = d3.select(container).append('div')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(0,0,0,0.8)')
      .style('color', '#fff')
      .style('padding', '6px 8px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('display', 'none');

    signalsArr.forEach((s, i) => {
      const y = i * rowH;
      // label
      g.append('text').attr('x', 6).attr('y', y + 12).text(s.name).style('font-size', '12px').style('fill', '#111');
      // baseline
      g.append('line').attr('x1', labelW).attr('x2', width - padding.right).attr('y1', y + 8).attr('y2', y + 8).style('stroke', '#e6e6e6');

      // build segments
      const segs = [];
      if (!s.changes || s.changes.length === 0) {
        segs.push({ start: 0, end: maxTime || 1, value: 'x' });
      } else {
        let prevT = 0; let prevV = 'x';
        for (const ch of s.changes) {
          if (ch.time > prevT) segs.push({ start: prevT, end: ch.time, value: prevV });
          prevT = ch.time; prevV = ch.value;
        }
        segs.push({ start: prevT, end: maxTime || prevT + 1, value: prevV });
      }

      segs.forEach((seg) => {
        const sStart = Math.max(0, Math.min(maxTime, seg.start));
        const sEnd = Math.max(0, Math.min(maxTime, seg.end));
        if (sEnd <= sStart) return;
        const x1 = x(sStart);
        const x2 = x(sEnd);
        const isHigh = String(seg.value).toLowerCase().includes('1');
        if (String(seg.value).toLowerCase() === 'x' || String(seg.value).toLowerCase() === 'z') {
          g.append('rect').attr('x', x1).attr('y', y).attr('width', Math.max(1, x2 - x1)).attr('height', 16).style('fill', '#fafafa').style('stroke', '#bdbdbd').style('stroke-dasharray', '4,2');
        } else if (isHigh) {
          g.append('rect').attr('x', x1).attr('y', y).attr('width', Math.max(1, x2 - x1)).attr('height', 8).style('fill', '#2e7d32').style('rx', 2);
        } else {
          g.append('rect').attr('x', x1).attr('y', y).attr('width', Math.max(1, x2 - x1)).attr('height', 8).style('fill', '#f5f5f5').style('rx', 2);
        }

        // hover rect
        g.append('rect')
          .attr('x', x1)
          .attr('y', y)
          .attr('width', Math.max(1, x2 - x1))
          .attr('height', 16)
          .style('fill', 'transparent')
          .on('mousemove', (event) => {
            const [mx, my] = d3.pointer(event);
            const t = Math.round(x.invert(mx));
            tooltip.style('left', (event.clientX + 12) + 'px').style('top', (event.clientY + 12) + 'px').style('display', 'block').html(`<b>${s.name}</b><br/>t=${t}<br/>v=${seg.value}`);
          })
          .on('mouseout', () => tooltip.style('display', 'none'));
      });
    });

    // zoom/pan
    const zoomed = (event) => {
      const transform = event.transform;
      const newX = transform.rescaleX(x);
      svg.select('g').call(d3.axisTop(newX).ticks(10));
      g.selectAll('rect').remove();
      // re-render segments using newX
      signalsArr.forEach((s, i) => {
        const y = i * rowH;
        const segs = [];
        if (!s.changes || s.changes.length === 0) {
          segs.push({ start: 0, end: maxTime || 1, value: 'x' });
        } else {
          let prevT = 0; let prevV = 'x';
          for (const ch of s.changes) {
            if (ch.time > prevT) segs.push({ start: prevT, end: ch.time, value: prevV });
            prevT = ch.time; prevV = ch.value;
          }
          segs.push({ start: prevT, end: maxTime || prevT + 1, value: prevV });
        }
        segs.forEach((seg) => {
          const sStart = Math.max(0, Math.min(maxTime, seg.start));
          const sEnd = Math.max(0, Math.min(maxTime, seg.end));
          if (sEnd <= sStart) return;
          const x1 = newX(sStart);
          const x2 = newX(sEnd);
          const isHigh = String(seg.value).toLowerCase().includes('1');
          if (String(seg.value).toLowerCase() === 'x' || String(seg.value).toLowerCase() === 'z') {
            g.append('rect').attr('x', x1).attr('y', y).attr('width', Math.max(1, x2 - x1)).attr('height', 16).style('fill', '#fafafa').style('stroke', '#bdbdbd').style('stroke-dasharray', '4,2');
          } else if (isHigh) {
            g.append('rect').attr('x', x1).attr('y', y).attr('width', Math.max(1, x2 - x1)).attr('height', 8).style('fill', '#2e7d32').style('rx', 2);
          } else {
            g.append('rect').attr('x', x1).attr('y', y).attr('width', Math.max(1, x2 - x1)).attr('height', 8).style('fill', '#f5f5f5').style('rx', 2);
          }
        });
      });
    };

    svg.call(d3.zoom().scaleExtent([0.2, 50]).on('zoom', zoomed));

  }).catch((err) => {
    container.innerHTML = '<div style="color:#b00">Failed to load d3: ' + String(err) + '</div>';
  });
}

export default function WaveformViewer() {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get('runId');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!runId) { setError('Missing runId'); setLoading(false); return; }

    // Try in-memory stored waveform first (localStorage/sessionStorage)
    try {
      const key = `waveform_b64_${runId}`;
      const b64 = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (b64) {
        const txt = atob(b64);
        const { signals, times } = parseVCD(txt);
        renderWithD3(containerRef.current, signals, times, null);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('Failed to read embedded waveform from storage', e);
    }

    // Fallback: fetch waveform from server run endpoint
    const base = (process.env.REACT_APP_API_BASE || window.location.origin).replace(/\/$/, '');
    fetch(`${base}/run/${runId}/waveform`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`);
        const t = await r.text();
        const { signals, times } = parseVCD(t);
        renderWithD3(containerRef.current, signals, times, null);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));

  }, [runId]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Waveform Viewer - run {runId}</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {loading && !error && <div>Loading waveform...</div>}
      <div ref={containerRef} id={`wavedrom_viewer_${runId}`} style={{ minWidth: 400, minHeight: 240 }} />
      <div style={{ marginTop: 16 }}>
        <a href={`${process.env.REACT_APP_API_BASE}/api/run/${runId}/waveform`} target="_blank" rel="noreferrer">Download VCD</a>
      </div>
    </div>
  );
}
