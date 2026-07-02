const pool = require("./db");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const minioClient = require("./minio");
const ingester = require("./commit_ingestion.js");

const express = require("express");
const router = express.Router();

router.use(express.json());

const ingesterInstance = new ingester();

router.get("/commits", async (req, res) => {
  try {
    const commits = await pool.query("SELECT * FROM commits;");

    res.json(commits.rows);
  } catch (err) {
    console.log(err);
  }
});

router.post("/push", async (req, res) => {
  try {
    const commitsArray = req.body;

    const trans_id = uuidv4();

    for (const commitPayload of commitsArray) {
      await ingesterInstance.ingest(commitPayload, trans_id);
    }

    const needed_files = await ingesterInstance.needed_files(trans_id);
    console.log(needed_files);

    res.status(200).json({
      id: trans_id,
      message: "Successfully ingested all commits.",
      needed_files: needed_files,
    });
  } catch (err) {
    console.error("Error during push ingestion:", err);
    res.status(500).json({ error: "Failed to process commits." });
  }
});

router.post("/file-transfer", async (req, res) => {
  try {
    const { tx_id, file, hash } = req.query;

    const response = await ingesterInstance.push_file(tx_id, file, hash, req);

    res.sendStatus(response);
  } catch (err) {
    console.error("Error during file ingestion:", err);
    res.status(500).json({ error: "Failed to process files." });
  }
});

module.exports = router;
