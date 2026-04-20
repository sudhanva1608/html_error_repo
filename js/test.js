const API_BASE_URL = "http://localhost:8080";
const REPORT_STORAGE_KEY = "mindmetricReports";

const userId = localStorage.getItem("userId");

if (!userId) {
  alert("Please login first to take the test");
  window.location.href = "login.html";
} else {
  initAssessment();
}

let questions = [];
let currentQuestion = 0;
let score = 0;
let isTransitioning = false;

async function initAssessment() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/test/questions`);
    const data = await response.json();

    if (!response.ok) {
      const message = data && data.message ? data.message : "Failed to load questions.";
      throw new Error(message);
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No questions available");
    }

    questions = data;
    showQuestion();
  } catch (error) {
    console.error("Error loading questions:", error);
    const questionText = document.getElementById("questionText");
    if (questionText) {
      questionText.innerText = "Unable to load assessment questions right now.";
    }
  }
}

function showQuestion() {
  const card = document.querySelector(".question-card");
  if (!card || !questions[currentQuestion]) {
    return;
  }

  const question = questions[currentQuestion];
  const questionText = question.question_text || question.question || "Question unavailable";

  const questionEl = document.getElementById("questionText");
  if (questionEl) {
    questionEl.innerText = questionText;
  }

  const optionsHTML = `
<button class="option-btn" onclick="selectAnswer(event, 0)">Never</button>
<button class="option-btn" onclick="selectAnswer(event, 1)">Sometimes</button>
<button class="option-btn" onclick="selectAnswer(event, 2)">Often</button>
<button class="option-btn" onclick="selectAnswer(event, 3)">Always</button>
`;

  const optionsContainer = document.getElementById("optionsContainer");
  if (optionsContainer) {
    optionsContainer.innerHTML = optionsHTML;
  }

  card.classList.remove("slide-out-left");

  updateProgress();
}


function selectAnswer(evt, value) {
  if (isTransitioning) {
    return;
  }

  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach((btn) => {
    btn.classList.remove("selected");
    btn.disabled = true;
  });

  if (evt && evt.target) {
    evt.target.classList.add("selected");
  }

  score += value;

  if (currentQuestion >= questions.length - 1) {
    setTimeout(() => {
      showResult();
    }, 420);
    return;
  }

  const card = document.querySelector(".question-card");
  if (!card) {
    currentQuestion++;
    showQuestion();
    return;
  }

  isTransitioning = true;
  card.classList.add("slide-out-left");

  setTimeout(() => {
    currentQuestion++;
    card.classList.add("slide-in-right");
    showQuestion();

    requestAnimationFrame(() => {
      card.classList.remove("slide-in-right");
    });

    setTimeout(() => {
      isTransitioning = false;
    }, 320);
  }, 360);
}


function updateProgress() {
  if (!questions.length) {
    return;
  }

  const progress = document.getElementById("progress");
  if (!progress) {
    return;
  }

  const percent = ((currentQuestion + 1) / questions.length) * 100;
  progress.style.width = percent + "%";
  progress.setAttribute("aria-valuenow", String(Math.round(percent)));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getAssessmentHistory() {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveAssessmentReport(report) {
  const history = getAssessmentHistory();
  history.push(report);
  const trimmed = history.slice(-20);
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
}

function generateTrendPath(values, width, height, padding) {
  if (!values.length) {
    return "";
  }

  if (values.length === 1) {
    const y = height - padding - ((height - padding * 2) * values[0]) / 100;
    return `M ${padding} ${y} L ${width - padding} ${y}`;
  }

  const stepX = (width - padding * 2) / (values.length - 1);

  return values
    .map((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - ((height - padding * 2) * value) / 100;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function generatePointDots(values, width, height, padding) {
  if (!values.length) {
    return "";
  }

  if (values.length === 1) {
    const y = height - padding - ((height - padding * 2) * values[0]) / 100;
    return `<circle cx="${width / 2}" cy="${y}" r="4"></circle>`;
  }

  const stepX = (width - padding * 2) / (values.length - 1);

  return values
    .map((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - ((height - padding * 2) * value) / 100;
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4"></circle>`;
    })
    .join("");
}

