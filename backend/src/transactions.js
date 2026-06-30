const pool = require("./db");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const minioClient = require("./minio");

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

module.exports = router;
