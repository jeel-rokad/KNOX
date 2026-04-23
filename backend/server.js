/* ============================================
   KNOX — Backend API Server
   India's Unified Google Cloud Event Platform
   Uses sql.js (pure JS SQLite — no native build)
   ============================================ */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = 'knox-secret-key-2026-india-platform';
const DB_PATH = path.join(__dirname, 'knox.db');

let db; // Will be initialized async

// ─── Save DB to disk periodically ──────────────────────
function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Auto-save every 30 seconds
setInterval(saveDB, 30000);

// ─── Database Setup ─────────────────────────────────────
async function initDB() {
  const SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Initialize schema
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      avatar_color TEXT DEFAULT 'linear-gradient(135deg,#4285f4,#00d4ff)',
      total_points INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT CHECK(event_type IN ('Offline','Online')) NOT NULL,
      category TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      venue_name TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      latitude REAL,
      longitude REAL,
      ticket_price TEXT DEFAULT 'Free',
      is_paid INTEGER DEFAULT 0,
      capacity INTEGER DEFAULT 1000,
      registered INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      speakers TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      day INTEGER DEFAULT 1,
      time_slot TEXT NOT NULL,
      session_name TEXT NOT NULL,
      session_type TEXT DEFAULT 'Talk',
      speaker TEXT DEFAULT '',
      room TEXT DEFAULT '',
      FOREIGN KEY (event_id) REFERENCES events(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      booking_time TEXT DEFAULT (datetime('now')),
      qr_code TEXT,
      checked_in INTEGER DEFAULT 0,
      ticket_type TEXT DEFAULT 'General',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      points_awarded INTEGER DEFAULT 50,
      check_in_time TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      connected_user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (connected_user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      event_title TEXT NOT NULL,
      description TEXT,
      emoji TEXT DEFAULT '📸',
      image_url TEXT,
      video_url TEXT,
      stats_attendees INTEGER DEFAULT 0,
      stats_speakers INTEGER DEFAULT 0,
      stats_workshops INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS highlight_likes (
      user_id TEXT NOT NULL,
      highlight_id TEXT NOT NULL,
      PRIMARY KEY (user_id, highlight_id)
    )
  `);

  saveDB();
  console.log('  ✅ Database initialized');
}

// ─── Helper: query one row ──────────────────────────────
function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row = {};
    cols.forEach((c, i) => row[c] = vals[i]);
    return row;
  }
  stmt.free();
  return null;
}

// ─── Helper: query all rows ─────────────────────────────
function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  const cols = stmt.getColumnNames();
  while (stmt.step()) {
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => row[c] = vals[i]);
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// ─── Helper: run statement ──────────────────────────────
function run(sql, params = []) {
  db.run(sql, params);
}

// ─── Middleware ──────────────────────────────────────────
app.use(cors({
  origin: [
    'https://knox-83b91.web.app',
    'https://knox-83b91.firebaseapp.com',
    'http://localhost:3000'
  ]
}));
app.use(express.json());
// Health check route
app.get('/', (req, res) => {
  res.json({ status: 'KNOX Backend is running ✅' });
});


// ─── Auth Middleware ────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id;
      req.userEmail = decoded.email;
    } catch (e) { /* ignore */ }
  }
  next();
}

// ─── AUTH ROUTES ────────────────────────────────────────

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = getOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);
    const colors = [
      'linear-gradient(135deg,#4285f4,#00d4ff)',
      'linear-gradient(135deg,#00e676,#00bfa5)',
      'linear-gradient(135deg,#a855f7,#6366f1)',
      'linear-gradient(135deg,#ff9800,#ff5722)',
      'linear-gradient(135deg,#e91e63,#c2185b)',
      'linear-gradient(135deg,#00bcd4,#0097a7)'
    ];
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];

    run('INSERT INTO users (id, email, password_hash, full_name, phone, avatar_color) VALUES (?,?,?,?,?,?)',
      [id, email, password_hash, full_name, phone || '', avatar_color]);
    saveDB();

    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: { id, email, full_name, phone: phone || '', avatar_color, total_points: 0 }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = getOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id, email: user.email, full_name: user.full_name,
        phone: user.phone, avatar_color: user.avatar_color,
        total_points: user.total_points
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user profile
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = getOne('SELECT id, email, full_name, phone, avatar_color, total_points, created_at FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const bookingsRow = getOne('SELECT COUNT(*) as c FROM bookings WHERE user_id = ?', [req.userId]);
  const connectionsRow = getOne('SELECT COUNT(*) as c FROM connections WHERE user_id = ? OR connected_user_id = ?', [req.userId, req.userId]);
  const checkinsRow = getOne('SELECT COUNT(*) as c FROM check_ins WHERE user_id = ?', [req.userId]);

  // Calculate rank
  const allUsers = getAll('SELECT id FROM users ORDER BY total_points DESC');
  const rank = allUsers.findIndex(u => u.id === req.userId) + 1;

  res.json({
    ...user,
    bookings_count: bookingsRow ? bookingsRow.c : 0,
    connections_count: connectionsRow ? connectionsRow.c : 0,
    checkins_count: checkinsRow ? checkinsRow.c : 0,
    rank
  });
});

// ─── EVENT ROUTES ───────────────────────────────────────

// Get all events
app.get('/api/events', (req, res) => {
  const { type, category } = req.query;
  let query = 'SELECT * FROM events';
  const conditions = [];
  const params = [];

  if (type && type !== 'all') {
    conditions.push('event_type = ?');
    params.push(type);
  }
  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY start_date ASC';

  const events = getAll(query, params);
  events.forEach(e => {
    e.tags = JSON.parse(e.tags || '[]');
    e.speakers = JSON.parse(e.speakers || '[]');
  });
  res.json(events);
});

// Get single event with schedule
app.get('/api/events/:id', (req, res) => {
  const event = getOne('SELECT * FROM events WHERE id = ?', [req.params.id]);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  event.tags = JSON.parse(event.tags || '[]');
  event.speakers = JSON.parse(event.speakers || '[]');

  const schedule = getAll('SELECT * FROM schedules WHERE event_id = ? ORDER BY day, time_slot', [req.params.id]);
  event.schedule = schedule;

  res.json(event);
});

// ─── BOOKING ROUTES ─────────────────────────────────────

// Book a ticket
app.post('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { event_id, ticket_type } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });

    const event = getOne('SELECT * FROM events WHERE id = ?', [event_id]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check if already booked
    const existing = getOne('SELECT id FROM bookings WHERE user_id = ? AND event_id = ?', [req.userId, event_id]);
    if (existing) return res.status(409).json({ error: 'Already booked for this event' });

    // Check capacity
    if (event.registered >= event.capacity && event.capacity < 999999) {
      return res.status(400).json({ error: 'Event is full' });
    }

    const bookingId = uuidv4();
    const qrData = `KNOX-${event_id}-${req.userId}-${Date.now()}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: { dark: '#ffffff', light: '#00000000' }
    });

    run('INSERT INTO bookings (id, user_id, event_id, qr_code, ticket_type) VALUES (?,?,?,?,?)',
      [bookingId, req.userId, event_id, qrCodeDataUrl, ticket_type || 'General']);

    // Increment registered count
    run('UPDATE events SET registered = registered + 1 WHERE id = ?', [event_id]);
    saveDB();

    res.json({
      id: bookingId,
      event_id,
      event_title: event.title,
      event_date: event.start_date,
      venue: event.venue_name,
      city: event.city,
      ticket_type: ticket_type || 'General',
      qr_code: qrCodeDataUrl
    });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's bookings
app.get('/api/bookings', authMiddleware, (req, res) => {
  const bookings = getAll(`
    SELECT b.id, b.user_id, b.event_id, b.booking_time, b.qr_code, b.checked_in, b.ticket_type,
           e.title as event_title, e.start_date, e.end_date, e.venue_name, e.city, e.event_type, e.category, e.ticket_price
    FROM bookings b JOIN events e ON b.event_id = e.id
    WHERE b.user_id = ? ORDER BY e.start_date ASC
  `, [req.userId]);
  res.json(bookings);
});

// ─── CHECK-IN & POINTS ─────────────────────────────────

app.post('/api/checkin', authMiddleware, (req, res) => {
  try {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });

    const booking = getOne('SELECT * FROM bookings WHERE user_id = ? AND event_id = ?', [req.userId, event_id]);
    if (!booking) return res.status(400).json({ error: 'No booking found for this event' });

    const existingCheckin = getOne('SELECT * FROM check_ins WHERE user_id = ? AND event_id = ?', [req.userId, event_id]);
    if (existingCheckin) return res.status(409).json({ error: 'Already checked in' });

    const event = getOne('SELECT * FROM events WHERE id = ?', [event_id]);
    let points = event.event_type === 'Offline' ? 50 : 20;

    // Early bird bonus
    const eventStart = new Date(event.start_date);
    const now = new Date();
    if (now <= new Date(eventStart.getTime() + 60 * 60 * 1000)) {
      points += 10;
    }

    const checkinId = uuidv4();
    run('INSERT INTO check_ins (id, user_id, event_id, points_awarded) VALUES (?,?,?,?)', [checkinId, req.userId, event_id, points]);
    run('UPDATE bookings SET checked_in = 1 WHERE user_id = ? AND event_id = ?', [req.userId, event_id]);
    run('UPDATE users SET total_points = total_points + ? WHERE id = ?', [points, req.userId]);
    saveDB();

    const user = getOne('SELECT total_points FROM users WHERE id = ?', [req.userId]);
    res.json({ points_awarded: points, total_points: user.total_points });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── CONNECTIONS ────────────────────────────────────────

app.post('/api/connections', authMiddleware, (req, res) => {
  try {
    const { user_email } = req.body;
    if (!user_email) return res.status(400).json({ error: 'user_email is required' });

    const targetUser = getOne('SELECT id, email, full_name, avatar_color, total_points FROM users WHERE email = ?', [user_email]);
    if (!targetUser) return res.status(404).json({ error: 'User not found with that email' });
    if (targetUser.id === req.userId) return res.status(400).json({ error: 'Cannot connect with yourself' });

    const existing = getOne('SELECT id FROM connections WHERE (user_id = ? AND connected_user_id = ?) OR (user_id = ? AND connected_user_id = ?)',
      [req.userId, targetUser.id, targetUser.id, req.userId]);
    if (existing) return res.status(409).json({ error: 'Already connected' });

    const connId = uuidv4();
    run('INSERT INTO connections (id, user_id, connected_user_id) VALUES (?,?,?)', [connId, req.userId, targetUser.id]);

    // Award points to both users
    run('UPDATE users SET total_points = total_points + 5 WHERE id = ?', [req.userId]);
    run('UPDATE users SET total_points = total_points + 5 WHERE id = ?', [targetUser.id]);
    saveDB();

    res.json({ message: 'Connected!', connection: targetUser });
  } catch (err) {
    console.error('Connection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/connections', authMiddleware, (req, res) => {
  const connections = getAll(`
    SELECT u.id, u.email, u.full_name, u.avatar_color, u.total_points
    FROM connections c
    JOIN users u ON (u.id = CASE WHEN c.user_id = ? THEN c.connected_user_id ELSE c.user_id END)
    WHERE c.user_id = ? OR c.connected_user_id = ?
  `, [req.userId, req.userId, req.userId]);
  res.json(connections);
});

// ─── LEADERBOARD ────────────────────────────────────────

app.get('/api/leaderboard', (req, res) => {
  const users = getAll(`
    SELECT u.id, u.full_name, u.avatar_color, u.total_points,
      (SELECT COUNT(*) FROM check_ins WHERE user_id = u.id) as events_attended,
      (SELECT COUNT(*) FROM connections WHERE user_id = u.id OR connected_user_id = u.id) as connections_count
    FROM users u
    ORDER BY u.total_points DESC
    LIMIT 50
  `);
  res.json(users);
});

// ─── HIGHLIGHTS ─────────────────────────────────────────

app.get('/api/highlights', optionalAuth, (req, res) => {
  const highlights = getAll('SELECT * FROM highlights ORDER BY created_at DESC');

  if (req.userId) {
    const userLikes = getAll('SELECT highlight_id FROM highlight_likes WHERE user_id = ?', [req.userId]);
    const likedSet = new Set(userLikes.map(l => l.highlight_id));
    highlights.forEach(h => { h.user_liked = likedSet.has(h.id); });
  }

  res.json(highlights);
});

app.post('/api/highlights/:id/like', authMiddleware, (req, res) => {
  const highlightId = req.params.id;
  const existing = getOne('SELECT * FROM highlight_likes WHERE user_id = ? AND highlight_id = ?', [req.userId, highlightId]);

  if (existing) {
    run('DELETE FROM highlight_likes WHERE user_id = ? AND highlight_id = ?', [req.userId, highlightId]);
    run('UPDATE highlights SET likes = likes - 1 WHERE id = ?', [highlightId]);
  } else {
    run('INSERT INTO highlight_likes (user_id, highlight_id) VALUES (?,?)', [req.userId, highlightId]);
    run('UPDATE highlights SET likes = likes + 1 WHERE id = ?', [highlightId]);
  }
  saveDB();

  const highlight = getOne('SELECT likes FROM highlights WHERE id = ?', [highlightId]);
  res.json({ likes: highlight ? highlight.likes : 0, liked: !existing });
});

// ─── ATTENDANCE HISTORY ─────────────────────────────────

app.get('/api/attendance', authMiddleware, (req, res) => {
  const history = getAll(`
    SELECT c.points_awarded, c.check_in_time, e.title as event_title, e.city, e.event_type, e.category
    FROM check_ins c JOIN events e ON c.event_id = e.id
    WHERE c.user_id = ?
    ORDER BY c.check_in_time DESC
  `, [req.userId]);
  res.json(history);
});

// ─── SCHEDULE ROUTES ────────────────────────────────────

app.get('/api/events/:id/schedule', (req, res) => {
  const schedule = getAll('SELECT * FROM schedules WHERE event_id = ? ORDER BY day, time_slot', [req.params.id]);
  res.json(schedule);
});


// ─── START ──────────────────────────────────────────────
async function start() {
  await initDB();

  app.listen(PORT, () => {
    console.log(`\n  ╔════════════════════════════════════════╗`);
    console.log(`  ║   KNOX — India's Event Platform        ║`);
    console.log(`  ║   Server running on port ${PORT}           ║`);
    console.log(`  ║   http://localhost:${PORT}                ║`);
    console.log(`  ╚════════════════════════════════════════╝\n`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => { saveDB(); process.exit(0); });
process.on('SIGTERM', () => { saveDB(); process.exit(0); });

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
