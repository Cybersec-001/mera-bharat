// Mera Bharat — backend server
// Express + SQLite (node:sqlite, no native deps). Serves the static site from
// public/ and adds:
//   POST /api/bookings   save a booking-form submission
//   POST /api/contacts   save a contact-form submission
//   GET  /admin          Basic-Auth protected page listing all submissions
//   GET  /api/bookings, GET /api/contacts  (Basic-Auth) JSON export
//
// Env:
//   PORT           default 3000
//   DATABASE_PATH  default ./data/mera-bharat.db
//   ADMIN_USER     default "admin"
//   ADMIN_PASSWORD default "merabharat-admin" (change before any deploy)

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'mera-bharat.db');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'merabharat-admin';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    where_to TEXT NOT NULL,
    how_many TEXT NOT NULL,
    arrivals TEXT NOT NULL,
    leaving TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const app = express();
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function clean(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

// --- Public API ----------------------------------------------------------

app.post('/api/bookings', (req, res) => {
  const whereTo = clean(req.body.where_to, 200);
  const howMany = clean(req.body.how_many, 50);
  const arrivals = clean(req.body.arrivals, 20);
  const leaving = clean(req.body.leaving, 20);
  const details = clean(req.body.details, 1000);

  if (!whereTo || !howMany || !arrivals || !leaving) {
    return res.status(400).json({ ok: false, error: 'Please fill all required fields.' });
  }
  if (isNaN(Date.parse(arrivals)) || isNaN(Date.parse(leaving))) {
    return res.status(400).json({ ok: false, error: 'Please enter valid dates.' });
  }

  const info = db
    .prepare('INSERT INTO bookings (where_to, how_many, arrivals, leaving, details) VALUES (?, ?, ?, ?, ?)')
    .run(whereTo, howMany, arrivals, leaving, details);
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid), message: 'Booking received! We will contact you soon.' });
});

app.post('/api/contacts', (req, res) => {
  const name = clean(req.body.name, 200);
  const email = clean(req.body.email, 200);
  const message = clean(req.body.message, 2000);

  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Name and email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  const info = db
    .prepare('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)')
    .run(name, email, message);
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid), message: 'Message sent! Thank you for reaching out.' });
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

app.post('/api/signups', (req, res) => {
  const name = clean(req.body.name, 200);
  const email = clean(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, error: 'Name, email and password are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' });
  }

  try {
    const info = db
      .prepare('INSERT INTO signups (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name, email, hashPassword(password));
    res.status(201).json({ ok: true, id: Number(info.lastInsertRowid), message: 'Account created! You are signed up.' });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'This email is already signed up.' });
    }
    throw err;
  }
});

// --- Admin (Basic Auth) --------------------------------------------------

function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (user === ADMIN_USER && pass === ADMIN_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Mera Bharat Admin"');
  res.status(401).send('Authentication required.');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function rowsToHtml(rows, cols) {
  if (rows.length === 0) return '<p class="empty">No submissions yet.</p>';
  const head = cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const body = rows
    .map((r) => '<tr>' + cols.map((c) => `<td>${escapeHtml(r[c.key] ?? '')}</td>`).join('') + '</tr>')
    .join('\n');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

app.get('/admin', adminAuth, (req, res) => {
  const bookings = db.prepare('SELECT * FROM bookings ORDER BY id DESC').all();
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY id DESC').all();
  const signups = db.prepare('SELECT id, name, email, created_at FROM signups ORDER BY id DESC').all();
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mera Bharat — Admin</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;background:#f9f9f9;color:#222}
  header{background:#0cc6ad;color:#fff;padding:16px 24px}
  header h1{margin:0;font-size:1.4rem}
  main{padding:24px;max-width:1100px;margin:0 auto}
  h2{margin-top:32px}
  table{width:100%;border-collapse:collapse;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15)}
  th,td{padding:10px 12px;border-bottom:1px solid #eee;text-align:left;font-size:.95rem;vertical-align:top}
  th{background:#0cc6ad;color:#fff}
  tr:hover td{background:#f2fbfa}
  .empty{color:#777}
  .count{color:#555;font-weight:normal;font-size:.9rem}
</style>
</head>
<body>
<header><h1>Mera Bharat — Admin Panel</h1></header>
<main>
  <h2>Bookings <span class="count">(${bookings.length})</span></h2>
  ${rowsToHtml(bookings, [
    { key: 'id', label: 'ID' },
    { key: 'where_to', label: 'Where To' },
    { key: 'how_many', label: 'How Many' },
    { key: 'arrivals', label: 'Arrival' },
    { key: 'leaving', label: 'Leaving' },
    { key: 'details', label: 'Name & Details' },
    { key: 'created_at', label: 'Submitted (UTC)' },
  ])}
  <h2>Contact Messages <span class="count">(${contacts.length})</span></h2>
  ${rowsToHtml(contacts, [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'message', label: 'Message' },
    { key: 'created_at', label: 'Submitted (UTC)' },
  ])}
  <h2>Sign Ups <span class="count">(${signups.length})</span></h2>
  ${rowsToHtml(signups, [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'created_at', label: 'Signed Up (UTC)' },
  ])}
</main>
</body>
</html>`);
});

app.get('/api/bookings', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM bookings ORDER BY id DESC').all());
});
app.get('/api/contacts', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM contacts ORDER BY id DESC').all());
});
app.get('/api/signups', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT id, name, email, created_at FROM signups ORDER BY id DESC').all());
});

app.listen(PORT, () => {
  console.log(`Mera Bharat server running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin (user: ${ADMIN_USER})`);
});
