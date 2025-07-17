const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Action = require("../models/Action");

// GET all tasks (with assigned user)
router.get("/", async (req, res, next) => {
  try {
    const tasks = await Task.find().populate("assignedTo", "username email");
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// CREATE
router.post("/create", async (req, res, next) => {
  try {
    const { title, description, assignedTo, status, priority, user } = req.body;
    const task = await Task.create({
      title,
      description,
      assignedTo: assignedTo || null,
      status: status || "Todo",
      priority: priority || "Medium",
      lastModifiedBy: user,
      lastModifiedAt: new Date()
    });
    await Action.create({ user, action: "created task", taskTitle: title });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// UPDATE (conflict-aware)
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, user } = req.body;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    // conflict
    if (data.lastModifiedAt && new Date(data.lastModifiedAt) < task.lastModifiedAt) {
      return res.status(409).json({ conflict: true, current: task, attempted: data });
    }

    const updated = await Task.findByIdAndUpdate(
      id,
      { ...data, lastModifiedBy: user, lastModifiedAt: new Date() },
      { new: true }
    ).populate("assignedTo", "username email");

    await Action.create({ user, action: "updated task", taskTitle: updated.title });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user } = req.body;
    const task = await Task.findByIdAndDelete(id);
    if (task) {
      await Action.create({ user, action: "deleted task", taskTitle: task.title });
    }
    res.json({ message: "Task deleted" });
  } catch (err) {
    next(err);
  }
});

// SMART ASSIGN
router.post("/:id/smart-assign", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Count active tasks per user
    const active = await Task.find({ status: { $in: ["Todo", "In Progress"] }, assignedTo: { $ne: null } });
    const counts = active.reduce((acc, t) => {
      const uid = t.assignedTo.toString();
      acc[uid] = (acc[uid] || 0) + 1;
      return acc;
    }, {});

    // Find least-loaded user
    let minUser = null;
    let minCount = Infinity;
    Object.entries(counts).forEach(([uid, count]) => {
      if (count < minCount) {
        minCount = count;
        minUser = uid;
      }
    });

    // If no users have active tasks, leave unassigned
    const update = { assignedTo: minUser || null, lastModifiedAt: new Date(), lastModifiedBy: "system" };
    const updated = await Task.findByIdAndUpdate(id, update, { new: true }).populate("assignedTo", "username email");
    await Action.create({ user: "system", action: "smart assigned", taskTitle: updated.title });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