function computeMetrics(percentage) {
  return [
    {
      key: "emotional",
      label: "Emotional Strain",
      value: clamp(Math.round(percentage * 0.92 + (score % 7)), 0, 100)
    },
    {
      key: "cognitive",
      label: "Cognitive Load",
      value: clamp(Math.round(percentage * 0.88 + (questions.length % 5) * 2), 0, 100)
    },
    {
      key: "sleep",
      label: "Sleep Stress",
      value: clamp(Math.round(percentage * 0.8 + 12), 0, 100)
    },
    {
      key: "social",
      label: "Social Pressure",
      value: clamp(Math.round(percentage * 0.74 + 16), 0, 100)
    }
  ];
}

function showResult() {
  const maxScore = questions.length * 3;
  const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;

  let mentalState = "";

  if (percentage <= 25) {
    mentalState = "Healthy";
  } else if (percentage <= 50) {
    mentalState = "Moderate Stress";
  } else if (percentage <= 75) {
    mentalState = "High Stress";
  } else {
    mentalState = "Critical";
  }

  const metrics = computeMetrics(percentage);

  const report = {
    id: Date.now(),
    date: new Date().toISOString(),
    score,
    maxScore,
    percentage,
    state: mentalState,
    metrics
  };

  const history = saveAssessmentReport(report);
  const recent = history.slice(-8);
  const trendValues = recent.map((entry) => entry.percentage);
  const trendPath = generateTrendPath(trendValues, 520, 170, 18);
  const pointDots = generatePointDots(trendValues, 520, 170, 18);

  const wrapper = document.querySelector(".test-wrapper");
  if (!wrapper) {
    return;
  }

  wrapper.innerHTML = `
<div class="result-container report-view">
  <h2>Your Mental Health Report</h2>
  <div class="result-summary-grid">
    <div class="result-primary">
      <div class="score-circle">
        <svg width="180" height="180">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#3ee9ff"/>
              <stop offset="100%" stop-color="#a77dff"/>
            </linearGradient>
          </defs>
          <circle cx="90" cy="90" r="70" class="circle-bg"></circle>
          <circle cx="90" cy="90" r="70" class="circle-progress" stroke-dasharray="440" stroke-dashoffset="440" id="progressCircle"></circle>
        </svg>
        <div class="score-text" id="scoreText">0%</div>
      </div>
      <h3>${mentalState}</h3>
      <p class="report-note">Based on ${questions.length} responses. Recheck weekly to monitor trend direction.</p>
      <button onclick="window.location.href='index.html'" class="home-btn">Return Home</button>
    </div>

    <div class="result-metrics">
      <h4>Stress Profile</h4>
      <div class="stress-bars">
        ${metrics
          .map(
            (metric) => `
          <div class="stress-row">
            <div class="stress-row-head">
              <span>${metric.label}</span>
              <strong>${metric.value}%</strong>
            </div>
            <div class="stress-track"><div class="stress-fill" style="width:${metric.value}%"></div></div>
          </div>`
          )
          .join("")}
      </div>
    </div>
  </div>

  <div class="trend-card">
    <div class="trend-head">
      <h4>Stress Trend</h4>
      <span>Last ${recent.length} assessment${recent.length > 1 ? "s" : ""}</span>
    </div>
    <svg class="trend-svg" viewBox="0 0 520 170" preserveAspectRatio="none" aria-label="Stress trend graph">
      <line x1="18" y1="20" x2="18" y2="152"></line>
      <line x1="18" y1="152" x2="502" y2="152"></line>
      <path d="${trendPath}" class="trend-path"></path>
      <g class="trend-dots">${pointDots}</g>
    </svg>
    <div class="trend-scale">
      <span>Low</span>
      <span>Moderate</span>
      <span>High</span>
      <span>Critical</span>
    </div>
  </div>
</div>
`;

  animateScore(percentage);
}

function animateScore(target) {
  const circle = document.getElementById("progressCircle");
  const text = document.getElementById("scoreText");

  if (!circle || !text) {
    return;
  }

  const safeTarget = Math.max(0, Math.min(100, target));
  let current = 0;

  const interval = setInterval(() => {
    current += 1;

    const offset = 440 - (440 * current) / 100;
    circle.style.strokeDashoffset = offset;
    text.innerText = current + "%";

    if (current >= safeTarget) {
      clearInterval(interval);
    }
  }, 20);
}





