// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();

// ----- Config -----
const FRONTEND_URL = process.env.FRONTEND_URL || "*"; // e.g., https://collab-todo-mq2uvuujq-abhishekkumar2002s-projects.vercel.app

// ----- Middleware -----
app.use(cors({
  origin: FRONTEND_URL === "*" ? "*" : [FRONTEND_URL],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use(express.json());

// ----- Health Root -----
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Collaborative To-Do API running" });
});

// ----- Mongo -----
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });

// ----- Routes -----
app.use("/api/auth", require("./routes/auth"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/actions", require("./routes/actions"));

// ----- Error Handler (last) -----
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

// ----- HTTP + Socket.IO -----
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL === "*" ? "*" : [FRONTEND_URL],
    methods: ["GET", "POST", "PUT", "DELETE"],
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("task-update", (data) => {
    socket.broadcast.emit("task-update", data);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// ----- Start -----
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
