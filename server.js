const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "visitors.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    department TEXT NOT NULL,
    purpose TEXT NOT NULL,
    visit_date TEXT NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT,
    status TEXT NOT NULL DEFAULT 'Inside',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const getAll = db.prepare("SELECT * FROM visitors ORDER BY id DESC");

app.get("/api/visitors", (req, res) => {
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "").trim();
  let rows = q
    ? db.prepare(`SELECT * FROM visitors
        WHERE visitor_name LIKE ? OR patient_name LIKE ? OR phone LIKE ? OR department LIKE ?
        ORDER BY id DESC`).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    : getAll.all();
  if (status && status !== "All") rows = rows.filter(row => row.status === status);
  res.json(rows);
});

app.get("/api/stats", (req, res) => {
  const today = new Date().toLocaleDateString("en-CA");
  res.json({
    total: db.prepare("SELECT COUNT(*) AS n FROM visitors").get().n,
    today: db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE visit_date = ?").get(today).n,
    inside: db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE status = 'Inside'").get().n,
    completed: db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE status = 'Checked out'").get().n
  });
});

app.post("/api/visitors", (req, res) => {
  const { visitor_name, phone, patient_name, department, purpose, visit_date } = req.body || {};
  const values = [visitor_name, phone, patient_name, department, purpose, visit_date];
  if (!values.every(v => typeof v === "string" && v.trim())) {
    return res.status(400).json({ error: "Please complete all required fields." });
  }
  const checkIn = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const result = db.prepare(`
    INSERT INTO visitors (visitor_name, phone, patient_name, department, purpose, visit_date, check_in)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(visitor_name.trim(), phone.trim(), patient_name.trim(), department, purpose.trim(), visit_date, checkIn);
  res.status(201).json(db.prepare("SELECT * FROM visitors WHERE id = ?").get(result.lastInsertRowid));
});

app.patch("/api/visitors/:id/checkout", (req, res) => {
  const row = db.prepare("SELECT * FROM visitors WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Visitor record not found." });
  if (row.status === "Inside") {
    const checkOut = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    db.prepare("UPDATE visitors SET status = 'Checked out', check_out = ? WHERE id = ?").run(checkOut, req.params.id);
  }
  res.json(db.prepare("SELECT * FROM visitors WHERE id = ?").get(req.params.id));
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`MediVisit HQ is running at http://localhost:${PORT}`));
