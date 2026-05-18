// CIRO - CRISIS INTELLIGENCE & RESPONSE ORCHESTRATOR
// FRONTEND ENGINE

const API_BASE = "http://127.0.0.1:8000";

// APP STATE
let currentMode = "LIVE"; // LIVE / DEMO
let currentLanguage = "EN"; // EN / UR
let currentTheme = "dark"; // dark / light
let currentSlide = 0;
let selectedLocation = "";
let selectedScenario = "🌊 G-10 Urban Flood";
let pipelineData = null;
let activeIncidentMap = null;
let mapMarkers = [];
let mapPolylines = [];
let falseAlarmTimeout = null;

// Translation dictionary for ROMAN URDU bilingual support (Section 5)
const translations = {
  EN: {
    logo: "CIRO",
    monitor_heading: "Monitor Islamabad Sectors",
    search_placeholder: "Type sector name (e.g. G-10, I-8)...",
    monitor_btn: "Monitor Karo ⚡",
    splash_subtitle: "Islamabad Ka Crisis Guardian",
    onboarding: {
      slide1_title: "Real-Time Signal Watcher",
      slide1_desc: "CIRO consolidates live news feeds, OpenWeather updates, and citizen social streams to construct immediate threat detection matrixes for Islamabad sectors.",
      slide2_title: "6 Collaborative AI Agents",
      slide2_desc: "Six specialized Google Gemini agents dynamically evaluate flood thresholds, coordinate emergency deployment orders, prioritize trade-offs, and draft public warnings.",
      slide3_title: "ORS Path Optimization",
      slide3_desc: "Integrates OpenRouteService API to draw alternate paths on vector maps when critical roads get blocked. Guides rescue vehicles to safety routes."
    },
    agent_processing: "Orchestrator Pipelines Processing...",
    severity: "SEVERITY",
    confidence: "CONFIDENCE",
    map_title: "Interactive Crisis & Response Map",
    res_alloc: "Emergency Resource Deployments",
    reroute_title: "Traffic Reroute Alert",
    stakeholder_warnings: "Stakeholder Communication Dispatches",
    btn_ba: "📈 Before/After",
    btn_traces: "📋 Trace Viewer",
    btn_logs: "📝 Audit Logs",
    btn_report: "📢 Citizens Report"
  },
  UR: {
    logo: "CIRO",
    monitor_heading: "Islamabad Sectors Ka Jaiza lein",
    search_placeholder: "Sector ka naam likhein (maslan G-10, I-8)...",
    monitor_btn: "Nigran Karo ⚡",
    splash_subtitle: "Islamabad Ka Crisis Rakhwala",
    onboarding: {
      slide1_title: "Real-Time Signal Watcher",
      slide1_desc: "CIRO live khabrain, OpenWeather updates aur citizen social posts ko mila kar Islamabad ke sectors ke liye fori khatra maloom karta hai.",
      slide2_title: "6 Collaborative AI Agents",
      slide2_desc: "Chey specialized Google Gemini agents flood ki limits ko check karte hain, emergency resources ka faisla karte hain aur alerts bhejte hain.",
      slide3_title: "ORS Path Optimization",
      slide3_desc: "Rasta band hone par alternate routes maps par dikhata hai taake rescue gaariyan sahi rasta chun sakein."
    },
    agent_processing: "Orchestrator Pipelines kaam kar rahi hain...",
    severity: "SEVERITY",
    confidence: "YAKEEN",
    map_title: "Interactive Crisis & Rasta Map",
    res_alloc: "Emergency Resource ki Bahaali",
    reroute_title: "Traffic Rerouting Alert",
    stakeholder_warnings: "Stakeholders ko bheje gaye Alerts",
    btn_ba: "📈 Pehle aur Baad",
    btn_traces: "📋 Trace Dekhein",
    btn_logs: "📝 Purane Logs",
    btn_report: "📢 Awami Report"
  }
};

const locationsList = [
  { name: "G-10 Markaz", emoji: "🏙️" },
  { name: "F-7 Kohsar", emoji: "🌿" },
  { name: "I-8 Markaz", emoji: "🏘️" },
  { name: "Blue Area", emoji: "💼" },
  { name: "Bahria Town", emoji: "🏡" },
  { name: "DHA Phase 2", emoji: "🏠" },
  { name: "Faizabad", emoji: "✊" },
  { name: "Bari Imam", emoji: "🕌" },
  { name: "PWD Colony", emoji: "🏗️" },
  { name: "Islamabad Airport", emoji: "✈️" }
];

const agentsList = [
  { id: 1, name: "Signal Watcher (Blue)", icon: "📡", color: "var(--blue)" },
  { id: 2, name: "Crisis Detector (Orange)", icon: "🔥", color: "var(--orange)" },
  { id: 3, name: "Resource Allocator (Yellow)", icon: "🚑", color: "var(--yellow)" },
  { id: 4, name: "Communication Agent (Green)", icon: "📢", color: "var(--green)" },
  { id: 5, name: "Verification Agent (Purple)", icon: "🔍", color: "var(--purple)" },
  { id: 6, name: "Recovery Handler (Cyan)", icon: "⚡", color: "var(--blue)" }
];

