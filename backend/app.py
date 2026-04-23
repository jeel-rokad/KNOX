"""
============================================
KNOX — Backend API Server (Python / Flask)
India's Unified Google Cloud Event Platform
Uses SQLite3 (built-in Python module)
============================================

Usage:
    pip install -r requirements.txt
    python app.py

This is a Python alternative to the Node.js server.js.
Both serve the same API endpoints and share the same knox.db database.
Run EITHER server.js OR app.py — not both at the same time.
"""

import os
import json
import sqlite3
import uuid
import base64
import io
import random
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import jwt
import bcrypt
import qrcode
from PIL import Image

# ─── Configuration ───────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'knox.db')
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), 'frontend')
PORT = int(os.environ.get('PORT', 8080))
JWT_SECRET = 'knox-secret-key-2026-india-platform'

app = Flask(__name__, static_folder=None)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ─── Database Helpers ────────────────────────────────────
def get_db():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def dict_row(row):
    """Convert a sqlite3.Row to a dictionary."""
    if row is None:
        return None
    return dict(row)


def dict_rows(rows):
    """Convert a list of sqlite3.Row to list of dicts."""
    return [dict(r) for r in rows]


# ─── Database Initialization ────────────────────────────
def init_db():
    """Create all tables if they don't exist."""
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            avatar_color TEXT DEFAULT 'linear-gradient(135deg,#4285f4,#00d4ff)',
            total_points INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

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
        );

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
        );

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
        );

        CREATE TABLE IF NOT EXISTS check_ins (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            event_id TEXT NOT NULL,
            points_awarded INTEGER DEFAULT 50,
            check_in_time TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (event_id) REFERENCES events(id)
        );

        CREATE TABLE IF NOT EXISTS connections (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            connected_user_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (connected_user_id) REFERENCES users(id)
        );

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
        );

        CREATE TABLE IF NOT EXISTS highlight_likes (
            user_id TEXT NOT NULL,
            highlight_id TEXT NOT NULL,
            PRIMARY KEY (user_id, highlight_id)
        );
    """)
    db.commit()
    db.close()
    print('  [OK] Database initialized')


# ─── Auth Middleware ─────────────────────────────────────
def auth_required(f):
    """Decorator that requires a valid JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            request.user_id = decoded['id']
            request.user_email = decoded['email']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    """Decorator that optionally decodes JWT if present."""
    @wraps(f)
    def decorated(*args, **kwargs):
        request.user_id = None
        request.user_email = None
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if token:
            try:
                decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
                request.user_id = decoded['id']
                request.user_email = decoded['email']
            except Exception:
                pass
        return f(*args, **kwargs)
    return decorated


# ─── HEALTH CHECK ────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'service': 'knox-backend', 'version': '1.0.0'})


# ─── AUTH ROUTES ─────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('full_name')
        phone = data.get('phone', '')

        if not email or not password or not full_name:
            return jsonify({'error': 'Email, password, and full name are required'}), 400
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        db = get_db()
        existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if existing:
            db.close()
            return jsonify({'error': 'Email already registered'}), 409

        user_id = str(uuid.uuid4())
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        colors = [
            'linear-gradient(135deg,#4285f4,#00d4ff)',
            'linear-gradient(135deg,#00e676,#00bfa5)',
            'linear-gradient(135deg,#a855f7,#6366f1)',
            'linear-gradient(135deg,#ff9800,#ff5722)',
            'linear-gradient(135deg,#e91e63,#c2185b)',
            'linear-gradient(135deg,#00bcd4,#0097a7)'
        ]
        avatar_color = random.choice(colors)

        db.execute(
            'INSERT INTO users (id, email, password_hash, full_name, phone, avatar_color) VALUES (?,?,?,?,?,?)',
            (user_id, email, password_hash, full_name, phone, avatar_color)
        )
        db.commit()

        token = jwt.encode({'id': user_id, 'email': email}, JWT_SECRET, algorithm='HS256')

        db.close()
        return jsonify({
            'token': token,
            'user': {
                'id': user_id, 'email': email, 'full_name': full_name,
                'phone': phone, 'avatar_color': avatar_color, 'total_points': 0
            }
        })
    except Exception as e:
        print(f'Register error: {e}')
        return jsonify({'error': 'Server error'}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        db = get_db()
        user = dict_row(db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone())
        if not user:
            db.close()
            return jsonify({'error': 'Invalid email or password'}), 401

        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            db.close()
            return jsonify({'error': 'Invalid email or password'}), 401

        token = jwt.encode({'id': user['id'], 'email': user['email']}, JWT_SECRET, algorithm='HS256')

        db.close()
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'], 'email': user['email'], 'full_name': user['full_name'],
                'phone': user['phone'], 'avatar_color': user['avatar_color'],
                'total_points': user['total_points']
            }
        })
    except Exception as e:
        print(f'Login error: {e}')
        return jsonify({'error': 'Server error'}), 500


