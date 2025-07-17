const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
  user: String,
  action: String,
  taskTitle: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Action", actionSchema);