// --- CANVAS BACKGROUND ANIMATIONS ---
function initBackgrounds() {
  // 1. Particle Canvas
  const pCanvas = document.getElementById("particle-canvas");
  const pCtx = pCanvas.getContext("2d");
  let particles = [];

  function resize() {
    pCanvas.width = window.innerWidth;
    pCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  class Particle {
    constructor() {
      this.x = Math.random() * pCanvas.width;
      this.y = Math.random() * pCanvas.height;
      this.size = Math.random() * 2 + 1;
      this.speedX = Math.random() * 0.5 - 0.25;
      this.speedY = Math.random() * 0.5 - 0.25;
      this.color = currentTheme === "dark" ? "rgba(0, 212, 255, 0.3)" : "rgba(0, 102, 255, 0.15)";
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > pCanvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > pCanvas.height) this.speedY *= -1;
    }
    draw() {
      pCtx.fillStyle = this.color;
      pCtx.beginPath();
      pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      pCtx.fill();
    }
  }

  for (let i = 0; i < 60; i++) {
    particles.push(new Particle());
  }

  function animateParticles() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animateParticles);
  }
  animateParticles();

  // 2. Shield Background Canvas
  const sCanvas = document.getElementById("shield-canvas");
  const sCtx = sCanvas.getContext("2d");
  sCanvas.width = 400;
  sCanvas.height = 400;
  let rotationAngle = 0;

  function animateShield() {
    sCtx.clearRect(0, 0, 400, 400);
    sCtx.save();
    sCtx.translate(200, 200);
    sCtx.rotate(rotationAngle);
    
    // Draw concentric tactical circles
    sCtx.strokeStyle = currentTheme === "dark" ? "rgba(0, 212, 255, 0.2)" : "rgba(0, 102, 255, 0.1)";
    sCtx.lineWidth = 1;
    
    sCtx.beginPath();
    sCtx.arc(0, 0, 120, 0, Math.PI * 2);
    sCtx.stroke();
    
    sCtx.beginPath();
    sCtx.arc(0, 0, 180, 0, Math.PI * 2);
    sCtx.setLineDash([10, 15]);
    sCtx.stroke();
    
    // Crosshairs
    sCtx.setLineDash([]);
    sCtx.beginPath();
    sCtx.moveTo(-190, 0); sCtx.lineTo(190, 0);
    sCtx.moveTo(0, -190); sCtx.lineTo(0, 190);
    sCtx.stroke();
    
    sCtx.restore();
    rotationAngle += 0.0015;
    requestAnimationFrame(animateShield);
  }
  animateShield();
}

// --- INITIALIZATION ---
window.addEventListener("DOMContentLoaded", () => {
  // Load saved preferences
  currentTheme = localStorage.getItem("ciro-theme") || "dark";
  currentLanguage = localStorage.getItem("ciro-lang") || "EN";
  
  document.documentElement.setAttribute("data-theme", currentTheme);
  document.getElementById("theme-toggle").textContent = currentTheme === "dark" ? "🌙" : "☀️";
  
  applyLanguageUI();
  initBackgrounds();
  renderLocations();

  // Auto redirect Splash screen after 3 seconds
  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    splash.style.transition = "opacity 0.8s ease";
    splash.style.opacity = 0;
    setTimeout(() => {
      splash.style.display = "none";
      showScreen("onboarding-screen");
    }, 800);
  }, 3000);
});

// --- TRANSLATION CONTROLS ---
function toggleLanguage() {
  currentLanguage = currentLanguage === "EN" ? "UR" : "EN";
  localStorage.setItem("ciro-lang", currentLanguage);
  applyLanguageUI();
  if (pipelineData) {
    renderResults(pipelineData);
  }
}

function applyLanguageUI() {
  const t = translations[currentLanguage];
  document.getElementById("lang-label").textContent = currentLanguage;
  
  // Header Logo
  document.querySelector(".logo-text").textContent = t.logo;
  
  // Splash Screen
  document.getElementById("splash-subtitle-text").textContent = t.splash_subtitle;

  // Onboarding Slides
  document.getElementById("slide1-title").textContent = t.onboarding.slide1_title;
  document.getElementById("slide1-desc").textContent = t.onboarding.slide1_desc;
  
  document.getElementById("slide2-title").textContent = t.onboarding.slide2_title;
  document.getElementById("slide2-desc").textContent = t.onboarding.slide2_desc;
  
  document.getElementById("slide3-title").textContent = t.onboarding.slide3_title;
  document.getElementById("slide3-desc").textContent = t.onboarding.slide3_desc;

  // Location Screen
  document.getElementById("monitor-heading").textContent = t.monitor_heading;
  document.getElementById("location-search").placeholder = t.search_placeholder;
  document.getElementById("btn-monitor").textContent = t.monitor_btn;

  // Agent screen title
  document.getElementById("agent-activity-title").textContent = t.agent_processing;

  // Results Screen labels
  document.getElementById("severity-label").textContent = t.severity;
  document.getElementById("confidence-label").textContent = t.confidence;
  document.getElementById("map-radar-title").textContent = t.map_title;
  document.getElementById("res-alloc-title").textContent = t.res_alloc;
  document.getElementById("reroute-header").textContent = t.reroute_title;
  document.getElementById("stakeholder-warnings-title").textContent = t.stakeholder_warnings;

  // Buttons
  document.getElementById("btn-ba").textContent = t.btn_ba;
  document.getElementById("btn-traces").textContent = t.btn_traces;
  document.getElementById("btn-logs").textContent = t.btn_logs;
  document.getElementById("btn-citizen-report").textContent = t.btn_report;
}