@app.route('/api/auth/me', methods=['GET'])
@auth_required
def get_me():
    db = get_db()
    user = dict_row(db.execute(
        'SELECT id, email, full_name, phone, avatar_color, total_points, created_at FROM users WHERE id = ?',
        (request.user_id,)
    ).fetchone())
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404

    bookings_count = db.execute('SELECT COUNT(*) as c FROM bookings WHERE user_id = ?', (request.user_id,)).fetchone()['c']
    connections_count = db.execute(
        'SELECT COUNT(*) as c FROM connections WHERE user_id = ? OR connected_user_id = ?',
        (request.user_id, request.user_id)
    ).fetchone()['c']
    checkins_count = db.execute('SELECT COUNT(*) as c FROM check_ins WHERE user_id = ?', (request.user_id,)).fetchone()['c']

    all_users = [dict_row(r) for r in db.execute('SELECT id FROM users ORDER BY total_points DESC').fetchall()]
    rank = next((i + 1 for i, u in enumerate(all_users) if u['id'] == request.user_id), 0)

    db.close()
    return jsonify({
        **user,
        'bookings_count': bookings_count,
        'connections_count': connections_count,
        'checkins_count': checkins_count,
        'rank': rank
    })


# ─── EVENT ROUTES ────────────────────────────────────────

@app.route('/api/events', methods=['GET'])
def get_events():
    event_type = request.args.get('type')
    category = request.args.get('category')

    query = 'SELECT * FROM events'
    conditions = []
    params = []

    if event_type and event_type != 'all':
        conditions.append('event_type = ?')
        params.append(event_type)
    if category and category != 'all':
        conditions.append('category = ?')
        params.append(category)

    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
    query += ' ORDER BY start_date ASC'

    db = get_db()
    events = dict_rows(db.execute(query, params).fetchall())
    db.close()

    for e in events:
        e['tags'] = json.loads(e.get('tags') or '[]')
        e['speakers'] = json.loads(e.get('speakers') or '[]')

    return jsonify(events)


@app.route('/api/events/<event_id>', methods=['GET'])
def get_event(event_id):
    db = get_db()
    event = dict_row(db.execute('SELECT * FROM events WHERE id = ?', (event_id,)).fetchone())
    if not event:
        db.close()
        return jsonify({'error': 'Event not found'}), 404

    event['tags'] = json.loads(event.get('tags') or '[]')
    event['speakers'] = json.loads(event.get('speakers') or '[]')

    schedule = dict_rows(db.execute(
        'SELECT * FROM schedules WHERE event_id = ? ORDER BY day, time_slot', (event_id,)
    ).fetchall())
    event['schedule'] = schedule

    db.close()
    return jsonify(event)


# ─── BOOKING ROUTES ──────────────────────────────────────

@app.route('/api/bookings', methods=['POST'])
@auth_required
def create_booking():
    try:
        data = request.get_json()
        event_id = data.get('event_id')
        ticket_type = data.get('ticket_type', 'General')

        if not event_id:
            return jsonify({'error': 'event_id is required'}), 400

        db = get_db()
        event = dict_row(db.execute('SELECT * FROM events WHERE id = ?', (event_id,)).fetchone())
        if not event:
            db.close()
            return jsonify({'error': 'Event not found'}), 404

        existing = db.execute(
            'SELECT id FROM bookings WHERE user_id = ? AND event_id = ?',
            (request.user_id, event_id)
        ).fetchone()
        if existing:
            db.close()
            return jsonify({'error': 'Already booked for this event'}), 409

        if event['registered'] >= event['capacity'] and event['capacity'] < 999999:
            db.close()
            return jsonify({'error': 'Event is full'}), 400

        booking_id = str(uuid.uuid4())
        qr_data = f"KNOX-{event_id}-{request.user_id}-{int(datetime.now().timestamp() * 1000)}"

        # Generate QR code as data URL (with proper RGBA transparent background)
        qr = qrcode.QRCode(version=1, box_size=8, border=2)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color='white', back_color='black')
        # Convert to RGBA for proper PNG handling
        img = img.convert('RGBA')

        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        qr_code_data_url = f'data:image/png;base64,{qr_base64}'

        db.execute(
            'INSERT INTO bookings (id, user_id, event_id, qr_code, ticket_type) VALUES (?,?,?,?,?)',
            (booking_id, request.user_id, event_id, qr_code_data_url, ticket_type)
        )
        db.execute('UPDATE events SET registered = registered + 1 WHERE id = ?', (event_id,))
        db.commit()
        db.close()

        return jsonify({
            'id': booking_id,
            'event_id': event_id,
            'event_title': event['title'],
            'event_date': event['start_date'],
            'venue': event['venue_name'],
            'city': event['city'],
            'ticket_type': ticket_type,
            'qr_code': qr_code_data_url
        })
    except Exception as e:
        print(f'Booking error: {e}')
        return jsonify({'error': 'Server error'}), 500


