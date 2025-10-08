const express = require("express");
const router = express.Router();

const pool = require("./db");
router.use(express.json());

const protectRoute = require("./middleware.js");

router.post("/commit", protectRoute, async (req, res) => {
	console.log(req.body);
});

module.exports = router;
