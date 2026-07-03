const pool = require("./db");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const minioClient = require("./minio");
const ingester = require("./commit_ingestion.js");
const archiver = require("archiver");

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

router.get("/pull", async (req, res) => {
  try {
    const topName = req.query.top;
    const modules = await pool.query(
      `WITH RECURSIVE dependency_graph AS (
    SELECT id, name, file_id, merkle_hash, hash, last_touched_commit_hash
    FROM modules
    WHERE name = $1
    
    UNION
    
    SELECT m.id, m.name, m.file_id, m.merkle_hash, m.hash, m.last_touched_commit_hash
    FROM modules m
    JOIN edges e ON m.id = e.to_id
    JOIN dependency_graph dg ON e.from_id = dg.id
    )
    SELECT 
            dg.id,
            dg.name,
            dg.file_id,
            f.filename AS filename,
            dg.merkle_hash,
            dg.hash,
            dg.last_touched_commit_hash
          FROM dependency_graph dg
          LEFT JOIN files f ON dg.file_id = f.id;`,
      [topName],
    );
    console.log(modules.rows);
    const moduleIds = modules.rows.map((m) => m.id);
    const edges = await pool.query(
      "SELECT * FROM edges WHERE from_id = ANY($1)",
      [moduleIds],
    );

    res.json({
      modules: modules.rows,
      edges: edges.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to process pull." });
  }
});

router.get("/pull/files", async (req, res) => {
  const bucketName = "data";
  const topName = req.query.top;
  try {
    const modulesQuery = await pool.query(
      `WITH RECURSIVE dependency_graph AS (
        SELECT id, name, file_id
        FROM modules
        WHERE name = $1
        
        UNION
        
        SELECT m.id, m.name, m.file_id
        FROM modules m
        JOIN edges e ON m.id = e.to_id
        JOIN dependency_graph dg ON e.from_id = dg.id
      )
      SELECT DISTINCT file_id
      FROM dependency_graph
      WHERE file_id IS NOT NULL;`,
      [topName],
    );

    const filesToFetch = modulesQuery.rows.map((row) => row.file_id);

    if (filesToFetch.length === 0) {
      return res
        .status(404)
        .json({ error: "No files found for this module graph." });
    }

    res.attachment("bundle.zip");
    res.setHeader("Content-Type", "application/zip");

    const archive = new archiver.ZipArchive({
      zlib: { level: 6 },
    });

    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate zip archive." });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    for (const fileName of filesToFetch) {
      try {
        const dataStream = await minioClient.getObject(bucketName, fileName);

        archive.append(dataStream, { name: fileName });
      } catch (minioErr) {
        console.error(
          `Failed to fetch file '${fileName}' from MinIO:`,
          minioErr,
        );
        throw new Error(`File not found in storage: ${fileName}`);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error("Error processing /pull/files:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process pull files request." });
    }
  }
});

module.exports = router;