@app.route('/api/bookings', methods=['GET'])
@auth_required
def get_bookings():
    db = get_db()
    bookings = dict_rows(db.execute("""
        SELECT b.id, b.user_id, b.event_id, b.booking_time, b.qr_code, b.checked_in, b.ticket_type,
               e.title as event_title, e.start_date, e.end_date, e.venue_name, e.city,
               e.event_type, e.category, e.ticket_price
        FROM bookings b JOIN events e ON b.event_id = e.id
        WHERE b.user_id = ? ORDER BY e.start_date ASC
    """, (request.user_id,)).fetchall())
    db.close()
    return jsonify(bookings)


# ─── CHECK-IN & POINTS ──────────────────────────────────

@app.route('/api/checkin', methods=['POST'])
@auth_required
def checkin():
    try:
        data = request.get_json()
        event_id = data.get('event_id')
        if not event_id:
            return jsonify({'error': 'event_id is required'}), 400

        db = get_db()
        booking = db.execute(
            'SELECT * FROM bookings WHERE user_id = ? AND event_id = ?',
            (request.user_id, event_id)
        ).fetchone()
        if not booking:
            db.close()
            return jsonify({'error': 'No booking found for this event'}), 400

        existing_checkin = db.execute(
            'SELECT * FROM check_ins WHERE user_id = ? AND event_id = ?',
            (request.user_id, event_id)
        ).fetchone()
        if existing_checkin:
            db.close()
            return jsonify({'error': 'Already checked in'}), 409

        event = dict_row(db.execute('SELECT * FROM events WHERE id = ?', (event_id,)).fetchone())
        points = 50 if event['event_type'] == 'Offline' else 20

        # Early bird bonus
        try:
            event_start = datetime.fromisoformat(event['start_date'])
        except ValueError:
            event_start = datetime.strptime(event['start_date'], '%Y-%m-%dT%H:%M:%S')
        now = datetime.now()
        if now <= event_start + timedelta(hours=1):
            points += 10

        checkin_id = str(uuid.uuid4())
        db.execute(
            'INSERT INTO check_ins (id, user_id, event_id, points_awarded) VALUES (?,?,?,?)',
            (checkin_id, request.user_id, event_id, points)
        )
        db.execute('UPDATE bookings SET checked_in = 1 WHERE user_id = ? AND event_id = ?', (request.user_id, event_id))
        db.execute('UPDATE users SET total_points = total_points + ? WHERE id = ?', (points, request.user_id))
        db.commit()

        user = dict_row(db.execute('SELECT total_points FROM users WHERE id = ?', (request.user_id,)).fetchone())
        db.close()

        return jsonify({'points_awarded': points, 'total_points': user['total_points']})
    except Exception as e:
        print(f'Check-in error: {e}')
        return jsonify({'error': 'Server error'}), 500


# ─── CONNECTIONS ─────────────────────────────────────────

@app.route('/api/connections', methods=['POST'])
@auth_required
def create_connection():
    try:
        data = request.get_json()
        user_email = data.get('user_email')
        if not user_email:
            return jsonify({'error': 'user_email is required'}), 400

        db = get_db()
        target = dict_row(db.execute(
            'SELECT id, email, full_name, avatar_color, total_points FROM users WHERE email = ?',
            (user_email,)
        ).fetchone())
        if not target:
            db.close()
            return jsonify({'error': 'User not found with that email'}), 404
        if target['id'] == request.user_id:
            db.close()
            return jsonify({'error': 'Cannot connect with yourself'}), 400

        existing = db.execute(
            'SELECT id FROM connections WHERE (user_id = ? AND connected_user_id = ?) OR (user_id = ? AND connected_user_id = ?)',
            (request.user_id, target['id'], target['id'], request.user_id)
        ).fetchone()
        if existing:
            db.close()
            return jsonify({'error': 'Already connected'}), 409

        conn_id = str(uuid.uuid4())
        db.execute('INSERT INTO connections (id, user_id, connected_user_id) VALUES (?,?,?)',
                   (conn_id, request.user_id, target['id']))
        db.execute('UPDATE users SET total_points = total_points + 5 WHERE id = ?', (request.user_id,))
        db.execute('UPDATE users SET total_points = total_points + 5 WHERE id = ?', (target['id'],))
        db.commit()
        db.close()

        return jsonify({'message': 'Connected!', 'connection': target})
    except Exception as e:
        print(f'Connection error: {e}')
        return jsonify({'error': 'Server error'}), 500