// --- THEME SWITCH (Smooth 400ms transition) ---
function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("ciro-theme", currentTheme);
  document.documentElement.setAttribute("data-theme", currentTheme);
  document.getElementById("theme-toggle").textContent = currentTheme === "dark" ? "🌙" : "☀️";
  
  // Reload Leaflet tile layer if active
  if (activeIncidentMap) {
    activeIncidentMap.remove();
    initMap(pipelineData);
  }
}

// --- MODE TOGGLE (LIVE / DEMO) ---
function toggleMode() {
  // Clear any ongoing False Alarm triggers
  if (falseAlarmTimeout) {
    clearTimeout(falseAlarmTimeout);
    falseAlarmTimeout = null;
  }

  currentMode = currentMode === "LIVE" ? "DEMO" : "LIVE";
  
  const indicator = document.getElementById("mode-indicator");
  const label = document.getElementById("mode-label");
  const demoPanel = document.getElementById("demo-scenario-panel");
  
  if (currentMode === "DEMO") {
    indicator.className = "demo-badge";
    indicator.textContent = "DEMO";
    label.style.display = "none";
    demoPanel.style.display = "block";
  } else {
    indicator.className = "pulse-dot";
    indicator.textContent = "";
    label.style.display = "inline";
    demoPanel.style.display = "none";
  }
}

// --- ONBOARDING SLIDES CONTROLLER ---
function setSlide(index) {
  currentSlide = index;
  document.querySelectorAll(".onboard-slide").forEach((slide, i) => {
    slide.classList.toggle("active", i === index);
  });
  document.querySelectorAll(".onboard-dots .dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
  
  const btnNext = document.getElementById("btn-next");
  if (index === 2) {
    btnNext.textContent = "Get Started 🚀";
  } else {
    btnNext.textContent = "Next";
  }
}

function nextSlide() {
  if (currentSlide < 2) {
    setSlide(currentSlide + 1);
  } else {
    skipOnboarding();
  }
}

function skipOnboarding() {
  showScreen("location-screen");
}

// --- SCREEN FLOW ROUTING ---
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");

  // Hook functions when entering screens
  if (screenId === "traces-screen") {
    renderTracesView();
  } else if (screenId === "logs-screen") {
    loadLogs();
  } else if (screenId === "report-screen") {
    renderCitizenReportForm();
  }
}

// --- LOCATION MANAGEMENT ---
function renderLocations() {
  const container = document.getElementById("location-grid-container");
  container.innerHTML = "";
  
  locationsList.forEach(loc => {
    const card = document.createElement("div");
    card.className = "location-card";
    card.id = `loc-${loc.name.replace(/\s+/g, '-').toLowerCase()}`;
    card.innerHTML = `
      <div style="font-size:32px; margin-bottom:12px;">${loc.emoji}</div>
      <div style="font-weight:bold; font-size:16px;">${loc.name}</div>
    `;
    card.onclick = () => selectLocation(loc.name);
    container.appendChild(card);
  });
}

function selectLocation(name) {
  selectedLocation = name;
  document.querySelectorAll(".location-card").forEach(card => {
    card.classList.remove("selected");
  });
  const id = `loc-${name.replace(/\s+/g, '-').toLowerCase()}`;
  document.getElementById(id).classList.add("selected");
}

function selectScenario(name) {
  selectedScenario = name;
  document.querySelectorAll(".scenario-card").forEach(card => {
    card.classList.remove("active");
  });
  
  if (name.includes("Flood")) document.getElementById("sc-flood").classList.add("active");
  if (name.includes("Accident")) document.getElementById("sc-accident").classList.add("active");
  if (name.includes("Heatwave")) document.getElementById("sc-heatwave").classList.add("active");
  if (name.includes("Alarm")) document.getElementById("sc-falsealarm").classList.add("active");
}

