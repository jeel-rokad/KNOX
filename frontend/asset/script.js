/* ============================================
   KNOX — India's Unified Event Platform
   Frontend (API-Connected, Guest + Auth)
   ============================================ */

const API = 'https://backend-service-556873261435.us-central1.run.app/api';

// ─── STATE ──────────────────────────────────────────────
let currentUser = null;
let authToken = localStorage.getItem('knox_token');
let EVENTS = [];
let curPage = 'home';
let navStack = [];
let curDiv = 'all';
let curFilter = 'all';
let isGuest = true;

// ─── HELPERS ────────────────────────────────────────────
const fmt = d => new Date(d).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const fmtTime = d => new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
const fmtShort = d => new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
const getMonth = d => new Date(d).toLocaleDateString('en-IN',{month:'short'}).toUpperCase();
const getDay = d => new Date(d).getDate();
const isFree = p => p.toLowerCase() === 'free';
const typeClass = t => t.toLowerCase().replace(/\s+/g,'');

function headers() {
  const h = {'Content-Type':'application/json'};
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

async function apiFetch(path, opts={}) {
  opts.headers = {...headers(), ...opts.headers};
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(msg, type='success') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':'ℹ️'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(()=>t.classList.add('show'),50);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},3500);
}

// ─── AUTH ────────────────────────────────────────────────
const authOverlay = document.getElementById('authOverlay');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

function showAuth(tab='login') {
  // Always reset to the requested tab (default: Sign In)
  document.getElementById('tabLogin').classList.toggle('active', tab==='login');
  document.getElementById('tabRegister').classList.toggle('active', tab==='register');
  loginForm.style.display = tab==='login' ? 'block' : 'none';
  registerForm.style.display = tab==='register' ? 'block' : 'none';
  document.getElementById('loginError').textContent = '';
  document.getElementById('registerError').textContent = '';
  authOverlay.classList.add('open');
}
function hideAuth() { authOverlay.classList.remove('open') }

function updateNavForUser() {
  isGuest = false;
  document.getElementById('navLoggedIn').style.display = 'flex';
  document.getElementById('navGuest').style.display = 'none';
  document.getElementById('topbar-pts').textContent = (currentUser.total_points||0) + ' pts';
  document.getElementById('topbar-av').textContent = currentUser.full_name[0].toUpperCase();
  document.getElementById('topbar-av').style.background = currentUser.avatar_color;
}

function updateNavForGuest() {
  isGuest = true;
  currentUser = null;
  document.getElementById('navLoggedIn').style.display = 'none';
  document.getElementById('navGuest').style.display = 'flex';
}

// Auth tabs
document.getElementById('tabLogin').addEventListener('click', ()=>{
  document.getElementById('tabLogin').classList.add('active');
  document.getElementById('tabRegister').classList.remove('active');
  loginForm.style.display='block'; registerForm.style.display='none';
});
document.getElementById('tabRegister').addEventListener('click', ()=>{
  document.getElementById('tabRegister').classList.add('active');
  document.getElementById('tabLogin').classList.remove('active');
  registerForm.style.display='block'; loginForm.style.display='none';
});

// Close auth / guest
document.getElementById('authClose').addEventListener('click', ()=>{ hideAuth() });
document.getElementById('authBackBtn').addEventListener('click', ()=>{ hideAuth() });
document.getElementById('guestBtn').addEventListener('click', ()=>{ hideAuth() });
document.getElementById('signinNavBtn').addEventListener('click', ()=>{ showAuth('login') });
document.getElementById('cta-signup').addEventListener('click', ()=>{ showAuth('register') });

document.getElementById('switchToSignup')?.addEventListener('click', ()=>{ showAuth('register') });
// Login
loginForm.addEventListener('submit', async(e)=>{
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errEl.textContent=''; btn.textContent='Signing in...'; btn.disabled=true;
  try {
    const data = await apiFetch('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    authToken = data.token; localStorage.setItem('knox_token',authToken);
    currentUser = data.user;
    hideAuth(); updateNavForUser();
    showToast(`Welcome back, ${currentUser.full_name}!`);
  } catch(err) { errEl.textContent = err.message; }
  finally { btn.textContent='Sign In →'; btn.disabled=false; }
});

// Register
registerForm.addEventListener('submit', async(e)=>{
  e.preventDefault();
  const full_name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('registerError');
  const btn = document.getElementById('registerBtn');
  errEl.textContent=''; btn.textContent='Creating account...'; btn.disabled=true;
  try {
    const data = await apiFetch('/auth/register',{method:'POST',body:JSON.stringify({full_name,email,phone,password})});
    authToken = data.token; localStorage.setItem('knox_token',authToken);
    currentUser = data.user;
    hideAuth(); updateNavForUser();
    showToast(`Welcome to Knox, ${currentUser.full_name}! 🎉`);
  } catch(err) { errEl.textContent = err.message; }
  finally { btn.textContent='Create Account →'; btn.disabled=false; }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', ()=>{
  authToken = null; localStorage.removeItem('knox_token');
  updateNavForGuest();
  navigateTo('home');
  showToast('Signed out. You can browse as guest or sign back in.','info');
  // Show auth overlay with Sign In tab after logout
  setTimeout(()=>showAuth('login'), 600);
});

// ─── NAVIGATION ─────────────────────────────────────────
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');

function navigateTo(id, push=true) {
  // Dashboard requires login
  if (id === 'dashboard' && isGuest) {
    document.getElementById('dashLoginGate').style.display = 'flex';
    document.getElementById('dashContent').style.display = 'none';
  } else if (id === 'dashboard') {
    document.getElementById('dashLoginGate').style.display = 'none';
    document.getElementById('dashContent').style.display = 'block';
  }

  if (push && curPage !== id) navStack.push(curPage);
  curPage = id;
  pages.forEach(p => p.classList.remove('active'));
  const t = document.getElementById('page-'+id);
  if (t) t.classList.add('active');
  navLinks.forEach(n => n.classList.remove('active'));
  const special = ['event-detail','event-schedule','venue-map'];
  if (!special.includes(id)) {
    const a = document.querySelector(`.nav-link[data-page="${id}"]`);
    if (a) a.classList.add('active');
  } else {
    const e = document.querySelector('.nav-link[data-page="events"]');
    if (e) e.classList.add('active');
  }
  document.getElementById('navLinks').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});

  if (id==='dashboard' && !isGuest) loadDashboard();
  if (id==='leaderboard') loadLeaderboard();
  if (id==='highlights') loadHighlights();
}

