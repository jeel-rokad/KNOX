/* ============================================
   KNOX — Database Seed Script
   Uses sql.js (pure JS SQLite)
   ============================================ */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'knox.db');

async function seed() {
  console.log('🌱 Seeding Knox database...\n');

  const SQL = await initSqlJs();
  // Always create fresh
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  const db = new SQL.Database();

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, phone TEXT DEFAULT '', avatar_color TEXT DEFAULT '', total_points INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, event_type TEXT NOT NULL, category TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, venue_name TEXT, address TEXT, city TEXT, state TEXT, latitude REAL, longitude REAL, ticket_price TEXT DEFAULT 'Free', is_paid INTEGER DEFAULT 0, capacity INTEGER DEFAULT 1000, registered INTEGER DEFAULT 0, tags TEXT DEFAULT '[]', speakers TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, day INTEGER DEFAULT 1, time_slot TEXT NOT NULL, session_name TEXT NOT NULL, session_type TEXT DEFAULT 'Talk', speaker TEXT DEFAULT '', room TEXT DEFAULT '')`);
  db.run(`CREATE TABLE IF NOT EXISTS highlights (id TEXT PRIMARY KEY, event_title TEXT NOT NULL, description TEXT, emoji TEXT DEFAULT '', image_url TEXT DEFAULT '', stats_attendees INTEGER DEFAULT 0, stats_speakers INTEGER DEFAULT 0, stats_workshops INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, event_id TEXT NOT NULL, booking_time TEXT DEFAULT (datetime('now')), qr_code TEXT, checked_in INTEGER DEFAULT 0, ticket_type TEXT DEFAULT 'General')`);
  db.run(`CREATE TABLE IF NOT EXISTS check_ins (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, event_id TEXT NOT NULL, points_awarded INTEGER DEFAULT 50, check_in_time TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, connected_user_id TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS highlight_likes (user_id TEXT NOT NULL, highlight_id TEXT NOT NULL, PRIMARY KEY (user_id, highlight_id))`);

  // ─── EVENTS ──────────────────────────────────────
  const EVENTS = [
    { id:'cloud-summit-india', title:'Google Cloud Summit India 2026', description:'The premier Google Cloud conference in India featuring latest innovations in cloud computing, AI/ML, data analytics, and security from Google Cloud experts.', event_type:'Offline', category:'Summit', start_date:'2026-07-15T09:00:00', end_date:'2026-07-15T18:00:00', venue_name:'Jio World Convention Centre', address:'BKC, Bandra East, Mumbai', city:'Mumbai', state:'Maharashtra', lat:19.0607, lng:72.8656, ticket_price:'₹1,499', is_paid:1, capacity:5000, registered:4500, tags:['#GoogleCloud','#Summit','#Enterprise','#AI'], speakers:[{name:'Bikram S. Bedi',role:'VP & MD, Google Cloud India',color:'var(--grad-blue)'},{name:'Karan Bajwa',role:'Sr Director, Google Cloud',color:'var(--grad-purple)'}] },
    { id:'community-days-india', title:'Google Cloud Community Days India 2026', description:'Community-led conference bringing together cloud enthusiasts, developers, and industry leaders from across India.', event_type:'Offline', category:'Community Day', start_date:'2026-06-20T09:00:00', end_date:'2026-06-20T17:00:00', venue_name:'HICC Hyderabad', address:'Kondapur, Hyderabad', city:'Hyderabad', state:'Telangana', lat:17.4851, lng:78.3817, ticket_price:'Free', is_paid:0, capacity:2500, registered:1800, tags:['#GCCD','#Community','#GDG','#Cloud'], speakers:[{name:'Sneha Patil',role:'SRE Lead, Infosys',color:'var(--grad-green)'},{name:'Vikram Tiwari',role:'GDE Cloud',color:'var(--grad-blue)'}] },
    { id:'devfest-india-2026', title:'DevFest India 2026', description:'The biggest annual Google Developer community event in India organized by GDG chapters.', event_type:'Offline', category:'DevFest', start_date:'2026-10-12T09:00:00', end_date:'2026-10-12T18:00:00', venue_name:'Bangalore International Exhibition Centre', address:'10th Mile, Tumkur Road, Bangalore', city:'Bangalore', state:'Karnataka', lat:13.0352, lng:77.5103, ticket_price:'Free', is_paid:0, capacity:3000, registered:2150, tags:['#DevFest','#GDG','#AI','#Android'], speakers:[{name:'Pankaj Gupta',role:'Engineering Director, Google India',color:'var(--grad-purple)'},{name:'Romin Irani',role:'Android Expert, Google',color:'var(--grad-blue)'}] },
    { id:'build-with-ai-india', title:'Build with AI India 2026', description:"Hands-on event focused on building real AI apps using Gemini, Vertex AI, and AI Studio.", event_type:'Offline', category:'Build with AI', start_date:'2026-08-05T10:00:00', end_date:'2026-08-05T17:00:00', venue_name:'Google Office, EcoWorld', address:'EcoWorld Techpark, Bellandur, Bangalore', city:'Bangalore', state:'Karnataka', lat:12.9259, lng:77.6828, ticket_price:'Free', is_paid:0, capacity:200, registered:180, tags:['#BuildWithAI','#Gemini','#VertexAI','#Workshop'], speakers:[{name:'Ankit Jain',role:'Lead ML Engineer, Google',color:'var(--grad-green)'}] },
    { id:'gcp-workshop-bangalore', title:'GCP Workshop — Bangalore', description:'Full-day hands-on GCP workshop: Compute Engine, Cloud Functions, Firestore, Cloud Run.', event_type:'Offline', category:'Workshop', start_date:'2026-06-24T10:00:00', end_date:'2026-06-24T17:00:00', venue_name:'Google Office, EcoWorld', address:'EcoWorld Techpark, Bellandur, Bangalore', city:'Bangalore', state:'Karnataka', lat:12.9259, lng:77.6828, ticket_price:'₹499', is_paid:1, capacity:200, registered:160, tags:['#GCP','#CloudRun','#Workshop','#Bangalore'], speakers:[{name:'Vikram Tiwari',role:'GDE, Cloud',color:'var(--grad-blue)'}] },
    { id:'cloud-hackathon-india', title:'Google Cloud Hackathon India 2026', description:'48-hour hackathon building innovative solutions using Google Cloud and Gen AI.', event_type:'Offline', category:'Hackathon', start_date:'2026-09-10T10:00:00', end_date:'2026-09-12T16:00:00', venue_name:'IIT Delhi', address:'Hauz Khas, New Delhi', city:'New Delhi', state:'Delhi', lat:28.5459, lng:77.1926, ticket_price:'Free', is_paid:0, capacity:1500, registered:1200, tags:['#Hackathon','#GenAI','#GoogleCloud','#Innovation'], speakers:[{name:'Dr. Manish Gupta',role:'Director, Google Research India',color:'var(--grad-purple)'},{name:'Meghna Dutta',role:'AI Advocate, Google Cloud',color:'var(--grad-green)'}] },
    { id:'gcp-workshop-delhi', title:'GCP Workshop — Delhi', description:'Hands-on GCP workshop covering Kubernetes, Cloud SQL, and serverless architectures.', event_type:'Offline', category:'Workshop', start_date:'2026-07-08T10:00:00', end_date:'2026-07-08T17:00:00', venue_name:'Google India, Gurugram', address:'DLF Cybercity, Sector 24, Gurugram', city:'Gurugram', state:'Haryana', lat:28.4957, lng:77.0887, ticket_price:'₹499', is_paid:1, capacity:150, registered:120, tags:['#GCP','#Kubernetes','#CloudSQL','#Delhi'], speakers:[{name:'Amit Kumar',role:'Cloud Architect, Google',color:'var(--grad-blue)'}] },
    { id:'cloud-summit-delhi', title:'Google Cloud Summit Delhi 2026', description:'Google Cloud Summit in the national capital — digital transformation and AI adoption.', event_type:'Offline', category:'Summit', start_date:'2026-11-05T09:00:00', end_date:'2026-11-05T18:00:00', venue_name:'Pragati Maidan', address:'Pragati Maidan, New Delhi', city:'New Delhi', state:'Delhi', lat:28.6184, lng:77.2451, ticket_price:'₹999', is_paid:1, capacity:4000, registered:3200, tags:['#GoogleCloud','#Summit','#Delhi','#Enterprise'], speakers:[{name:'Bikram S. Bedi',role:'VP & MD, Google Cloud India',color:'var(--grad-blue)'},{name:'Nitin Bhas',role:'Head of Data Analytics, Google Cloud',color:'var(--grad-green)'}] },
    { id:'google-cloud-next', title:'Google Cloud Next 2026', description:"Google Cloud's flagship global event — livestreamed across India.", event_type:'Online', category:'Next', start_date:'2026-04-09T18:30:00', end_date:'2026-04-11T02:30:00', venue_name:'Online (Livestream)', address:'Virtual Event', city:'Online', state:'Global', lat:0, lng:0, ticket_price:'Free', is_paid:0, capacity:999999, registered:15000, tags:['#CloudNext','#GoogleCloud','#AI','#Keynote'], speakers:[{name:'Thomas Kurian',role:'CEO, Google Cloud',color:'var(--grad-blue)'}] },
    { id:'google-io-2026', title:'Google I/O 2026', description:"Google's annual developer conference — streamed live.", event_type:'Online', category:'IO', start_date:'2026-05-14T20:30:00', end_date:'2026-05-14T04:30:00', venue_name:'Online (Livestream)', address:'Virtual Event', city:'Online', state:'Global', lat:0, lng:0, ticket_price:'Free', is_paid:0, capacity:999999, registered:25000, tags:['#GoogleIO','#Android','#AI','#Web'], speakers:[{name:'Sundar Pichai',role:'CEO, Alphabet & Google',color:'var(--grad-blue)'}] },
    { id:'cloud-webinar-series', title:'Google Cloud Webinar: AI for Everyone', description:'Monthly webinar: "Building Intelligent Apps with Gemini API".', event_type:'Online', category:'Webinar', start_date:'2026-05-28T15:00:00', end_date:'2026-05-28T16:30:00', venue_name:'Online (Google Meet)', address:'Virtual Event', city:'Online', state:'India', lat:0, lng:0, ticket_price:'Free', is_paid:0, capacity:1000, registered:500, tags:['#Webinar','#GeminiAPI','#AI','#Beginners'], speakers:[{name:'Priya Sharma',role:'Cloud Advocate, Google India',color:'var(--grad-purple)'}] },
    { id:'cloud-webinar-devops', title:'Google Cloud Webinar: DevOps Best Practices', description:'Learn CI/CD pipelines, Terraform, and Cloud Operations.', event_type:'Online', category:'Webinar', start_date:'2026-06-25T15:00:00', end_date:'2026-06-25T16:30:00', venue_name:'Online (Google Meet)', address:'Virtual Event', city:'Online', state:'India', lat:0, lng:0, ticket_price:'Free', is_paid:0, capacity:800, registered:350, tags:['#Webinar','#DevOps','#CICD','#Terraform'], speakers:[{name:'Rajesh Nair',role:'DevOps Specialist, Google India',color:'var(--grad-green)'}] }
  ];

  for (const ev of EVENTS) {
    db.run(`INSERT INTO events (id,title,description,event_type,category,start_date,end_date,venue_name,address,city,state,latitude,longitude,ticket_price,is_paid,capacity,registered,tags,speakers) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ev.id, ev.title, ev.description, ev.event_type, ev.category, ev.start_date, ev.end_date, ev.venue_name, ev.address, ev.city, ev.state, ev.lat, ev.lng, ev.ticket_price, ev.is_paid, ev.capacity, ev.registered, JSON.stringify(ev.tags), JSON.stringify(ev.speakers)]);
  }
  console.log(`✅ ${EVENTS.length} events inserted`);

  // ─── SCHEDULES ──────────────────────────────────────
  const SCHEDULES = {
    'cloud-summit-india': [
      {t:'09:00–09:45',n:'Registration & Welcome Coffee',type:'Opening',s:'',r:'Grand Lobby'},
      {t:'09:45–10:45',n:'Cloud Keynote: Google Cloud Vision for India',type:'Keynote',s:'Bikram S. Bedi',r:'Main Hall'},
      {t:'11:00–12:00',n:'Enterprise AI at Scale',type:'Talk',s:'Karan Bajwa',r:'Hall 1'},
      {t:'12:00–13:00',n:'Hands-on: BigQuery ML Workshop',type:'Workshop',s:'',r:'Lab A'},
      {t:'13:00–14:00',n:'Lunch & Networking',type:'Break',s:'',r:'Terrace'},
      {t:'14:00–15:00',n:'Security in the Cloud Era',type:'Talk',s:'',r:'Hall 2'},
      {t:'15:15–16:15',n:'Multi-Cloud with Anthos',type:'Talk',s:'',r:'Hall 1'},
      {t:'16:30–17:00',n:'Closing & Knox Points Award',type:'Closing',s:'',r:'Main Hall'}
    ],
    'community-days-india': [
      {t:'09:00–09:30',n:'Registration & Breakfast',type:'Opening',s:'',r:'Lobby'},
      {t:'09:30–10:30',n:'Keynote: Cloud-First India',type:'Keynote',s:'Vikram Tiwari',r:'Auditorium'},
      {t:'10:45–11:45',n:'GKE Production Patterns',type:'Talk',s:'Sneha Patil',r:'Hall A'},
      {t:'12:00–13:00',n:'Cloud Functions Workshop',type:'Workshop',s:'',r:'Lab 1'},
      {t:'13:00–14:00',n:'Lunch & Community Connect',type:'Break',s:'',r:'Cafeteria'},
      {t:'14:00–15:00',n:'Serverless with Cloud Run',type:'Talk',s:'',r:'Hall B'},
      {t:'15:15–16:15',n:'Panel: DevOps for Startups',type:'Panel',s:'',r:'Auditorium'},
      {t:'16:30–17:00',n:'Closing Ceremony',type:'Closing',s:'',r:'Auditorium'}
    ],
    'devfest-india-2026': [
      {t:'09:00–09:30',n:'Registration & Badge Pickup',type:'Opening',s:'',r:'Lobby'},
      {t:'09:30–10:30',n:'Opening Keynote: Google Developer Ecosystem',type:'Keynote',s:'Pankaj Gupta',r:'Main Auditorium'},
      {t:'10:45–11:45',n:"What's New in Android",type:'Talk',s:'Romin Irani',r:'Hall A'},
      {t:'12:15–13:15',n:'Building with Gemini API',type:'Workshop',s:'',r:'Lab 1'},
      {t:'13:15–14:15',n:'Lunch Break',type:'Break',s:'',r:'Dining Hall'},
      {t:'14:15–15:15',n:'Cloud Run Deep Dive',type:'Talk',s:'',r:'Hall B'},
      {t:'15:15–16:15',n:'Panel: Future of AI in India',type:'Panel',s:'',r:'Main Auditorium'},
      {t:'16:15–16:30',n:'Closing & Knox Points',type:'Closing',s:'',r:'Main Auditorium'}
    ],
    'build-with-ai-india': [
      {t:'10:00–10:30',n:'Setup & Environment Prep',type:'Opening',s:'',r:'Training Room'},
      {t:'10:30–12:00',n:'AI Fundamentals with Gemini',type:'Workshop',s:'Ankit Jain',r:'Training Room'},
      {t:'12:00–13:00',n:'Lunch',type:'Break',s:'',r:'Cafeteria'},
      {t:'13:00–15:00',n:'Build: AI-Powered App',type:'Workshop',s:'',r:'Training Room'},
      {t:'15:00–16:30',n:'Deploy on Vertex AI',type:'Workshop',s:'',r:'Training Room'},
      {t:'16:30–17:00',n:'Demo & Wrap-up',type:'Closing',s:'',r:'Training Room'}
    ],
    'gcp-workshop-bangalore': [
      {t:'10:00–10:30',n:'Setup & GCP Project Creation',type:'Opening',s:'',r:'Training Room'},
      {t:'10:30–12:00',n:'Compute & Networking Hands-on',type:'Workshop',s:'Vikram Tiwari',r:'Training Room'},
      {t:'12:00–13:00',n:'Lunch',type:'Break',s:'',r:'Cafeteria'},
      {t:'13:00–15:00',n:'Serverless with Cloud Run',type:'Workshop',s:'',r:'Training Room'},
      {t:'15:00–16:30',n:'Firestore & Cloud Functions',type:'Workshop',s:'',r:'Training Room'},
      {t:'16:30–17:00',n:'Q&A & Certificates',type:'Closing',s:'',r:'Training Room'}
    ],
    'cloud-hackathon-india': [
      {t:'10:00–10:30',n:'Opening & Rules Briefing',type:'Opening',s:'',r:'Auditorium',d:1},
      {t:'10:30–11:30',n:'AI Building Blocks Workshop',type:'Workshop',s:'Dr. Manish Gupta',r:'Lab 1',d:1},
      {t:'11:30–23:59',n:'Hacking Begins!',type:'Hackathon',s:'',r:'Hack Zone',d:1},
      {t:'00:00–23:59',n:'Hacking Continues',type:'Hackathon',s:'',r:'Hack Zone',d:2},
      {t:'10:00–12:00',n:'Mentor Office Hours',type:'Panel',s:'Meghna Dutta',r:'Mentoring Pods',d:2},
      {t:'13:00–14:00',n:'Final Submissions',type:'Closing',s:'',r:'Auditorium',d:3},
      {t:'14:00–15:00',n:'Presentations & Judging',type:'Closing',s:'',r:'Auditorium',d:3},
      {t:'15:00–16:00',n:'Award Ceremony & Knox Points',type:'Closing',s:'',r:'Auditorium',d:3}
    ],
    'gcp-workshop-delhi': [
      {t:'10:00–10:30',n:'Setup & Welcome',type:'Opening',s:'',r:'Training Room'},
      {t:'10:30–12:00',n:'Kubernetes on GKE',type:'Workshop',s:'Amit Kumar',r:'Training Room'},
      {t:'12:00–13:00',n:'Lunch',type:'Break',s:'',r:'Cafeteria'},
      {t:'13:00–15:00',n:'Cloud SQL & Databases',type:'Workshop',s:'',r:'Training Room'},
      {t:'15:00–16:30',n:'Serverless Architecture Patterns',type:'Workshop',s:'',r:'Training Room'},
      {t:'16:30–17:00',n:'Q&A & Certificates',type:'Closing',s:'',r:'Training Room'}
    ],
    'cloud-summit-delhi': [
      {t:'09:00–09:45',n:'Registration & Networking',type:'Opening',s:'',r:'Grand Foyer'},
      {t:'09:45–10:45',n:'Keynote: India Digital Transformation',type:'Keynote',s:'Bikram S. Bedi',r:'Main Stage'},
      {t:'11:00–12:00',n:'Data Analytics at Scale',type:'Talk',s:'Nitin Bhas',r:'Hall A'},
      {t:'12:00–13:00',n:'Cloud Security Workshop',type:'Workshop',s:'',r:'Lab Zone'},
      {t:'13:00–14:00',n:'Lunch & Partner Booths',type:'Break',s:'',r:'Exhibition Area'},
      {t:'14:00–15:00',n:'GenAI for Enterprise',type:'Talk',s:'',r:'Hall B'},
      {t:'15:15–16:30',n:'Panel: Cloud-Native India',type:'Panel',s:'',r:'Main Stage'},
      {t:'16:30–17:00',n:'Closing & Knox Points Award',type:'Closing',s:'',r:'Main Stage'}
    ],
    'google-cloud-next': [
      {t:'18:30–20:00',n:'Cloud Next Keynote (IST)',type:'Keynote',s:'Thomas Kurian',r:'Livestream'},
      {t:'20:00–21:00',n:'AI & ML Innovations',type:'Talk',s:'',r:'Livestream'},
      {t:'21:00–22:00',n:'Developer Keynote',type:'Keynote',s:'',r:'Livestream'},
      {t:'22:00–23:00',n:'Breakout Sessions',type:'Talk',s:'',r:'Livestream'}
    ],
    'google-io-2026': [
      {t:'20:30–22:00',n:'Google I/O Keynote (IST)',type:'Keynote',s:'Sundar Pichai',r:'Livestream'},
      {t:'22:00–23:00',n:'Developer Keynote',type:'Keynote',s:'',r:'Livestream'},
      {t:'23:00–00:00',n:"What's New in Android",type:'Talk',s:'',r:'Livestream'},
      {t:'00:00–01:00',n:'AI with Gemini Deep Dive',type:'Talk',s:'',r:'Livestream'}
    ],
    'cloud-webinar-series': [
      {t:'15:00–15:10',n:'Welcome & Intro',type:'Opening',s:'',r:'Google Meet'},
      {t:'15:10–16:00',n:'Building with Gemini API',type:'Workshop',s:'Priya Sharma',r:'Google Meet'},
      {t:'16:00–16:30',n:'Live Q&A',type:'Panel',s:'',r:'Google Meet'}
    ],
    'cloud-webinar-devops': [
      {t:'15:00–15:10',n:'Welcome & Intro',type:'Opening',s:'',r:'Google Meet'},
      {t:'15:10–15:50',n:'CI/CD Pipelines with Cloud Build',type:'Talk',s:'Rajesh Nair',r:'Google Meet'},
      {t:'15:50–16:15',n:'Infrastructure as Code Demo',type:'Workshop',s:'',r:'Google Meet'},
      {t:'16:15–16:30',n:'Live Q&A',type:'Panel',s:'',r:'Google Meet'}
    ]
  };

  let schedCount = 0;
  for (const [eventId, sessions] of Object.entries(SCHEDULES)) {
    for (const s of sessions) {
      db.run('INSERT INTO schedules (id,event_id,day,time_slot,session_name,session_type,speaker,room) VALUES (?,?,?,?,?,?,?,?)',
        [uuidv4(), eventId, s.d || 1, s.t, s.n, s.type, s.s, s.r]);
      schedCount++;
    }
  }
  console.log(`✅ ${schedCount} schedule sessions inserted`);

  // ─── HIGHLIGHTS (with images) ──────────────────────
  const HIGHLIGHTS = [
    { title:'DevFest India 2025 — Opening Keynote', desc:'Thousands of developers gathered at the flagship GDG DevFest event in Bangalore for a day of talks, workshops, and community building.', image:'asset/images/devfest-india.png', a:2500, s:25, w:8, l:342 },
    { title:'Google Cloud Summit Mumbai 2025', desc:'Google Cloud leaders connected with Indian developers and enterprise customers at the Jio World Convention Centre.', image:'asset/images/cloud-summit.png', a:4000, s:30, w:12, l:218 },
    { title:'Cloud Hackathon India 2025 — Winners', desc:'The winning team built an AI accessibility tool using Gemini and Cloud Run that translates sign language in real-time.', image:'asset/images/hackathon.png', a:1000, s:15, w:5, l:456 },
    { title:'Build with AI Workshop 2025', desc:'200 developers building AI-powered applications at Google Bangalore office using Gemini API and Vertex AI.', image:'asset/images/ai-workshop.png', a:200, s:8, w:4, l:189 },
    { title:'Community Days Hyderabad 2025', desc:'GDG communities from 15 cities came together for a massive community-led cloud conference at HICC Hyderabad.', image:'asset/images/community-days.png', a:1500, s:20, w:10, l:267 },
    { title:'Google I/O 2025 Watch Party — India', desc:'Developers across India watching Google I/O together at community hubs in Delhi, Mumbai, Bangalore, and Chennai.', image:'asset/images/google-io-keynote.png', a:5000, s:0, w:0, l:534 },
    { title:'GCP Workshop Bangalore 2025', desc:'Certified Cloud developers after an intensive hands-on workshop covering GKE, Cloud Run, and Firestore.', image:'asset/images/certificate-ceremony.png', a:180, s:5, w:3, l:145 },
    { title:'Google Cloud Next 2025 Recap India', desc:'Key announcements including Gemini in Cloud, new AI tools, and India-specific launches.', image:'asset/images/cloud-next-25.png', a:10000, s:0, w:0, l:398 }
  ];

  for (const h of HIGHLIGHTS) {
    db.run('INSERT INTO highlights (id,event_title,description,image_url,stats_attendees,stats_speakers,stats_workshops,likes) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), h.title, h.desc, h.image, h.a, h.s, h.w, h.l]);
  }
  console.log(`✅ ${HIGHLIGHTS.length} highlights inserted`);

  // ─── USERS ──────────────────────────────────────────
  // Primary user account
  const jeelId = uuidv4();
  const jeelHash = bcrypt.hashSync('Jeelop45', 10);
  db.run('INSERT INTO users (id,email,password_hash,full_name,avatar_color,total_points) VALUES (?,?,?,?,?,?)',
    [jeelId, 'jeelrokad@gmail.com', jeelHash, 'Jeel Rokad', 'linear-gradient(135deg,#4285f4,#00d4ff)', 250]);

  // Demo users
  const demoPassword = bcrypt.hashSync('demo123', 10);
  const DEMO_USERS = [
    { name:'Rahul Verma', email:'rahul@knox.dev', pts:620, color:'linear-gradient(135deg,#00e676,#00bfa5)' },
    { name:'Priya Sharma', email:'priya@knox.dev', pts:380, color:'linear-gradient(135deg,#a855f7,#6366f1)' },
    { name:'Arjun Kapoor', email:'arjun@knox.dev', pts:490, color:'linear-gradient(135deg,#ff9800,#ff5722)' },
    { name:'Vikram Tiwari', email:'vikram@knox.dev', pts:430, color:'linear-gradient(135deg,#e91e63,#c2185b)' },
    { name:'Sneha Patil', email:'sneha@knox.dev', pts:325, color:'linear-gradient(135deg,#ff9800,#ff5722)' },
    { name:'Ananya Iyer', email:'ananya@knox.dev', pts:270, color:'linear-gradient(135deg,#00bcd4,#0097a7)' },
    { name:'Meera Joshi', email:'meera@knox.dev', pts:265, color:'linear-gradient(135deg,#ff5722,#d84315)' },
    { name:'Karthik Reddy', email:'karthik@knox.dev', pts:195, color:'linear-gradient(135deg,#8bc34a,#689f38)' },
    { name:'Divya Nair', email:'divya@knox.dev', pts:160, color:'linear-gradient(135deg,#009688,#00796b)' },
    { name:'Rohan Mehta', email:'rohan@knox.dev', pts:140, color:'linear-gradient(135deg,#ff4081,#c2185b)' }
  ];

  const userIds = [];
  for (const u of DEMO_USERS) {
    const uid = uuidv4();
    userIds.push(uid);
    db.run('INSERT INTO users (id,email,password_hash,full_name,avatar_color,total_points) VALUES (?,?,?,?,?,?)',
      [uid, u.email, demoPassword, u.name, u.color, u.pts]);
  }
  console.log(`✅ ${DEMO_USERS.length + 1} users created`);

  // ─── CONNECTIONS for Jeel (10 connections) ──────────
  for (let i = 0; i < 10 && i < userIds.length; i++) {
    db.run('INSERT INTO connections (id,user_id,connected_user_id) VALUES (?,?,?)',
      [uuidv4(), jeelId, userIds[i]]);
  }
  // Update Jeel's points for connections (10 * 5 = 50 extra)
  db.run('UPDATE users SET total_points = total_points + 50 WHERE id = ?', [jeelId]);
  console.log(`✅ 10 connections created for Jeel`);

  // ─── ATTENDANCE for Jeel ───────────────────────────
  // Simulate past check-ins
  db.run('INSERT INTO check_ins (id,user_id,event_id,points_awarded,check_in_time) VALUES (?,?,?,?,?)',
    [uuidv4(), jeelId, 'cloud-summit-india', 50, '2025-07-15T10:00:00']);
  db.run('INSERT INTO check_ins (id,user_id,event_id,points_awarded,check_in_time) VALUES (?,?,?,?,?)',
    [uuidv4(), jeelId, 'build-with-ai-india', 50, '2025-08-05T11:00:00']);

  // Bookings for those
  db.run('INSERT INTO bookings (id,user_id,event_id,checked_in,ticket_type) VALUES (?,?,?,?,?)',
    [uuidv4(), jeelId, 'cloud-summit-india', 1, 'General']);
  db.run('INSERT INTO bookings (id,user_id,event_id,checked_in,ticket_type) VALUES (?,?,?,?,?)',
    [uuidv4(), jeelId, 'build-with-ai-india', 1, 'General']);
  console.log(`✅ 2 attendance records created for Jeel`);

  // Save
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();

  console.log('\n🎉 Knox database seeded successfully!');
  console.log('   Login: jeelrokad@gmail.com / Jeelop45');
  console.log('   Start: node server.js → http://localhost:8080\n');
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
