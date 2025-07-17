const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Action = require("../models/Action");

router.get("/", async (req, res) => {
  const tasks = await Task.find().populate("assignedTo", "username");
  res.json(tasks);
});

router.post("/create", async (req, res) => {
  const { title, description, assignedTo, status, priority, user } = req.body;
  try {
    const task = await Task.create({ title, description, assignedTo, status, priority, lastModifiedBy: user, lastModifiedAt: new Date() });
    await Action.create({ user, action: "created task", taskTitle: title });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { data, user } = req.body;
  try {
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (new Date(data.lastModifiedAt) < task.lastModifiedAt) {
      return res.status(409).json({ conflict: true, current: task, attempted: data });
    }
    const updated = await Task.findByIdAndUpdate(id, { ...data, lastModifiedBy: user, lastModifiedAt: new Date() }, { new: true });
    await Action.create({ user, action: "updated task", taskTitle: updated.title });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { user } = req.body;
  try {
    const task = await Task.findByIdAndDelete(id);
    if (task) await Action.create({ user, action: "deleted task", taskTitle: task.title });
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/smart-assign", async (req, res) => {
  const { id } = req.params;
  try {
    const tasks = await Task.find({ status: { $in: ["Todo", "In Progress"] } });
    const counts = {};
    tasks.forEach(t => {
      const uid = t.assignedTo?.toString();
      if (uid) counts[uid] = (counts[uid] || 0) + 1;
    });
    let minUser = null, minCount = Infinity;
    for (let [uid, count] of Object.entries(counts)) {
      if (count < minCount) [minUser, minCount] = [uid, count];
    }
    const updated = await Task.findByIdAndUpdate(id, { assignedTo: minUser }, { new: true });
    await Action.create({ user: "system", action: "smart assigned", taskTitle: updated.title });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;