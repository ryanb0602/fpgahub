const express = require("express");
const router = express.Router();

const pool = require("./db");
router.use(express.json());

const protectRoute = require("./middleware.js");
const transaction_handler = require("./transaction_handler.js");

const transactionHandler = new transaction_handler(pool);

router.use(
  "/commit",
  express.raw({ type: "application/octet-stream", limit: "10mb" }),
);

router.post("/commit", protectRoute, async (req, res) => {
  try {
    transactionHandler.createTransaction(req.body);
    return res
      .status(200)
      .json({ message: "Transaction created successfully" });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