function goBack() { navStack.length ? navigateTo(navStack.pop(),false) : navigateTo('events',false) }

navLinks.forEach(l => l.addEventListener('click', e=>{ e.preventDefault(); navStack=[]; navigateTo(l.dataset.page) }));
document.getElementById('hero-explore').addEventListener('click', ()=>navigateTo('events'));
document.getElementById('hero-dash').addEventListener('click', ()=>{ isGuest ? showAuth() : navigateTo('dashboard') });
document.getElementById('dash-browse').addEventListener('click', ()=>navigateTo('events'));
document.getElementById('mobToggle').addEventListener('click', ()=>document.getElementById('navLinks').classList.toggle('open'));
window.addEventListener('scroll', ()=>document.getElementById('navbar').classList.toggle('scrolled',window.scrollY>30));

// ─── STARFIELD ──────────────────────────────────────────
function initStarfield() {
  const c = document.getElementById('starfield'); if (!c) return;
  const x = c.getContext('2d'); let stars=[];
  function resize() { c.width=c.offsetWidth; c.height=c.offsetHeight }
  function create() {
    stars=[]; const n=Math.floor((c.width*c.height)/3000);
    for(let i=0;i<n;i++) stars.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.5+.3,a:Math.random()*.8+.2,s:Math.random()*.3+.05,ts:Math.random()*.02+.005,td:Math.random()>.5?1:-1});
  }
  function draw() {
    x.clearRect(0,0,c.width,c.height);
    const g=x.createRadialGradient(c.width*.3,c.height*.4,0,c.width*.3,c.height*.4,c.width*.5);
    g.addColorStop(0,'rgba(66,133,244,.03)');g.addColorStop(.5,'rgba(168,85,247,.015)');g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g; x.fillRect(0,0,c.width,c.height);
    for(let s of stars){s.a+=s.ts*s.td;if(s.a>=1){s.a=1;s.td=-1}if(s.a<=.15){s.a=.15;s.td=1}s.y-=s.s;if(s.y<-2){s.y=c.height+2;s.x=Math.random()*c.width}x.beginPath();x.arc(s.x,s.y,s.r,0,Math.PI*2);x.fillStyle=`rgba(200,210,255,${s.a})`;x.fill()}
    requestAnimationFrame(draw);
  }
  resize();create();draw();window.addEventListener('resize',()=>{resize();create()});
}

// ─── SCROLL ANIMATIONS ─────────────────────────────────
function initScrollAnimations() {
  const sections = document.querySelectorAll('.home-section');
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('visible');
        // Stagger children animation
        const cards = e.target.querySelectorAll('.feat-card, .step-card, .home-hl-card');
        cards.forEach((c,i) => {
          c.style.transitionDelay = (i * 0.1) + 's';
          c.classList.add('card-visible');
        });
      }
    });
  },{threshold:0.08,rootMargin:'0px 0px -30px 0px'});
  sections.forEach(s=>obs.observe(s));

  // Scroll indicator hide on scroll
  const scrollInd = document.querySelector('.scroll-indicator');
  if (scrollInd) {
    window.addEventListener('scroll', ()=>{
      scrollInd.style.opacity = window.scrollY > 100 ? '0' : '1';
    });
  }
}

// ─── LOAD EVENTS FROM API ───────────────────────────────
async function loadEvents() {
  try {
    EVENTS = await apiFetch('/events');
    renderEvents();
    renderFeaturedEvents();
    document.getElementById('stat-events').textContent=EVENTS.length+'+';
  } catch(err) {
    console.error('Failed to load events:',err);
    showToast('Failed to load events','error');
  }
}

