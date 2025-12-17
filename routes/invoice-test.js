const express = require("express");
const router = express.Router();
const { authMiddleware: auth } = require("../middleware/auth");

// Test route
router.get("/test", auth, async (req, res) => {
  res.json({ message: "Invoice routes working" });
});

module.exports = router;
