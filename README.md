<div align="center">
  <h1>🌌 Knox Platform</h1>
  <p><strong>India's Unified Google Cloud Event Platform</strong></p>
  <p><em>Discover, Manage, and Experience Google Cloud Events across India</em></p>
  <p>🌍 <strong>Live Demo:</strong> <a href="https://knox-83b91.web.app">https://knox-83b91.web.app</a></p>
</div>

---

## 📖 Overview

**Knox** (also known as the Antigravity Project) is a production-ready, PWA-based event discovery and management platform tailored for the Google Cloud ecosystem in India. It provides a seamless, scalable, and premium dark-themed experience for both attendees and organizers.

Whether it's an offline summit, an interactive workshop, a hackathon, or an online webinar, Knox centralizes all events into a single, gamified, and highly interactive interface.

---

## ✨ Key Features

- **🎟️ Unified Event Aggregation**: Discover both online and offline Google Cloud events (Summits, I/O, Next, Workshops).
- **🕹️ Gamified "Knox Protocol"**: Earn points through attendance, social connections, and platform engagement via a dynamic leaderboard.
- **📱 Premium UX/UI**: A sleek, dark-themed interface featuring a responsive sidebar, timeline-based event schedules, and custom colored hover effects.
- **🎫 Smart Ticketing & QR**: Integrated ticket booking system with automatic QR code generation for seamless check-ins.
- **📍 Spatial Venue Maps**: Real-time venue mapping using the Google Maps API for easy navigation.
- **📊 Comprehensive Dashboard**: Manage your schedule, view attendance history, and engage with the community directly from your personalized dashboard.

---

## 🏗️ Architecture & Tech Stack

The Knox platform is built on a clean, decoupled two-tier architecture, designed for rapid deployment to Google Cloud and Firebase.

### 🎨 Frontend
- **Tech**: HTML5, Vanilla JavaScript, CSS3
- **Deployment**: Firebase Hosting & Dockerized Nginx
- **Highlights**: Environment variable management for API URLs, dynamic rendering of data, responsive and highly aesthetic interface.

### ⚙️ Backend
- **Tech**: Dual-runtime architecture supporting both **Node.js (Express)** and **Python (Flask)**.
- **Database**: SQLite (`knox.db`) shared across runtimes.
- **Deployment**: Google Cloud Run (configured for port `8080` with read-only file system handling).
- **Core Libraries**: `qrcode` (Ticket generation), `jsonwebtoken` & `bcrypt` (Authentication).

---

## 📂 Project Structure

```text
Knox/
├── frontend/               # User Interface & Static Assets
│   ├── index.html          # Main Entry Point
│   ├── asset/              # Images, CSS, JS
│   ├── firebase.json       # Firebase Hosting config
│   ├── nginx.conf          # Nginx config for Docker
│   └── Dockerfile          # Frontend containerization
│
└── backend/                # API Services & Database
    ├── server.js / index.js# Node.js Express entry points
    ├── app.py              # Python Flask entry point
    ├── knox.db             # SQLite database
    ├── package.json        # Node dependencies
    ├── requirements.txt    # Python dependencies
    └── Dockerfile          # Backend containerization
```

---

## ☁️ Deployment & Live Platform

The Knox Platform is fully deployed and accessible live. It utilizes a robust cloud-native architecture.

- **Frontend (Firebase)**
  - Hosted and deployed via **Firebase Hosting**.
  - **Live Link:** [https://knox-83b91.web.app](https://knox-83b91.web.app)

- **Backend (GCP)**
  - Containerized and deployed to **Google Cloud Run**.
  - Handles API requests seamlessly and securely without relying on local host environments.

---

## 🚀 Local Setup (Backend Only)

If you need to make changes to the backend APIs:

### Prerequisites
- [Node.js](https://nodejs.org/) (for Node backend)
- [Python 3.11+](https://www.python.org/) (for Python backend)
- [Docker](https://www.docker.com/) (Optional, for containerized run)

### Running the Backend

You can run the backend using either Node.js or Python.

**Option A: Node.js (Express)**
```bash
cd backend
npm install
npm run server  # Runs server.js on port 8080
```

**Option B: Python (Flask)**
```bash
cd backend
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py  # Runs Flask app on port 8080
```

### Running with Docker 🐳

**Backend:**
```bash
cd backend
docker build -t knox-backend .
docker run -p 8080:8080 knox-backend
```

---