// ─── RENDER FEATURED EVENTS (homepage timeline) ───────────
function renderFeaturedEvents() {
  const grid = document.getElementById('featured-events');
  const featured = EVENTS.slice(0,4);
  grid.innerHTML = '<div class="timeline-container"><div class="timeline-line"></div>' + 
  featured.map((ev,i) => {
    const colors = ['var(--green)','var(--cyan)','var(--blue)','var(--purple)'];
    const col = colors[i%colors.length];
    return `
    <div class="timeline-item">
        <div class="timeline-marker" style="--ac:${col}"></div>
        <div class="timeline-date-box" style="--ac:${col}">
            ${fmtShort(ev.start_date).toUpperCase()}<br>
            ${new Date(ev.start_date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
        </div>
        <div class="timeline-content-box" style="--ac:${col}" onclick="showDetail('${ev.id}')">
            <h3>${ev.title.toUpperCase()}</h3>
            <p>${ev.description ? ev.description.slice(0,60)+'...' : 'Join us for this exciting event.'}</p>
        </div>
    </div>`;
  }).join('') + '</div>';
}

// ─── RENDER HOME HIGHLIGHTS PREVIEW ─────────────────────
async function renderHomeHighlights() {
  try {
    const hl = await apiFetch('/highlights');
    highlightsData = hl; // Store for lightbox use
    const grid = document.getElementById('home-highlights-grid');
    grid.innerHTML = hl.slice(0,4).map(h => `
      <div class="home-hl-card" onclick="openLightbox('${h.id}')">
          ${h.image_url ? `<img src="${h.image_url}" alt="${h.event_title}" loading="lazy">` :
          `<div class="hl-placeholder-mini">${h.emoji||'📸'}</div>`}
          <div class="home-hl-info"><h4>${h.event_title}</h4><span>👥 ${h.stats_attendees}+ attended</span></div>
      </div>
    `).join('');
  } catch(e) { console.error(e); }
}

// ─── RENDER EVENTS ──────────────────────────────────────
function renderEvents() {
  const c = document.getElementById('events-grid');
  let filtered = EVENTS;
  if(curDiv!=='all') filtered=filtered.filter(e=>e.event_type===curDiv);
  if(curFilter!=='all') filtered=filtered.filter(e=>e.category===curFilter);
  if(filtered.length===0){ c.innerHTML='<div class="empty-state">No events found matching your filters.</div>'; return }
  c.innerHTML = filtered.map(ev => {
    const free = isFree(ev.ticket_price);
    return `
    <div class="ev-card" onclick="showDetail('${ev.id}')">
        <div class="ev-date"><div class="dm">${getMonth(ev.start_date)}</div><div class="dd">${getDay(ev.start_date)}</div></div>
        <div class="ev-body">
            <span class="type-badge type-${typeClass(ev.category)}">${ev.category}</span>
            <span class="div-badge div-${ev.event_type.toLowerCase()}">${ev.event_type}</span>
            <h3>${ev.title}</h3>
            <div class="ev-meta"><span>📍 ${ev.venue_name}, ${ev.city}</span><span>👥 ${(ev.registered||0).toLocaleString()} registered</span></div>
            <div class="ev-tags">${(ev.tags||[]).map(t=>`<span class="ev-tag">${t}</span>`).join('')}</div>
        </div>
        <div class="ev-price">
            <div class="pv ${free?'free':'paid'}">${ev.ticket_price}</div>
            <div class="ps">${free?'No cost':'Per ticket'}</div>
            <button class="book-btn ${free?'free-b':'paid-b'}" onclick="event.stopPropagation();openBooking('${ev.id}')">${free?'Register Free':'Book Ticket'}</button>
        </div>
    </div>`;
  }).join('');
}

