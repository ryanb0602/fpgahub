const pool = require("./db");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const minioClient = require("./minio");
const ingester = require("./commit_ingestion.js");

const express = require("express");
const router = express.Router();

router.use(express.json());

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
    const ingesterInstance = new ingester();

    const trans_id = uuidv4();

    for (const commitPayload of commitsArray) {
      await ingesterInstance.ingest(commitPayload, trans_id);
    }

    res
      .status(200)
      .json({ id: trans_id, message: "Successfully ingested all commits." });
  } catch (err) {
    console.error("Error during push ingestion:", err);
    res.status(500).json({ error: "Failed to process commits." });
  }
});

module.exports = router;
