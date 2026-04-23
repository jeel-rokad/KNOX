-- ============================================
-- KNOX PLATFORM — Database Schema (PostgreSQL)
-- India's Unified Event Platform
-- ============================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    total_points INT DEFAULT 0,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Events table (Offline + Online)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) CHECK (event_type IN ('Offline', 'Online')) NOT NULL,
    category VARCHAR(50) CHECK (category IN (
        'Summit', 'Community Day', 'DevFest', 'Build with AI',
        'Workshop', 'Hackathon', 'Next', 'IO', 'Webinar'
    )) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    venue_name VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    ticket_price VARCHAR(50) DEFAULT 'Free',
    is_paid BOOLEAN DEFAULT FALSE,
    capacity INT DEFAULT 0,
    external_ticket_url TEXT,
    tags TEXT[], -- PostgreSQL array for tags
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Bookings table (Ticket Counter)
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    ticket_type VARCHAR(100) DEFAULT 'General',
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    qr_code TEXT, -- Generated QR code data
    checked_in BOOLEAN DEFAULT FALSE,
    booking_time TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Check-ins table (Attendance tracking)
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    points_awarded INT DEFAULT 50,
    early_bonus BOOLEAN DEFAULT FALSE, -- +10 if within first hour
    check_in_time TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Connections (Mutual follows between users)
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    connected_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, connected_user_id)
);

-- Event Schedules (Timeline items per event)
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    day_number INT DEFAULT 1,
    time_slot VARCHAR(50) NOT NULL,
    session_title VARCHAR(255) NOT NULL,
    session_description TEXT,
    session_type VARCHAR(50) CHECK (session_type IN (
        'Opening', 'Keynote', 'Talk', 'Workshop',
        'Break', 'Panel', 'Closing', 'Hackathon'
    )),
    speaker_name VARCHAR(255),
    room_location VARCHAR(100),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Event Highlights (Past event gallery)
CREATE TABLE highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    video_url TEXT, -- YouTube embed URL
    uploaded_by UUID REFERENCES users(id),
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Highlight Likes
CREATE TABLE highlight_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    highlight_id UUID REFERENCES highlights(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(highlight_id, user_id)
);

-- Points Ledger (Audit trail for all point transactions)
CREATE TABLE points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'event_attend', 'online_attend', 'connection', 'referral', 'highlight_post'
    points INT NOT NULL,
    reference_id UUID, -- event_id, connection_id, etc.
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_city ON events(city);
CREATE INDEX idx_events_dates ON events(start_date, end_date);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_event ON bookings(event_id);
CREATE INDEX idx_checkins_user ON check_ins(user_id);
CREATE INDEX idx_connections_user ON connections(user_id);
CREATE INDEX idx_points_user ON points_ledger(user_id);
CREATE INDEX idx_schedules_event ON schedules(event_id);
CREATE INDEX idx_highlights_event ON highlights(event_id);

-- Views for leaderboard
CREATE OR REPLACE VIEW leaderboard AS
SELECT
    u.id,
    u.full_name,
    u.total_points,
    COUNT(DISTINCT ci.event_id) AS events_attended,
    COUNT(DISTINCT co.connected_user_id) AS connections_count
FROM users u
LEFT JOIN check_ins ci ON ci.user_id = u.id
LEFT JOIN connections co ON co.user_id = u.id
GROUP BY u.id, u.full_name, u.total_points
ORDER BY u.total_points DESC;
