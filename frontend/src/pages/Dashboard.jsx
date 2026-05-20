import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [behaviors, setBehaviors] = useState([]);
  const [report, setReport] = useState(null);
  const [newGoal, setNewGoal] = useState({
    title: "",
    category: "",
    frequency: "",
  });
  const [newBehavior, setNewBehavior] = useState({
    note: "",
    mood: "great",
    completed: true,
    goalId: "",
  });

  const fetchGoals = async () => {
    const res = await client.get("/api/goals");
    setGoals(res.data);
  };

  const fetchBehaviors = async () => {
    const res = await client.get("/api/behaviors/today");
    setBehaviors(res.data);
  };

  useEffect(() => {
    fetchGoals();
    fetchBehaviors();
  }, []);

  const createGoal = async (e) => {
    e.preventDefault();
    await client.post("/api/goals", newGoal);
    setNewGoal({ title: "", category: "", frequency: "" });
    fetchGoals();
  };

  const logBehavior = async (e) => {
    e.preventDefault();
    await client.post("/api/behaviors", {
      ...newBehavior,
      goalId: newBehavior.goalId ? parseInt(newBehavior.goalId) : null,
    });
    setNewBehavior({ note: "", mood: "great", completed: true, goalId: "" });
    fetchBehaviors();
  };

  const generateReport = async () => {
    const res = await client.post("/api/reports/generate");
    setReport(res.data);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.logo}>Mordi</h1>
        <div style={styles.headerRight}>
          <span style={styles.welcome}>Hey, {user?.name} 👋</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Goals */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>My Goals</h2>
          <form onSubmit={createGoal} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Goal title"
              value={newGoal.title}
              onChange={(e) =>
                setNewGoal({ ...newGoal, title: e.target.value })
              }
              required
            />
            <select
              style={styles.input}
              value={newGoal.category}
              onChange={(e) =>
                setNewGoal({ ...newGoal, category: e.target.value })
              }
            >
              <option value="">Category</option>
              <option value="fitness">Fitness</option>
              <option value="sleep">Sleep</option>
              <option value="productivity">Productivity</option>
              <option value="health">Health</option>
            </select>
            <select
              style={styles.input}
              value={newGoal.frequency}
              onChange={(e) =>
                setNewGoal({ ...newGoal, frequency: e.target.value })
              }
            >
              <option value="">Frequency</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <button style={styles.button} type="submit">
              Add Goal
            </button>
          </form>
          <div style={styles.list}>
            {goals.map((goal) => (
              <div key={goal.id} style={styles.listItem}>
                <span style={styles.goalTitle}>{goal.title}</span>
                <span style={styles.badge}>{goal.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Log Behavior */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Log Today's Behavior</h2>
          <form onSubmit={logBehavior} style={styles.form}>
            <input
              style={styles.input}
              placeholder="What did you do?"
              value={newBehavior.note}
              onChange={(e) =>
                setNewBehavior({ ...newBehavior, note: e.target.value })
              }
              required
            />
            <select
              style={styles.input}
              value={newBehavior.goalId}
              onChange={(e) =>
                setNewBehavior({ ...newBehavior, goalId: e.target.value })
              }
            >
              <option value="">Link to goal (optional)</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
            <select
              style={styles.input}
              value={newBehavior.mood}
              onChange={(e) =>
                setNewBehavior({ ...newBehavior, mood: e.target.value })
              }
            >
              <option value="great">Great 😄</option>
              <option value="good">Good 🙂</option>
              <option value="neutral">Neutral 😐</option>
              <option value="bad">Bad 😞</option>
              <option value="terrible">Terrible 😣</option>
            </select>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={newBehavior.completed}
                onChange={(e) =>
                  setNewBehavior({
                    ...newBehavior,
                    completed: e.target.checked,
                  })
                }
              />
              &nbsp;Completed
            </label>
            <button style={styles.button} type="submit">
              Log Behavior
            </button>
          </form>
          <div style={styles.list}>
            {behaviors.map((b) => (
              <div key={b.id} style={styles.listItem}>
                <span style={styles.goalTitle}>{b.note}</span>
                <span style={styles.badge}>{b.mood}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Report */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Weekly Report</h2>
          <button style={styles.button} onClick={generateReport}>
            Generate Report
          </button>
          {report && (
            <div style={styles.report}>
              <p style={styles.reportText}>{report.summary}</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={[
                    { name: "Completed", value: report.completedBehaviors },
                    { name: "Total", value: report.totalBehaviors },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "none" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#6c63ff"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#0f0f0f", padding: "0 0 2rem" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.5rem 2rem",
    borderBottom: "1px solid #2a2a2a",
    background: "#1a1a1a",
  },
  logo: { color: "#6c63ff", margin: 0, fontSize: "1.5rem" },
  headerRight: { display: "flex", alignItems: "center", gap: "1rem" },
  welcome: { color: "#888", fontSize: "0.95rem" },
  logoutBtn: {
    background: "transparent",
    border: "1px solid #3a3a3a",
    color: "#888",
    padding: "0.4rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "1.5rem",
    padding: "2rem",
  },
  card: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "1.5rem",
  },
  cardTitle: {
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: "600",
    marginTop: 0,
    marginBottom: "1.5rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    marginBottom: "1.5rem",
  },
  input: {
    padding: "0.65rem 0.75rem",
    background: "#2a2a2a",
    border: "1px solid #3a3a3a",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "0.9rem",
  },
  button: {
    padding: "0.65rem",
    background: "#6c63ff",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.65rem 0.75rem",
    background: "#2a2a2a",
    borderRadius: "8px",
  },
  goalTitle: { color: "#fff", fontSize: "0.9rem" },
  badge: {
    background: "#6c63ff22",
    color: "#6c63ff",
    padding: "0.2rem 0.6rem",
    borderRadius: "99px",
    fontSize: "0.75rem",
  },
  checkLabel: { color: "#888", fontSize: "0.9rem" },
  report: { marginTop: "1.5rem" },
  reportText: {
    color: "#888",
    fontSize: "0.9rem",
    lineHeight: "1.6",
    marginBottom: "1rem",
  },
};
