// Updated frontend fix for BoardPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../theme';

const API_URL = process.env.REACT_APP_API_URL;

const socket = io(`${API_URL}`);
const statuses = ["Todo", "In Progress", "Done"];

const BoardPage = () => {
  const [tasks, setTasks] = useState([]);
  const [actions, setActions] = useState([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [editTask, setEditTask] = useState(null);
  const [user] = useState(JSON.parse(localStorage.getItem("user")));
  const { darkMode, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/login");
    fetchTasks();
    fetchActions();
    socket.on("task-update", () => {
      fetchTasks();
      fetchActions();
    });
    return () => socket.disconnect();
  }, []);

  const fetchTasks = async () => {
    const res = await axios.get(`${API_URL}/api/tasks`);
    setTasks(res.data);
  };

  const fetchActions = async () => {
    const res = await axios.get(`${API_URL}/api/actions/recent`);
    setActions(res.data);
  };

  const onDragStart = (e, id) => e.dataTransfer.setData("id", id);

  const onDrop = async (e, newStatus) => {
    const id = e.dataTransfer.getData("id");
    const task = tasks.find(t => t._id === id);
    const data = { ...task, status: newStatus, lastModifiedAt: new Date(), lastModifiedBy: user.username };
    try {
      await axios.put(`${API_URL}/api/tasks/${id}`, { data, user: user.username });
      socket.emit("task-update", {});
    } catch (err) {
      if (err.response?.status === 409) alert("Conflict detected. Refreshing board.");
      fetchTasks();
    }
  };

  const handleSmartAssign = async (id) => {
    await axios.post(`${API_URL}/api/tasks/${id}/smart-assign`);
    socket.emit("task-update", {});
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/tasks/create`, {
        title, description: desc, priority, status: "Todo", user: user.username
      });
      setTitle(""); setDesc("");
      socket.emit("task-update", {});
    } catch (err) {
      alert("Task creation failed");
    }
  };

  const handleEdit = (task) => setEditTask(task);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const updated = {
        ...editTask,
        lastModifiedAt: new Date(),
        lastModifiedBy: user.username
      };
      await axios.put(`${API_URL}/api/tasks/${editTask._id}`, {
        data: updated,
        user: user.username
      });
      setEditTask(null);
      socket.emit("task-update", {});
    } catch (err) {
      alert("Update conflict or error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className={`${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white text-black'} min-h-screen transition-all`}>
      <div className="flex justify-between items-center px-4 py-2 shadow bg-opacity-10 dark:bg-gray-800">
        <h2 className="text-xl font-bold">Welcome, {user.username}</h2>
        <div className="flex gap-2">
          <button onClick={toggleTheme} className="px-4 py-1 bg-indigo-500 text-white rounded">
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout} className="px-4 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2 px-4 py-3 border-b dark:border-gray-700">
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required className="border p-2 rounded w-full md:w-auto dark:bg-gray-700 dark:border-gray-600" />
        <input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="border p-2 rounded w-full md:w-auto dark:bg-gray-700 dark:border-gray-600" />
        <select value={priority} onChange={e => setPriority(e.target.value)} className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600">
          <option>Low</option><option>Medium</option><option>High</option>
        </select>
        <button type="submit" className="bg-green-500 text-white px-4 rounded">Add Task</button>
      </form>

      {editTask && (
        <form onSubmit={handleEditSubmit} className="m-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded">
          <h3 className="font-semibold mb-2">Editing Task: {editTask.title}</h3>
          <input value={editTask.description} onChange={e => setEditTask({ ...editTask, description: e.target.value })} className="border p-2 w-full mb-2 dark:bg-gray-700" />
          <select value={editTask.priority} onChange={e => setEditTask({ ...editTask, priority: e.target.value })} className="border p-2 w-full mb-2 dark:bg-gray-700">
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
          <button type="submit" className="bg-blue-500 text-white px-4 py-1 rounded">Save</button>
          <button type="button" onClick={() => setEditTask(null)} className="ml-2 px-4 py-1">Cancel</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4 py-4">
        {statuses.map(status => (
          <div key={status} className="bg-gray-100 dark:bg-gray-800 p-2 rounded" onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, status)}>
            <h3 className="text-lg font-bold mb-2">{status}</h3>
            {tasks.filter(t => t.status === status).map(task => (
              <div key={task._id} draggable onDragStart={e => onDragStart(e, task._id)}
                className="bg-white dark:bg-gray-700 p-3 mb-2 rounded shadow hover:scale-[1.01] transition-transform">
                <h4 className="font-semibold">{task.title}</h4>
                <p className="text-sm">{task.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-300">Assigned: {task.assignedTo?.username || "Unassigned"}</p>
                <div className="flex justify-between mt-2">
                  <button onClick={() => handleSmartAssign(task._id)} className="text-blue-500 text-xs">Smart Assign</button>
                  <button onClick={() => handleEdit(task)} className="text-yellow-500 text-xs">Edit</button>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-y-auto max-h-[60vh]">
          <h3 className="text-lg font-bold mb-2">Activity Log</h3>
          <ul className="text-sm">
            {actions.map((a, i) => (
              <li key={i} className="mb-1">{a.user} {a.action} <strong>{a.taskTitle}</strong> at {new Date(a.timestamp).toLocaleTimeString()}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BoardPage;
