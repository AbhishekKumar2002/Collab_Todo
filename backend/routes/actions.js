const express = require("express");
const router = express.Router();
const Action = require("../models/Action");

router.get("/recent", async (req, res) => {
  const actions = await Action.find().sort({ timestamp: -1 }).limit(20);
  res.json(actions);
});

module.exports = router;