document.querySelectorAll('.div-tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.div-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');curDiv=t.dataset.div;renderEvents()}));
document.querySelectorAll('.filter-chip').forEach(c=>c.addEventListener('click',()=>{
  document.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');curFilter=c.dataset.filter;renderEvents()}));

// ─── EVENT DETAIL ───────────────────────────────────────
async function showDetail(id) {
  let ev = EVENTS.find(e=>e.id===id);
  if(!ev){ try{ev=await apiFetch(`/events/${id}`)}catch{return} }
  const c = document.getElementById('event-detail-content');
  const free = isFree(ev.ticket_price);
  const gradients = {
    Summit:'linear-gradient(135deg,rgba(66,133,244,.6),rgba(0,212,255,.4),rgba(6,6,19,.95))',
    'Community Day':'linear-gradient(135deg,rgba(0,230,118,.6),rgba(0,191,165,.4),rgba(6,6,19,.95))',
    DevFest:'linear-gradient(135deg,rgba(168,85,247,.6),rgba(99,102,241,.4),rgba(6,6,19,.95))',
    Hackathon:'linear-gradient(135deg,rgba(255,82,82,.6),rgba(255,152,0,.4),rgba(6,6,19,.95))',
    Workshop:'linear-gradient(135deg,rgba(255,152,0,.6),rgba(255,87,34,.4),rgba(6,6,19,.95))',
    'Build with AI':'linear-gradient(135deg,rgba(0,230,118,.6),rgba(168,85,247,.4),rgba(6,6,19,.95))',
    Webinar:'linear-gradient(135deg,rgba(0,212,255,.6),rgba(66,133,244,.4),rgba(6,6,19,.95))',
    Next:'linear-gradient(135deg,rgba(66,133,244,.6),rgba(0,212,255,.4),rgba(6,6,19,.95))',
    IO:'linear-gradient(135deg,rgba(0,230,118,.6),rgba(66,133,244,.4),rgba(6,6,19,.95))'
  };
  const speakers = ev.speakers||[];
  const spotsLeft = ev.capacity>=999999 ? 'Unlimited' : (ev.capacity-ev.registered)+' spots left';
  c.innerHTML = `
  <button class="back-btn" onclick="goBack()">← Back</button>
  <div class="ev-detail-header"><div class="hdr-bg" style="background:${gradients[ev.category]||gradients.Summit}"></div><div class="hdr-ov"></div>
      <div class="hdr-content"><h1>${ev.title}</h1><p>${ev.description}</p></div></div>
  <div class="detail-grid">
      <div class="d-card">
          <div class="d-card-title"><span>📋</span> Event Details</div>
          <div class="i-row"><span>📅</span><div><div class="rl">Date</div><div class="rv">${fmt(ev.start_date)}</div></div></div>
          <div class="i-row"><span>⏰</span><div><div class="rl">Time</div><div class="rv">${fmtTime(ev.start_date)} — ${fmtTime(ev.end_date)}</div></div></div>
          <div class="i-row"><span>📍</span><div><div class="rl">Venue</div><div class="rv">${ev.venue_name}, ${ev.city}</div></div></div>
          <div class="i-row"><span>🏷️</span><div><div class="rl">Type</div><div class="rv">${ev.event_type} — ${ev.category}</div></div></div>
          <div class="i-row"><span>👥</span><div><div class="rl">Attendance</div><div class="rv">${(ev.registered||0).toLocaleString()} / ${(ev.capacity||0).toLocaleString()}</div></div></div>
          <div class="i-row"><span>⚡</span><div><div class="rl">Knox Points</div><div class="rv">${ev.event_type==='Offline'?'+50 pts':'+20 pts'} on attendance</div></div></div>
      </div>
      <div class="d-card ticket-card"><div class="t-icon">${free?'🎫':'🎟️'}</div><div class="t-price ${free?'fp':'pp'}">${ev.ticket_price}</div><div class="t-spots">${spotsLeft}</div>
          <button class="btn-book ${free?'fb':'pb'}" onclick="openBooking('${ev.id}')">${free?'Register Free':'Book Ticket ('+ev.ticket_price+')'}</button>
          <p class="qr-note">QR code generated after booking for check-in</p></div>
      <div class="d-card">
          <div class="d-card-title"><span>👤</span> Speakers</div>
          <div class="speakers-grid">${speakers.map(s=>`<div class="spk-card"><div class="spk-av" style="background:${s.color}">${s.name[0]}</div><div class="spk-info"><h5>${s.name}</h5><span>${s.role}</span></div></div>`).join('')}</div>
          <div class="act-grid">
              <div class="act-btn" onclick="showSchedule('${ev.id}')"><span>📋</span> Full Schedule</div>
              ${ev.event_type==='Offline'?`<div class="act-btn" onclick="showVenueMap('${ev.id}')"><span>🗺️</span> Venue Map</div>`:`<div class="act-btn" onclick="showToast('Online event — join via livestream link','info')"><span>🌐</span> Join Online</div>`}
              <div class="act-btn" onclick="navigateTo('leaderboard')"><span>🏆</span> Leaderboard</div>
              ${ev.event_type==='Offline'?`<div class="act-btn" onclick="getDirections(${ev.latitude},${ev.longitude})"><span>🧭</span> Get Directions</div>`:''}
          </div>
      </div>
  </div>`;
  navigateTo('event-detail');
}

// ─── VENUE MAP ──────────────────────────────────────────
function showVenueMap(id) {
  const ev = EVENTS.find(e=>e.id===id); if(!ev) return;
  const c = document.getElementById('venue-map-content');
  const amenities = { stages:[{name:'Main Stage',desc:'Keynotes & major talks',icon:'🎤'},{name:'Workshop Zone',desc:'Hands-on sessions',icon:'💻'}], booths:[{name:'Google Cloud Booth',desc:'Demos & partnerships',icon:'☁️'},{name:'Partner Booths',desc:'Sponsor exhibitions',icon:'🏢'},{name:'Knox Check-in',desc:'QR scan & points',icon:'📱'}], food:[{name:'Main Cafeteria',desc:'Lunch & refreshments',icon:'🍽️'},{name:'Coffee Stand',desc:'Tea, coffee & snacks',icon:'☕'}] };
  c.innerHTML = `
  <button class="back-btn" onclick="goBack()">← Back to Event</button>
  <h1 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;margin-bottom:8px">📍 Venue — ${ev.venue_name}</h1>
  <p style="color:var(--text-2);margin-bottom:20px">${ev.title} · ${ev.city}, ${ev.state}</p>
  <div class="venue-map-wrap"><iframe src="https://www.google.com/maps?q=${ev.latitude},${ev.longitude}&z=16&output=embed" allowfullscreen loading="lazy"></iframe>
      <div class="venue-info-bar"><div><div class="venue-name">${ev.venue_name}</div><div class="venue-addr">${ev.address}</div></div><button class="btn-directions" onclick="getDirections(${ev.latitude},${ev.longitude})">🧭 Get Directions</button></div></div>
  <div class="location-status" id="locStatus"><span class="loc-dot"></span> Requesting your live location...</div>
  <div class="venue-amenities"><h3 style="font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;margin:28px 0 16px">🏢 Venue Amenities</h3>
    <div class="amenity-grid">
      <div class="amenity-section"><h4>🎤 Stages</h4>${amenities.stages.map(a=>`<div class="amenity-item"><span class="a-icon">${a.icon}</span><div><strong>${a.name}</strong><p>${a.desc}</p></div></div>`).join('')}</div>
      <div class="amenity-section"><h4>🏢 Booths</h4>${amenities.booths.map(a=>`<div class="amenity-item"><span class="a-icon">${a.icon}</span><div><strong>${a.name}</strong><p>${a.desc}</p></div></div>`).join('')}</div>
      <div class="amenity-section"><h4>🍽️ Food Stalls</h4>${amenities.food.map(a=>`<div class="amenity-item"><span class="a-icon">${a.icon}</span><div><strong>${a.name}</strong><p>${a.desc}</p></div></div>`).join('')}</div>
    </div>
  </div>`;
  navigateTo('venue-map');
  trackLocation();
}
function getDirections(lat,lng){window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,'_blank')}
function trackLocation(){
  const s=document.getElementById('locStatus');if(!s)return;
  if(navigator.geolocation){navigator.geolocation.watchPosition(pos=>{s.innerHTML=`<span class="loc-dot"></span> 📍 Your location: ${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E — <strong>Live tracking active</strong>`;s.style.borderColor='rgba(0,230,118,.3)';s.style.background='rgba(0,230,118,.06)';s.style.color='var(--green)'},()=>{s.innerHTML=`<span class="loc-dot" style="background:var(--orange)"></span> ⚠️ Location access denied. Enable location for live tracking.`;s.style.borderColor='rgba(255,152,0,.3)';s.style.background='rgba(255,152,0,.06)';s.style.color='var(--orange)'},
  {enableHighAccuracy:true,maximumAge:5000})}else s.textContent='Geolocation not supported by your browser.'}

// ─── EVENT SCHEDULE ─────────────────────────────────────
async function showSchedule(id) {
  const ev = EVENTS.find(e=>e.id===id); if(!ev) return;
  const c = document.getElementById('schedule-content');
  let schedule=[]; try{schedule=await apiFetch(`/events/${id}/schedule`)}catch(e){console.error(e)}
  const dateStr = new Date(ev.start_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  const days={}; schedule.forEach(s=>{const day=s.day||1;if(!days[day])days[day]=[];days[day].push(s)});
  const dayKeys=Object.keys(days).sort((a,b)=>a-b); const isMulti=dayKeys.length>1;
  c.innerHTML = `
  <button class="back-btn" onclick="goBack()">← Back to Event</button>
  <div class="sch-header"><div class="sch-breadcrumb"><a href="#" onclick="event.preventDefault();navigateTo('events')">Events</a><span class="sep">›</span><a href="#" onclick="event.preventDefault();showDetail('${ev.id}')">${ev.title}</a><span class="sep">›</span><span style="color:var(--text-1)">Schedule</span></div>
      <h1 class="sch-title">${ev.title}</h1><div class="sch-ref">// ${ev.category.toUpperCase()} · ${ev.event_type.toUpperCase()}</div>
      <div class="sch-venue"><span style="color:var(--red)">📍</span> ${ev.venue_name}, ${ev.city} · ${dateStr}</div>
      <div class="sch-points-info">⚡ Attend this event to earn <strong>${ev.event_type==='Offline'?'+50':'+20'} Knox Points</strong></div></div>
  ${isMulti?`<div class="sch-day-tabs">${dayKeys.map(d=>`<button class="sch-day-tab ${d==='1'?'active':''}" data-day="${d}">Day ${d}</button>`).join('')}</div>`:''}
  <div class="tl-container"><div class="tl-line"></div>
  ${dayKeys.map(dn=>`<div class="tl-day ${isMulti&&dn!=='1'?'hidden-day':''}" data-day-content="${dn}">
      <div class="tl-date"><div class="diamond"></div><span class="dt">${isMulti?'DAY '+dn:dateStr}</span></div>
      <div class="tl-items">${days[dn].map(s=>`<div class="tl-item"><div class="tl-marker"></div><div class="sch-card"><div class="sch-card-top"><span class="sch-type st-${s.session_type.toLowerCase()}">${s.session_type}</span><span class="sch-time">⏱ ${s.time_slot}</span></div><h3>${s.session_name}</h3><div class="sch-foot">${s.room?`<span>📍</span> ${s.room}`:''}${s.speaker?`<span style="margin-left:12px">👤</span> ${s.speaker}`:''}</div></div></div>`).join('')}</div></div>`).join('')}
  </div>`;
  navigateTo('event-schedule');
  if(isMulti){document.querySelectorAll('.sch-day-tab').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.sch-day-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');document.querySelectorAll('.tl-day').forEach(d=>d.classList.add('hidden-day'));document.querySelector(`.tl-day[data-day-content="${tab.dataset.day}"]`).classList.remove('hidden-day')})})}
}

// ─── BOOKING SYSTEM ─────────────────────────────────────
let bookingEvent = null;

function openBooking(id) {
  if (isGuest) { showAuth(); showToast('Please sign in to book tickets','info'); return }
  bookingEvent = EVENTS.find(e=>e.id===id); if(!bookingEvent) return;
  const free = isFree(bookingEvent.ticket_price);
  document.getElementById('booking-title').textContent=`Book: ${bookingEvent.title}`;
  document.getElementById('booking-body').innerHTML = `
      <div class="booking-event-info"><div class="bei-row"><span>📅</span> ${fmt(bookingEvent.start_date)}</div><div class="bei-row"><span>📍</span> ${bookingEvent.venue_name}, ${bookingEvent.city}</div><div class="bei-row"><span>🏷️</span> ${bookingEvent.event_type} · ${bookingEvent.category}</div></div>
      <div class="booking-price ${free?'free':'paid'}">${bookingEvent.ticket_price}</div>
      ${bookingEvent.is_paid?`<div class="form-group"><label>Ticket Type</label><select id="b-ticket-type"><option value="Early Bird">Early Bird — ${bookingEvent.ticket_price}</option><option value="General">General Admission</option></select></div><div class="form-group"><label>Card Number (Demo)</label><input type="text" id="b-card" placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242"></div>`:''}
      <button class="btn-confirm" id="confirmBookBtn">${free?'Confirm Registration':'Pay '+bookingEvent.ticket_price+' & Book'}</button>`;
  document.getElementById('bookingModal').classList.add('open');
  document.getElementById('confirmBookBtn').addEventListener('click',confirmBooking);
}

function closeBooking(){ document.getElementById('bookingModal').classList.remove('open') }

async function confirmBooking() {
  const btn=document.getElementById('confirmBookBtn');
  btn.textContent='Processing...';btn.disabled=true;
  try {
    const ticketType=document.getElementById('b-ticket-type')?.value||'General';
    const data=await apiFetch('/bookings',{method:'POST',body:JSON.stringify({event_id:bookingEvent.id,ticket_type:ticketType})});
    document.getElementById('booking-body').innerHTML=`<div class="booking-success"><div class="check">✅</div><h3>Booking Confirmed!</h3><p>${data.event_title}<br>${fmt(data.event_date)}<br>${data.venue||''} ${data.city||''}</p><div class="booking-qr"><img src="${data.qr_code}" alt="QR Code" style="width:150px;height:150px;border-radius:8px"></div><p style="margin-top:16px;font-size:12px;color:var(--green)">Show this QR code at the venue for check-in (+50 Knox Points)</p><button class="btn-secondary" style="margin-top:16px" onclick="closeBooking()">Close</button></div>`;
    document.getElementById('booking-title').textContent='🎫 Booking Confirmed';
    showToast('Ticket booked successfully! 🎉');
  } catch(err) { showToast(err.message,'error'); btn.textContent='Try Again'; btn.disabled=false }
}

// ─── DASHBOARD ──────────────────────────────────────────
async function loadDashboard() {
  if(!authToken) return;
  try {
    const user = await apiFetch('/auth/me');
    currentUser = user;
    document.getElementById('dash-name').textContent=user.full_name;
    document.getElementById('dash-email').textContent=user.email;
    document.getElementById('dash-avatar').textContent=user.full_name[0].toUpperCase();
    document.getElementById('dash-avatar').style.background=user.avatar_color;
    document.getElementById('dash-pts').textContent=user.total_points;
    document.getElementById('dash-rank').textContent=user.rank?'#'+user.rank:'—';
    document.getElementById('dash-evts').textContent=user.checkins_count||0;
    document.getElementById('dash-conn').textContent=user.connections_count||0;
    document.getElementById('topbar-pts').textContent=user.total_points+' pts';
    document.getElementById('topbar-av').textContent=user.full_name[0].toUpperCase();
    document.getElementById('topbar-av').style.background=user.avatar_color;

    // Bookings
    const bookings = await apiFetch('/bookings');
    const uc=document.getElementById('upcoming-container');
    uc.innerHTML = bookings.length>0 ? bookings.map(b=>`<div class="mini-card" onclick="showDetail('${b.event_id}')"><div class="mini-top"><div class="mi blue">${b.event_title[0]}</div><h4>${b.event_title}</h4></div><div class="mm"><span>📅 ${fmtShort(b.start_date)}</span><span>📍 ${b.city}</span></div><div class="mini-bottom"><span class="t-badge ${isFree(b.ticket_price)?'free':'paid'}">${b.ticket_price}</span>${b.checked_in?'<span class="checked-badge">✅ Checked In</span>':'<span class="pending-badge">🎫 Pending</span>'}</div></div>`).join('') : '<div class="empty-state">No bookings yet. <span class="link" onclick="navigateTo(\'events\')">Explore events →</span></div>';

    // Connections
    const connections = await apiFetch('/connections');
    const cl=document.getElementById('connections-list');
    cl.innerHTML = connections.length>0 ? connections.map(c=>`<div class="conn-item"><div class="c-av" style="background:${c.avatar_color}">${c.full_name[0]}</div><div class="c-info"><h5>${c.full_name}</h5><span>⚡ ${c.total_points} pts</span></div></div>`).join('') : '<div class="empty-state">No connections yet.</div>';

    // Attendance history
    const history = await apiFetch('/attendance');
    const al=document.getElementById('attendance-list');
    al.innerHTML = history.length>0 ? history.map(a=>`<div class="att-item"><div class="a-info"><h5>${a.event_title}</h5><span>${a.city||'Online'} · ${a.category}</span></div><div class="a-pts">+${a.points_awarded} pts</div></div>`).join('') : '<div class="empty-state">No check-ins yet.</div>';

    // QR codes
    const ql=document.getElementById('qr-list');
    const upcoming = bookings.filter(b=>!b.checked_in);
    ql.innerHTML = upcoming.length>0 ? upcoming.map(b=>`<div class="qr-card"><h5>${b.event_title}</h5><div class="qr-img">${b.qr_code?`<img src="${b.qr_code}" alt="QR" style="width:120px;height:120px;border-radius:8px">`:'📱 QR Ready'}</div><div class="qr-status">✓ Booked — ${fmtShort(b.start_date)}</div></div>`).join('') : '<div class="empty-state">Book an event to get your QR code.</div>';
  } catch(err) { console.error('Dashboard error:',err) }
}

document.getElementById('addConnBtn').addEventListener('click', async()=>{
  if(isGuest){showAuth();return}
  const el=document.getElementById('conn-email'); const email=el.value.trim();
  if(!email){showToast('Enter an email address','error');return}
  try{await apiFetch('/connections',{method:'POST',body:JSON.stringify({user_email:email})});showToast('Connected! +5 pts for both of you! 🤝');el.value='';loadDashboard()}
  catch(err){showToast(err.message,'error')}
});

// ─── HIGHLIGHTS (with images + detail lightbox) ─────────
let highlightsData = [];

async function loadHighlights() {
  try {
    highlightsData = await apiFetch('/highlights');
    const totalA=highlightsData.reduce((s,h)=>s+(h.stats_attendees||0),0);
    const totalS=highlightsData.reduce((s,h)=>s+(h.stats_speakers||0),0);
    const totalW=highlightsData.reduce((s,h)=>s+(h.stats_workshops||0),0);

    document.getElementById('highlights-stats').innerHTML=`
        <div class="hl-stat"><div class="hs-val">${totalA.toLocaleString()}+</div><div class="hs-lbl">Total Attendees</div></div>
        <div class="hl-stat"><div class="hs-val">${totalS}+</div><div class="hs-lbl">Speakers</div></div>
        <div class="hl-stat"><div class="hs-val">${highlightsData.length}</div><div class="hs-lbl">Events Completed</div></div>
        <div class="hl-stat"><div class="hs-val">${totalW}+</div><div class="hs-lbl">Workshops</div></div>`;

    document.getElementById('highlights-grid').innerHTML = highlightsData.map(h => `
        <div class="hl-card" onclick="openLightbox('${h.id}')">
            ${h.image_url ? `<img class="hl-img" src="${h.image_url}" alt="${h.event_title}" loading="lazy">` :
            `<div class="hl-placeholder">${h.emoji||'📸'}</div>`}
            <div class="hl-body">
                <h4>${h.event_title}</h4>
                <p>${h.description}</p>
                <div class="hl-meta-row">
                  ${h.stats_attendees?`<span class="hl-meta">👥 ${h.stats_attendees}+ attended</span>`:''}
                  ${h.stats_speakers?`<span class="hl-meta">🎤 ${h.stats_speakers} speakers</span>`:''}
                </div>
                <div class="hl-likes">
                  <button class="like-btn ${h.user_liked?'liked':''}" onclick="event.stopPropagation();toggleLike('${h.id}',this)">
                    ${h.user_liked?'❤️':'🤍'} ${h.likes}
                  </button>
                </div>
            </div>
        </div>`).join('');
  } catch(err) { console.error('Highlights error:',err) }
}

async function toggleLike(id,btn) {
  if(isGuest){showToast('Sign in to like highlights','info');showAuth('login');return}
  try { const data=await apiFetch(`/highlights/${id}/like`,{method:'POST'}); btn.innerHTML=`${data.liked?'❤️':'🤍'} ${data.likes}`; btn.classList.toggle('liked',data.liked) }
  catch(err) { showToast('Failed to like','error') }
}

// Enhanced lightbox with image + details
function openLightbox(highlightId) {
  const h = highlightsData.find(x => x.id === highlightId);
  if (!h) return;
  const body = document.getElementById('lightbox-body');
  body.innerHTML = `
    <div class="lightbox-content">
      ${h.image_url ? `<div class="lightbox-img-side"><img src="${h.image_url}" alt="${h.event_title}" class="lightbox-photo"></div>` :
      `<div class="lightbox-img-side"><div class="lightbox-no-img">📷</div></div>`}
      <div class="lightbox-detail-side">
        <h2 class="lightbox-title">${h.event_title}</h2>
        <p class="lightbox-desc">${h.description}</p>
        <div class="lightbox-stats">
          ${h.stats_attendees ? `<div class="lb-stat-item"><span class="lb-stat-icon">👥</span><div><div class="lb-stat-val">${h.stats_attendees.toLocaleString()}+</div><div class="lb-stat-lbl">Attendees</div></div></div>` : ''}
          ${h.stats_speakers ? `<div class="lb-stat-item"><span class="lb-stat-icon">🎤</span><div><div class="lb-stat-val">${h.stats_speakers}</div><div class="lb-stat-lbl">Speakers</div></div></div>` : ''}
          ${h.stats_workshops ? `<div class="lb-stat-item"><span class="lb-stat-icon">💻</span><div><div class="lb-stat-val">${h.stats_workshops}</div><div class="lb-stat-lbl">Workshops</div></div></div>` : ''}
          <div class="lb-stat-item"><span class="lb-stat-icon">❤️</span><div><div class="lb-stat-val">${h.likes}</div><div class="lb-stat-lbl">Likes</div></div></div>
        </div>
        <button class="lightbox-like-btn ${h.user_liked?'liked':''}" onclick="toggleLikeLightbox('${h.id}',this)">
          ${h.user_liked?'❤️ Liked':'🤍 Like this highlight'}
        </button>
      </div>
    </div>`;
  document.getElementById('highlightModal').classList.add('open');
}

async function toggleLikeLightbox(id, btn) {
  if(isGuest){showToast('Sign in to like highlights','info');showAuth('login');return}
  try {
    const data = await apiFetch(`/highlights/${id}/like`,{method:'POST'});
    btn.innerHTML = data.liked ? '❤️ Liked' : '🤍 Like this highlight';
    btn.classList.toggle('liked', data.liked);
    // Also update the card in the grid
    loadHighlights();
  } catch(err) { showToast('Failed to like','error') }
}

function closeLightbox() { document.getElementById('highlightModal').classList.remove('open') }

// ─── LEADERBOARD ────────────────────────────────────────
async function loadLeaderboard() {
  try {
    const users = await apiFetch('/leaderboard');
    if(users.length===0){document.getElementById('podium').innerHTML='<div class="empty-state">No users yet.</div>';return}
    const top3=users.slice(0,3);
    while(top3.length<3) top3.push({full_name:'—',avatar_color:'var(--grad-blue)',total_points:0,events_attended:0,connections_count:0});
    const order=[top3[1],top3[0],top3[2]]; const labels=['2','1','3'];
    document.getElementById('podium').innerHTML=order.map((u,i)=>`<div class="pod-item"><div class="pod-av" style="background:${u.avatar_color}">${(u.full_name||'?')[0]}<span class="pod-rank rk-${labels[i]}">${labels[i]}</span></div><div class="pod-name">${u.full_name}</div><div class="pod-pts">⚡ ${u.total_points} pts</div><div class="pod-evts">${u.events_attended} events · ${u.connections_count} connections</div><div class="pod-bar">${labels[i]}</div></div>`).join('');
    document.getElementById('lb-rows').innerHTML=users.map((u,i)=>`<div class="lb-row ${currentUser&&u.id===currentUser.id?'lb-you':''}"><div class="lb-r">#${i+1}</div><div class="lb-u"><div class="lb-av" style="background:${u.avatar_color}">${(u.full_name||'?')[0]}</div><div class="lb-ui"><h5>${u.full_name}${currentUser&&u.id===currentUser.id?' (You)':''}</h5><span>${u.events_attended} events attended</span></div></div><div class="lb-e">${u.events_attended}</div><div class="lb-c">${u.connections_count}</div><div class="lb-p">⚡ ${u.total_points}</div></div>`).join('');
  } catch(err) { console.error('Leaderboard error:',err) }
}

document.querySelectorAll('.lb-tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.lb-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');loadLeaderboard()}));

// ─── INIT ───────────────────────────────────────────────
async function initApp() {
  initStarfield();
  initScrollAnimations();
  await loadEvents();
  renderHomeHighlights();

  if (authToken) {
    try {
      const user = await apiFetch('/auth/me');
      currentUser = user;
      updateNavForUser();
      // Don't show auth overlay
    } catch(err) {
      authToken = null; localStorage.removeItem('knox_token');
      updateNavForGuest();
      // Guest mode — no overlay forced
    }
  } else {
    updateNavForGuest();
    // Guest mode — no overlay forced
  }
}

document.addEventListener('DOMContentLoaded', initApp);