@app.route('/api/connections', methods=['GET'])
@auth_required
def get_connections():
    db = get_db()
    connections = dict_rows(db.execute("""
        SELECT u.id, u.email, u.full_name, u.avatar_color, u.total_points
        FROM connections c
        JOIN users u ON (u.id = CASE WHEN c.user_id = ? THEN c.connected_user_id ELSE c.user_id END)
        WHERE c.user_id = ? OR c.connected_user_id = ?
    """, (request.user_id, request.user_id, request.user_id)).fetchall())
    db.close()
    return jsonify(connections)


# ─── LEADERBOARD ─────────────────────────────────────────

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    db = get_db()
    users = dict_rows(db.execute("""
        SELECT u.id, u.full_name, u.avatar_color, u.total_points,
            (SELECT COUNT(*) FROM check_ins WHERE user_id = u.id) as events_attended,
            (SELECT COUNT(*) FROM connections WHERE user_id = u.id OR connected_user_id = u.id) as connections_count
        FROM users u
        ORDER BY u.total_points DESC
        LIMIT 50
    """).fetchall())
    db.close()
    return jsonify(users)


# ─── HIGHLIGHTS ──────────────────────────────────────────

@app.route('/api/highlights', methods=['GET'])
@optional_auth
def get_highlights():
    db = get_db()
    highlights = dict_rows(db.execute('SELECT * FROM highlights ORDER BY created_at DESC').fetchall())

    if request.user_id:
        user_likes = db.execute(
            'SELECT highlight_id FROM highlight_likes WHERE user_id = ?', (request.user_id,)
        ).fetchall()
        liked_set = {r['highlight_id'] for r in user_likes}
        for h in highlights:
            h['user_liked'] = h['id'] in liked_set

    db.close()
    return jsonify(highlights)


@app.route('/api/highlights/<highlight_id>/like', methods=['POST'])
@auth_required
def toggle_like(highlight_id):
    db = get_db()
    existing = db.execute(
        'SELECT * FROM highlight_likes WHERE user_id = ? AND highlight_id = ?',
        (request.user_id, highlight_id)
    ).fetchone()

    if existing:
        db.execute('DELETE FROM highlight_likes WHERE user_id = ? AND highlight_id = ?',
                   (request.user_id, highlight_id))
        db.execute('UPDATE highlights SET likes = likes - 1 WHERE id = ?', (highlight_id,))
    else:
        db.execute('INSERT INTO highlight_likes (user_id, highlight_id) VALUES (?,?)',
                   (request.user_id, highlight_id))
        db.execute('UPDATE highlights SET likes = likes + 1 WHERE id = ?', (highlight_id,))
    db.commit()

    highlight = dict_row(db.execute('SELECT likes FROM highlights WHERE id = ?', (highlight_id,)).fetchone())
    db.close()

    return jsonify({'likes': highlight['likes'] if highlight else 0, 'liked': not existing})


# ─── ATTENDANCE HISTORY ──────────────────────────────────

@app.route('/api/attendance', methods=['GET'])
@auth_required
def get_attendance():
    db = get_db()
    history = dict_rows(db.execute("""
        SELECT c.points_awarded, c.check_in_time, e.title as event_title,
               e.city, e.event_type, e.category
        FROM check_ins c JOIN events e ON c.event_id = e.id
        WHERE c.user_id = ?
        ORDER BY c.check_in_time DESC
    """, (request.user_id,)).fetchall())
    db.close()
    return jsonify(history)


# ─── SCHEDULE ROUTES ─────────────────────────────────────

@app.route('/api/events/<event_id>/schedule', methods=['GET'])
def get_schedule(event_id):
    db = get_db()
    schedule = dict_rows(db.execute(
        'SELECT * FROM schedules WHERE event_id = ? ORDER BY day, time_slot', (event_id,)
    ).fetchall())
    db.close()
    return jsonify(schedule)


# ─── Serve Frontend ──────────────────────────────────────

@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/asset/<path:filename>')
def serve_asset(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'asset'), filename)


@app.errorhandler(404)
def not_found(e):
    """Catch-all: serve frontend for non-API routes (SPA support)."""
    if not request.path.startswith('/api'):
        try:
            return send_from_directory(FRONTEND_DIR, 'index.html')
        except Exception:
            pass
    return jsonify({'error': 'Not found'}), 404


# ─── START ───────────────────────────────────────────────

# Initialize database on import (for gunicorn compatibility)
init_db()

if __name__ == '__main__':
    print()
    print('  +========================================+')
    print('  |   KNOX -- India\'s Event Platform       |')
    print(f'  |   Flask server on port {PORT}            |')
    print(f'  |   http://localhost:{PORT}               |')
    print('  +========================================+')
    print()
    app.run(host='0.0.0.0', port=PORT, debug=True)
