const express = require('express');
const router = express.Router();
const { attachSSE, getWaveformPath } = require('./sim_runner');

// SSE endpoint for run logs (no auth for now)
router.get('/:runId/events', (req, res) => {
  const runId = req.params.runId;
  attachSSE(runId, res);
});

// Serve waveform file (no auth for now)
router.get('/:runId/waveform', (req, res) => {
  const runId = req.params.runId;
  const p = getWaveformPath(runId);
  if (!p) return res.status(404).json({ error: 'waveform not found' });
  res.sendFile(p);
});

module.exports = router;
