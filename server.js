const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "sudhu*123",
  database: "mental_health_app",
  waitForConnections: true,
  connectionLimit: 10
});

const dbPromise = db.promise();

dbPromise
  .query("SELECT 1")
  .then(() => {
    console.log("MySQL Connected");
  })
  .catch((err) => {
    console.error("DB error:", err.message);
  });

app.get("/api/users", async (_req, res) => {
  try {
    const [rows] = await dbPromise.query(
      "SELECT id, first_name, last_name, email, created_at FROM users ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users", error: err.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [existing] = await dbPromise.query("SELECT id FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);

    if (existing.length) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    await dbPromise.query(
      "INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)",
      [String(firstName).trim(), String(lastName).trim(), normalizedEmail, hashedPassword]
    );

    return res.status(201).json({ message: "Registration successful." });
  } catch (err) {
    return res.status(500).json({ message: "Registration failed.", error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [users] = await dbPromise.query(
      "SELECT id, first_name, last_name, email, password FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (!users.length) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = users[0];
    const passwordOk = await bcrypt.compare(String(password), user.password);

    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.json({
      message: "Login successful.",
      userId: user.id,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Login failed.", error: err.message });
  }
});

app.get("/api/test/questions", async (_req, res) => {
  const candidateQueries = [
    "SELECT id, question_text FROM questions ORDER BY id ASC",
    "SELECT id, question FROM questions ORDER BY id ASC",
    "SELECT id, question_text FROM test_questions ORDER BY id ASC",
    "SELECT id, question FROM test_questions ORDER BY id ASC"
  ];

  for (const sql of candidateQueries) {
    try {
      const [rows] = await dbPromise.query(sql);

      if (rows.length) {
        return res.json(rows);
      }
    } catch (_err) {
      // Try the next candidate query/table.
    }
  }

  return res.status(500).json({
    message: "Could not fetch test questions. Ensure a questions table exists with id and question/question_text columns."
  });
});

app.listen(PORT, () => {
  console.log(`Website running at http://localhost:${PORT}/index.html`);
});