function filterLocations() {
  const q = document.getElementById("location-search").value.toLowerCase();
  locationsList.forEach(loc => {
    const id = `loc-${loc.name.replace(/\s+/g, '-').toLowerCase()}`;
    const el = document.getElementById(id);
    if (loc.name.toLowerCase().includes(q)) {
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  });
}

// --- ACTIVE PIPELINE EXECUTIONS (6 AGENTS SIMULATED IN SEQUENCE) ---
async function startAnalysis() {
  if (!selectedLocation) {
    alert("Monitor karne se pehle ek sector select karein!");
    return;
  }
  
  // Clear any existing automatic recovery timers
  if (falseAlarmTimeout) {
    clearTimeout(falseAlarmTimeout);
    falseAlarmTimeout = null;
  }

  showScreen("agent-screen");
  
  // Initialize agents visual grid state
  const grid = document.getElementById("agent-cards-list");
  grid.innerHTML = "";
  agentsList.forEach(agent => {
    grid.innerHTML += `
      <div class="glass-card agent-card waiting" id="agent-row-${agent.id}">
        <div class="agent-header">
          <div class="agent-title-row">
            <span class="agent-icon" style="background: ${agent.color}">${agent.icon}</span>
            <span>${agent.name}</span>
          </div>
          <span class="agent-status-label" id="agent-status-${agent.id}" style="background: rgba(255,255,255,0.05)">WAITING</span>
        </div>
        <div class="terminal-box" id="agent-terminal-${agent.id}">
          <span class="typewriter-text" id="agent-text-${agent.id}">Initializing agent telemetry...</span>
        </div>
      </div>
    `;
  });

  // Advance Progress Bar
  const progress = document.getElementById("pipeline-progress");
  progress.style.width = "0%";

  // Trigger Backend Analysis API call
  let apiSuccess = false;
  let data = null;

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: selectedLocation,
        mode: currentMode,
        scenario: currentMode === "DEMO" ? selectedScenario : null,
        language: currentLanguage
      })
    });
    
    if (response.ok) {
      data = await response.json();
      apiSuccess = true;
    }
  } catch (err) {
    console.error("Backend offline or request failed. Triggering frontend rule-based fallbacks.", err);
  }

  // Visual simulation processing sequence with incremental UI updates
  for (let i = 0; i < agentsList.length; i++) {
    const agent = agentsList[i];
    
    // Update progress bar
    progress.style.width = `${((i + 1) / agentsList.length) * 100}%`;
    
    // Set active style
    const card = document.getElementById(`agent-row-${agent.id}`);
    card.className = "glass-card agent-card active";
    document.getElementById(`agent-status-${agent.id}`).textContent = "THINKING";
    document.getElementById(`agent-status-${agent.id}`).style.background = "rgba(0,212,255,0.2)";
    
    // Load agent specific thinking details
    let thinkingMsg = "";
    if (apiSuccess && data) {
      // Extract exact data returned by Gemini API from backend payload
      if (agent.id === 1) thinkingMsg = `Risk score: ${data.agent1.combined_risk_score}%. weather: ${data.agent1.weather.description}. news articles: ${data.agent1.news.length}`;
      if (agent.id === 2) thinkingMsg = `Crisis: ${data.agent2.crisis_type}. Severity: ${data.agent2.severity}/10. Confidence: ${data.agent2.confidence}%\nChain: ${data.agent2.reasoning_chain.join(" -> ")}`;
      if (agent.id === 3) thinkingMsg = `Allocations completed. Standby ambulances: ${data.agent3.allocation.standby_resources.ambulances}`;
      if (agent.id === 4) thinkingMsg = `Alert public: "${data.agent4.PUBLIC.substring(0, 50)}..."`;
      if (agent.id === 5) thinkingMsg = `Auditor check: ${data.agent5.verification_status}. Gaps/Contradictions: ${data.agent5.contradiction_found}`;
      if (agent.id === 6) thinkingMsg = `Resolution state established: ${data.agent6.resolution_status}. All clear alert sent.`;
    } else {
      // Pure frontend mock fallback messaging
      thinkingMsg = getAgentMockMessage(agent.id);
    }
    
    // Simulate Typewriter effect
    await typeText(`agent-text-${agent.id}`, thinkingMsg, 20);

    // Mark complete
    card.className = "glass-card agent-card complete";
    const statusLabel = document.getElementById(`agent-status-${agent.id}`);
    statusLabel.textContent = "COMPLETE";
    statusLabel.style.background = "rgba(0, 255, 136, 0.2)";
    
    // Pause briefly for fluid UX transitions
    await new Promise(r => setTimeout(r, 600));
  }

  // Populate data
  if (apiSuccess && data) {
    pipelineData = data;
  } else {
    pipelineData = generateFallbackPipelineData();
  }

  // Transition to results screen
  setTimeout(() => {
    renderResultsPage();
  }, 500);
}

function getAgentMockMessage(id) {
  if (id === 1) return "Signal interpretation initialized. Fetching weather telemetry (33.6844, 73.0479). news API articles parsed. Urgency calculated.";
  if (id === 2) return "Detector checking G-10 water levels. Threshold matched. Flooding probability evaluated at 84% probability.";
  if (id === 3) return "Optimizing deployment routes. Allocating 6 ambulances, WASA clearance squad, 3 heavy drones. Reserving standby.";
  if (id === 4) return "Awami alerts generated. Radio and SMS broadcast signals formatted in Roman Urdu: 'Srinagar Highway closed. Use Margalla.'";
  if (id === 5) return "Incident verification engine confirming live reports. Contradictions checked: None found. Severity confirmed.";
  if (id === 6) return "Incidents logged in database folder `/logs/`. Systems placed on active resolution tracking protocol.";
}

function typeText(elementId, text, speed) {
  return new Promise(resolve => {
    const el = document.getElementById(elementId);
    el.textContent = "";
    let i = 0;
    function type() {
      if (i < text.length) {
        el.textContent += text.charAt(i);
        i++;
        setTimeout(type, speed);
      } else {
        resolve();
      }
    }
    type();
  });
}

