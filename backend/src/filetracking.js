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
		const trans_handle = transactionHandler.createTransaction(req.body);
		return res
			.status(200)
			.json({ message: "Transaction created successfully", id: trans_handle });
	} catch (error) {
		console.error("Error creating transaction:", error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});

router.post("/commit/module-links/:id", protectRoute, async (req, res) => {
	const id = req.params.id;
	try {
		transactionHandler.moduleProcessing(id, req.body);
		const neededFiles = await transactionHandler.findNeededFiles(id);
		return res.status(200).json({ neededFiles: neededFiles });
	} catch (error) {
		console.log("Error processing module links:", error);
	}
});

module.exports = router;