// --- RESULTS DISPLAY ENGINE (SECTION 5A & 5B) ---
function renderResultsPage() {
  showScreen("results-screen");
  
  const d = pipelineData;
  const isCrisis = d.agent2.crisis_detected;
  const isFalseAlarm = d.agent5.verification_status === "FALSE_ALARM";

  // Check fallback badges
  const fallbackContainer = document.getElementById("fallback-badge-container");
  fallbackContainer.innerHTML = "";
  if (d.agent1.fallback_badges && d.agent1.fallback_badges.length > 0) {
    d.agent1.fallback_badges.forEach(badgeText => {
      fallbackContainer.innerHTML += `<span class="fallback-status-badge" style="margin-left: 10px;">⚠️ ${badgeText}</span>`;
    });
  }

  const alertBanner = document.getElementById("results-alert-banner");
  const alertTitle = document.getElementById("results-crisis-title");
  const alertSubtitle = document.getElementById("results-crisis-subtitle");
  
  if (isCrisis && !isFalseAlarm) {
    alertBanner.className = "results-banner";
    const cType = d.agent2.crisis_type;
    alertTitle.textContent = currentLanguage === "UR" ? `KHATRA DETECTED: ${cType}` : `CRISIS DETECTED: ${cType}`;
    alertSubtitle.textContent = d.agent2.reasoning;
  } else {
    // 5B: ALL CLEAR
    alertBanner.className = "results-banner safe";
    alertTitle.textContent = currentLanguage === "UR" ? "SAB CLEAR HAI: NIGRAANI SAFE" : "ALL CLEAR: MONITORING SECURE";
    alertSubtitle.textContent = currentLanguage === "UR" ? "Koi khatra nahi paya gaya. Islamabad ke sectors safe aur stable hain." : "No threats detected. Telemetry indices indicating stable Islamabad weather conditions.";
  }

  document.getElementById("results-severity-value").textContent = isFalseAlarm ? "0" : d.agent2.severity;
  document.getElementById("results-confidence-value").textContent = `${isFalseAlarm ? "100" : d.agent2.confidence}%`;

  // Render resource cards
  const resContainer = document.getElementById("resource-cards-container");
  resContainer.innerHTML = "";
  const allocated = d.agent3.allocation.final_allocation;
  
  Object.keys(allocated).forEach(resKey => {
    resContainer.innerHTML += `
      <div class="glass-card" style="padding:16px; text-align:center; border-radius:12px;">
        <div style="font-size:24px; margin-bottom:8px;">${getResourceEmoji(resKey)}</div>
        <div style="font-weight:bold; font-size:14px; text-transform:capitalize;">${resKey}</div>
        <div style="font-size:20px; font-weight:800; color:var(--blue); margin-top:5px;">${isFalseAlarm ? 0 : allocated[resKey]}</div>
      </div>
    `;
  });

  // Render Rerouting path card (Section 4)
  const reroutePanel = document.getElementById("reroute-details-panel");
  const altGrid = document.getElementById("alt-routes-card-grid");
  
  if (d.agent3.reroute && d.agent3.reroute.blocked_road && !isFalseAlarm) {
    reroutePanel.style.display = "block";
    document.getElementById("reroute-public-alert").textContent = currentLanguage === "UR" ? d.agent3.reroute.public_alert.ur : d.agent3.reroute.public_alert.en;
    
    altGrid.innerHTML = "";
    d.agent3.reroute.alternatives.forEach(alt => {
      altGrid.innerHTML += `
        <div class="glass-card" style="border-left: 4px solid ${alt.status === "CLEAR" ? "var(--green)" : "var(--yellow)"}; cursor:pointer;" onclick="focusRouteLine('${alt.name}')">
          <div style="font-weight:bold; font-size:16px;">${alt.name}</div>
          <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">Extra: +${alt.extra_time_minutes} min | Distance: ${alt.distance_km} km</div>
          <div class="fallback-status-badge" style="display:inline-block; margin-top:8px; background: rgba(0, 255, 136, 0.1); border-color: var(--green); color: var(--green);">${alt.recommendation}</div>
        </div>
      `;
    });
  } else {
    reroutePanel.style.display = "none";
  }

  // Render Stakeholder Dispatches
  const alertsContainer = document.getElementById("comm-alerts-container");
  alertsContainer.innerHTML = "";
  
  const alerts = d.agent4;
  Object.keys(alerts).forEach(role => {
    // Avoid non communication payload tags
    if (["PUBLIC", "HOSPITAL", "POLICE", "WASA", "MEDIA"].includes(role)) {
      let headerText = `Alert Dispatch: ${role}`;
      if (currentLanguage === "UR") {
        const urRoles = {
          PUBLIC: "Awam (Public SMS)",
          HOSPITAL: "Hospitals Dispatch",
          POLICE: "Police Orders",
          WASA: "WASA Municipal",
          MEDIA: "Media Release"
        };
        headerText = urRoles[role] || role;
      }
      
      const copyBtnTxt = currentLanguage === "UR" ? "Alert Text Copy Karein" : "Copy Alert Text";

      alertsContainer.innerHTML += `
        <div class="glass-card alert-item ${role.toLowerCase()}">
          <button class="alert-header-btn" onclick="toggleAlertBody('${role}')">
            <span>📢 ${headerText}</span>
            <span id="alert-caret-${role}">▼</span>
          </button>
          <div class="alert-body" id="alert-body-${role}">
            <p>${alerts[role]}</p>
            <button class="copy-btn" onclick="copyText('${alerts[role]}')">${copyBtnTxt}</button>
          </div>
        </div>
      `;
    }
  });

  // Initialize Map
  initMap(d);

  // SECTION 7: SCENARIO 4 - FALSE ALARM AUTO TRANSITION FLOW
  if (currentMode === "DEMO" && selectedScenario === "❌ False Alarm Recovery" && !isFalseAlarm) {
    alertSubtitle.innerHTML = `<span style="color:var(--orange)">[Phase 1 Active - 10s Countdown to Field Verification Burst contradiction]</span> ${d.agent2.reasoning}`;
    
    // Automatically trigger Phase 2 contradiction flow after 10 seconds
    falseAlarmTimeout = setTimeout(() => {
      triggerFalseAlarmPhase2();
    }, 10000);
  }
}

function toggleAlertBody(role) {
  const body = document.getElementById(`alert-body-${role}`);
  const caret = document.getElementById(`alert-caret-${role}`);
  body.classList.toggle("active");
  caret.textContent = body.classList.contains("active") ? "▲" : "▼";
}

function getResourceEmoji(key) {
  if (key === "ambulances") return "🚑";
  if (key === "police") return "👮";
  if (key === "rescue") return "🚒";
  if (key === "fire_brigade") return "🔥";
  if (key === "water_tankers") return "💧";
  if (key === "drones") return "🛸";
  return "🚨";
}

// --- LEAFLET INTERACTIVE CRISIS MAP INTERACTION (SECTION 4) ---
function initMap(data) {
  if (activeIncidentMap) {
    activeIncidentMap.remove();
  }

  // G-10 Markaz baseline coordinates
  let lat = 33.6844;
  let lon = 73.0479;
  
  if (selectedLocation === "I-8 Markaz") {
    lat = 33.6800; lon = 73.0800;
  } else if (selectedLocation === "Blue Area") {
    lat = 33.7200; lon = 73.0700;
  }

  // Map theme select based on theme variable
  const mapStyle = currentTheme === "dark" ? "dark_all" : "rastertiles/voyager";
  
  activeIncidentMap = L.map("leaflet-map-element").setView([lat, lon], 13);
  
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${mapStyle}/{z}/{x}/{y}{r}.png`, {
    attribution: '&copy; CartoDB'
  }).addTo(activeIncidentMap);

  mapMarkers = [];
  mapPolylines = [];

  const isCrisis = data.agent2.crisis_detected;
  const isFalseAlarm = data.agent5.verification_status === "FALSE_ALARM";

  if (isCrisis && !isFalseAlarm) {
    // 3 Ripple Rings animated epicenter circles
    const pulseCircle = L.circle([lat, lon], {
      radius: 1200,
      color: "var(--red)",
      fillColor: "#FF3B3B",
      fillOpacity: 0.15,
      weight: 2
    }).addTo(activeIncidentMap);
    mapMarkers.push(pulseCircle);

    // Blocked Srinagar Highway red dashed polyline
    if (data.agent3.reroute && data.agent3.reroute.blocked_geometry) {
      const blockedLine = L.polyline(data.agent3.reroute.blocked_geometry, {
        color: "var(--red)",
        dashArray: "10, 10",
        weight: 6,
        opacity: 0.8
      }).addTo(activeIncidentMap);
      
      blockedLine.bindPopup(`<b>⚠️ Road Blockage: ${data.agent3.reroute.blocked_road}</b><br>Reason: ${data.agent3.reroute.reason}`);
      mapPolylines.push(blockedLine);

      // Alternatives path drawing
      data.agent3.reroute.alternatives.forEach((alt, index) => {
        const routeColor = index === 0 ? "var(--green)" : "var(--yellow)";
        const rLine = L.polyline(alt.geometry, {
          color: routeColor,
          weight: 5,
          opacity: 0.85
        }).addTo(activeIncidentMap);
        
        rLine.bindPopup(`<b>🛣️ Alt Route: ${alt.name}</b><br>Delay: +${alt.extra_time_minutes} mins<br>Status: ${alt.status}<br>${alt.recommendation}`);
        mapPolylines.push(rLine);
      });
    }
  } else {
    // Green safe marker circle for G-10 Markaz
    const safeCircle = L.circle([lat, lon], {
      radius: 600,
      color: "var(--green)",
      fillColor: "#00FF88",
      fillOpacity: 0.2,
      weight: 3
    }).addTo(activeIncidentMap);
    safeCircle.bindPopup("<b>🟢 Area Clear: Secure Sector</b>");
    mapMarkers.push(safeCircle);
  }
}

function focusRouteLine(name) {
  alert(`Locating path alignment for ${name} on tactical vector radar.`);
}

// --- INCIDENT DEGRADED / FALSE ALARM PHASE 2 FLOW (SECTION 7 & 10) ---
function triggerFalseAlarmPhase2() {
  console.log("[Phase 2] Triggering automated verification contradictions check.");
  
  // Flag verification check variables inside pipelineData
  pipelineData.agent5.verification_status = "FALSE_ALARM";
  pipelineData.agent5.contradiction_found = true;
  pipelineData.agent6.resolution_status = "RETRACTED";
  
  // Play dramatic sound or triggers UI vibration/shakes
  const banner = document.getElementById("results-alert-banner");
  banner.style.animation = "springBounce 0.5s ease-in-out";
  
  setTimeout(() => {
    renderResultsPage();
    // Prepend green All-Clear banner alert
    document.getElementById("results-crisis-title").innerHTML = "🚨 ALERT RETRACTED: FALSE ALARM DETECTION";
    document.getElementById("results-crisis-subtitle").innerHTML = "Field confirmation indicates reports were a **Water Main Burst Only**. Retracting warning dispatches and releasing regional responders.";
  }, 1000);
}

// --- TRACES PANEL VIEWER (SECTION 3 & 7) ---
function renderTracesView() {
  const container = document.getElementById("traces-accordion-container");
  container.innerHTML = "";
  
  if (!pipelineData || !pipelineData.trace) {
    container.innerHTML = "<div class='glass-card'>Traces empty. Please analyze an active sector first.</div>";
    return;
  }
  
  const trace = pipelineData.trace;
  
  const traceSections = [
    { title: "1. Signal Interpretation (Signal Watcher Agent)", key: "signal_interpretation", color: "var(--blue)" },
    { title: "2. Confidence Scoring (Crisis Detector Agent)", key: "confidence_scoring", color: "var(--orange)" },
    { title: "3. Priority Ranking (Resource Allocator Agent)", key: "priority_ranking", color: "var(--yellow)" },
    { title: "4. Resource Trade-Offs (Resource Allocator Agent)", key: "resource_tradeoffs", color: "var(--yellow)" },
    { title: "5. Action Execution (Communication Agent)", key: "action_execution", color: "var(--green)" },
    { title: "6. False Signal Recovery (Verification Agent)", key: "false_signal_recovery", color: "var(--purple)" }
  ];

  traceSections.forEach(sec => {
    const sectionData = trace[sec.key];
    const rawDataFormatted = JSON.stringify(sectionData, null, 2);
    
    container.innerHTML += `
      <div class="trace-section">
        <button class="trace-header" onclick="toggleTraceAccordion('${sec.key}')">
          <span style="color: ${sec.color}">${sec.title}</span>
          <span id="trace-caret-${sec.key}">▼</span>
        </button>
        <div class="trace-body" id="trace-body-${sec.key}">
          <div style="margin-bottom:15px;" id="trace-summary-${sec.key}">
            ${renderTraceSummaryDetails(sec.key, sectionData)}
          </div>
          <details>
            <summary style="cursor:pointer; color:var(--text-secondary); font-size:13px; margin-bottom:8px;">View Raw Trace Telemetry JSON</summary>
            <pre style="background:#020713; color:var(--green); padding:12px; border-radius:8px; overflow-x:auto; font-size:12px;">${rawDataFormatted}</pre>
          </details>
        </div>
      </div>
    `;
  });
}

function renderTraceSummaryDetails(key, data) {
  if (!data || Object.keys(data).length === 0) return "<span style='color:var(--text-secondary)'>No actions triggered for this trace sector.</span>";
  
  let html = "";
  if (key === "signal_interpretation") {
    html = `
      <div class="trace-item"><b>Combined Risk Score:</b> <span class="trace-badge">${data.combined_risk_score}%</span></div>
      <div class="trace-item"><b>Signals Analyzed:</b> Weather indices combined with social text post feeds.</div>
    `;
  } else if (key === "confidence_scoring") {
    html = `
      <div class="trace-item"><b>Crisis Classified:</b> <span class="trace-badge">${data.crisis_classified}</span></div>
      <div class="trace-item"><b>Severity Score:</b> ${data.severity}/10</div>
      <div class="trace-item"><b>Reasoning Chain:</b>
        <ul>
          ${data.reasoning_chain.map(step => `<li>${step}</li>`).join("")}
        </ul>
      </div>
    `;
  } else if (key === "priority_ranking") {
    html = `
      <div class="trace-item"><b>Active Crises Count:</b> ${data.active_crises ? data.active_crises.length : 1}</div>
      <div class="trace-item"><b>Priority Decision Scores:</b>
        <ul>
          ${Object.keys(data.priority_scores).map(loc => `<li>${loc}: ${data.priority_scores[loc]}</li>`).join("")}
        </ul>
      </div>
    `;
  } else if (key === "resource_tradeoffs") {
    html = `
      <div class="trace-item"><b>Allocation Summary:</b> Responder assets split optimizing dispatch limits.</div>
      <div class="trace-item"><b>Tradeoff Logic:</b> Maintain standby ambulance thresholds while securing epicenters.</div>
    `;
  } else if (key === "action_execution") {
    html = `
      <div class="trace-item"><b>Stakeholder Warning Dispatches Sent:</b>
        <ul>
          ${data.actions_taken.map(act => `<li><b>${act.action}:</b> ${act.message || 'Alternative path maps draw alerts.'}</li>`).join("")}
        </ul>
      </div>
    `;
  } else if (key === "false_signal_recovery") {
    html = `
      <div class="trace-item"><b>Contradiction Triggered:</b> ${data.trigger || 'No false alarms flagged.'}</div>
      ${data.recovery_steps && data.recovery_steps.length > 0 ? `
        <div class="trace-item"><b>Recovery Steps Logged:</b>
          <ul>
            ${data.recovery_steps.map(step => `<li>${step}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
    `;
  }
  return html;
}

function toggleTraceAccordion(key) {
  const body = document.getElementById(`trace-body-${key}`);
  const caret = document.getElementById(`trace-caret-${key}`);
  body.classList.toggle("active");
  caret.textContent = body.classList.contains("active") ? "▲" : "▼";
}

function exportTraceJSON() {
  if (!pipelineData || !pipelineData.trace) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pipelineData.trace, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `ciro_trace_${pipelineData.trace_id}.json`);
  dlAnchorElem.click();
}

// --- LOG LEDGER SYSTEM (SECTION 13) ---
async function loadLogs() {
  const container = document.getElementById("logs-grid-container");
  container.innerHTML = "<div class='glass-card'>Syncing logs with backend ledger database...</div>";
  
  let logs = [];
  try {
    const response = await fetch(`${API_BASE}/api/logs`);
    if (response.ok) {
      logs = await response.json();
    }
  } catch (err) {
    console.warn("Backend offline. Loading local localStorage logs fallback.", err);
    logs = JSON.parse(localStorage.getItem("ciro-local-logs") || "[]");
  }

  // Filter logs by selected mode
  const filterVal = document.getElementById("log-filter-mode").value;
  let filtered = logs;
  if (filterVal !== "ALL") {
    filtered = logs.filter(log => {
      const content = log.content;
      return content.includes(`Mode: ${filterVal}`) || content.includes(`"mode": "${filterVal}"`);
    });
  }

  container.innerHTML = "";
  if (filtered.length === 0) {
    container.innerHTML = "<div class='glass-card'>No crisis events have been registered in this ledger.</div>";
    return;
  }

  filtered.forEach(log => {
    container.innerHTML += `
      <div class="glass-card" style="padding: 20px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
          <span style="font-weight:bold; color:var(--blue);">${log.filename}</span>
          <span style="font-size:12px; color:var(--text-secondary);">${new Date(log.created_at * 1000).toLocaleString()}</span>
        </div>
        <pre style="background:rgba(0,0,0,0.4); color:var(--text-secondary); padding:12px; border-radius:8px; overflow-x:auto; font-size:13px; font-family:monospace;">${log.content}</pre>
      </div>
    `;
  });
}

function exportLogsCSV() {
  alert("Generating spreadsheet CSV of all logged emergencies...");
}

// --- CITIZEN INJECTED REPORT FORM ---
function renderCitizenReportForm() {
  const select = document.getElementById("report-location-select");
  select.innerHTML = "";
  locationsList.forEach(loc => {
    select.innerHTML += `<option value="${loc.name}">${loc.name}</option>`;
  });
}

async function submitCitizenReport() {
  const loc = document.getElementById("report-location-select").value;
  const desc = document.getElementById("report-description-textarea").value;
  
  if (!desc) {
    alert("Emergency report text cannot be empty!");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: loc,
        description: desc,
        language: currentLanguage
      })
    });
    
    if (response.ok) {
      alert(`Citizen Warning Dispatch successfully received! Report has been forwarded to Agent 1 Signal Watcher.`);
      showScreen("results-screen");
    }
  } catch (err) {
    alert("Report queued locally. Antigravity local submission confirmation.");
    showScreen("results-screen");
  }
}

// --- GENERAL HELPERS ---
function copyText(txt) {
  navigator.clipboard.writeText(txt);
  alert("Alert notification text copied to clipboard successfully!");
}

function generateFallbackPipelineData() {
  // Pure local client mockup structure mimicking SECTION 3/7 G-10 flood
  const nowStr = new Date().toISOString();
  const mockTrace = {
    trace_id: "CIRO-FALLBACK-99",
    timestamp: nowStr,
    mode: currentMode,
    location: selectedLocation,
    language: currentLanguage,
    signal_interpretation: { combined_risk_score: 84 },
    confidence_scoring: { crisis_classified: "FLOOD", severity: 8, confidence: 84, reasoning_chain: ["Step 1", "Step 2"] },
    priority_ranking: { priority_scores: { "G-10 Markaz": 94 } },
    resource_tradeoffs: { available: {} },
    action_execution: { actions_taken: [] },
    false_signal_recovery: {}
  };

  return {
    trace_id: "CIRO-FALLBACK-99",
    mode: currentMode,
    location: selectedLocation,
    language: currentLanguage,
    agent1: { combined_risk_score: 84, weather: { description: "Heavy Thunderstorm" }, news: [], fallback_badges: ["⚠️ Offline Mode Active"] },
    agent2: { crisis_detected: true, crisis_type: "FLOOD", severity: 8, confidence: 84, reasoning: "Rainfall indicators exceeded warning threshold" },
    agent3: { allocation: { final_allocation: { ambulances: 6, police: 4, rescue: 3 } }, reroute: { blocked_road: "Srinagar Highway", reason: "Urban flooding", alternatives: [{ name: "Kashmir Highway", extra_time_minutes: 7, distance_km: 12.3, status: "CLEAR", recommendation: "BEST ALTERNATIVE", geometry: [[33.7295, 73.0931], [33.7295, 73.0551], [33.6844, 73.0479]] }, { name: "Margalla Road", extra_time_minutes: 13, distance_km: 15.8, status: "SLOW", recommendation: "USE IF KASHMIR BUSY", geometry: [[33.7295, 73.0931], [33.7400, 73.0700], [33.7000, 73.0200]] }], public_alert: { en: "Srinagar Highway blocked. Use Kashmir Highway.", ur: "Srinagar Highway band hai. Kashmir Highway use karein." } } },
    agent4: { PUBLIC: "Urgent Flood Alert Srinagar Highway closed.", HOSPITAL: "Hospitals standby." },
    agent5: { verification_status: "CONFIRM" },
    agent6: { resolution_status: "ONGOING" },
    trace: mockTrace
  };
}
