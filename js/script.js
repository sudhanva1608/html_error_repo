const API_BASE_URL = "http://localhost:5000";
const REPORT_STORAGE_KEY = "mindmetricReports";

async function parseJsonResponse(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload && payload.message ? payload.message : "Request failed.";
    throw new Error(message);
  }

  return payload || {};
}

async function registerUser() {
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  if (!firstNameInput || !lastNameInput || !emailInput || !passwordInput) {
    return;
  }

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!firstName || !lastName || !email || !password) {
    alert("Please fill in all fields.");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password
      })
    });

    const data = await parseJsonResponse(response);
    alert(data.message || "Registration completed.");
    window.location.href = "login.html";
  } catch (error) {
    console.error("Registration error:", error);
    alert(error.message || "Registration failed. Please try again.");
  }
}

async function loginUser() {
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");

  if (!emailInput || !passwordInput) {
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await parseJsonResponse(response);
    const userId = data.userId || (data.user && (data.user.id || data.user._id));

    if (userId) {
      localStorage.setItem("userId", String(userId));
    }

    alert(data.message || "Login successful.");
    window.location.href = "index.html";
  } catch (error) {
    console.error("Login error:", error);
    alert(error.message || "Login failed. Please try again.");
  }
}

function startAssessment() {
  const userId = localStorage.getItem("userId");

  if (!userId) {
    const bar = document.getElementById("notifyBar");

    if (bar) {
      bar.classList.add("show");
      setTimeout(() => {
        bar.classList.remove("show");
        window.location.href = "login.html";
      }, 2000);
    } else {
      alert("Please login first");
      window.location.href = "login.html";
    }

    return;
  }

  window.location.href = "test.html";
}

function toggleMenu() {
  const menu = document.getElementById("dropdown");

  if (!menu) {
    return;
  }

  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function logout() {
  localStorage.removeItem("userId");
  window.location.href = "login.html";
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

function formatReportDate(isoDate) {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_error) {
    return "-";
  }
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

function renderHomeReport() {
  const stateEl = document.getElementById("homeState");
  const scoreEl = document.getElementById("homeScore");
  const takenEl = document.getElementById("homeTaken");
  const barsEl = document.getElementById("homeStressBars");
  const trendPathEl = document.getElementById("homeTrendPath");
  const trendWrapEl = document.getElementById("homeTrendWrap");
  const emptyEl = document.getElementById("homeReportEmpty");

  if (!stateEl || !scoreEl || !takenEl || !barsEl || !trendPathEl || !trendWrapEl || !emptyEl) {
    return;
  }

  const history = getAssessmentHistory();

  if (!history.length) {
    emptyEl.style.display = "block";
    trendWrapEl.style.display = "none";
    barsEl.innerHTML = "";
    stateEl.textContent = "No report yet";
    scoreEl.textContent = "--";
    takenEl.textContent = "Complete your first assessment to unlock charts.";
    return;
  }

  const latest = history[history.length - 1];
  const metrics = Array.isArray(latest.metrics) ? latest.metrics : [];
  const recent = history.slice(-8);
  const trendValues = recent.map((entry) => entry.percentage);

  stateEl.textContent = latest.state;
  scoreEl.textContent = `${latest.percentage}%`;
  takenEl.textContent = `Last updated: ${formatReportDate(latest.date)}`;

  barsEl.innerHTML = metrics
    .map(
      (metric) => `
      <div class="home-bar-row">
        <div class="home-bar-head"><span>${metric.label}</span><strong>${metric.value}%</strong></div>
        <div class="home-bar-track"><div class="home-bar-fill" style="width:${metric.value}%"></div></div>
      </div>`
    )
    .join("");

  trendPathEl.setAttribute("d", generateTrendPath(trendValues, 460, 150, 16));

  emptyEl.style.display = "none";
  trendWrapEl.style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
  const userId = localStorage.getItem("userId");
  const loginBtn = document.getElementById("loginBtn");
  const profileIcon = document.getElementById("profileIcon");
  const dropdown = document.getElementById("dropdown");
  const navbar = document.querySelector(".navbar");
  const button = document.querySelector(".cta-button");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      loginUser();
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      registerUser();
    });
  }

  if (userId) {
    if (loginBtn) {
      loginBtn.style.display = "none";
    }
    if (profileIcon) {
      profileIcon.style.display = "block";
    }
  } else {
    if (loginBtn) {
      loginBtn.style.display = "inline-block";
    }
    if (profileIcon) {
      profileIcon.style.display = "none";
    }
    if (dropdown) {
      dropdown.style.display = "none";
    }
  }

  renderHomeReport();

  if (button) {
    button.addEventListener("mousemove", (e) => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      button.style.transform = `translate(${x * 0.16}px,${y * 0.16}px)`;
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "translate(0,0)";
    });
  }

  if (profileIcon && dropdown) {
    document.addEventListener("click", (event) => {
      if (!profileIcon.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.style.display = "none";
      }
    });
  }

  const revealTargets = document.querySelectorAll(
    ".reveal, .mini-stat, .flow-card, .number-card, .panel-block, .quote-card, .faq-list details, .bottom-cta .section-shell, .home-report-shell"
  );

  revealTargets.forEach((el, index) => {
    el.classList.add("scroll-in");
    el.style.setProperty("--stagger", `${(index % 6) * 70}ms`);
  });

  if ("IntersectionObserver" in window && revealTargets.length) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" }
    );

    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  const sectionIds = ["dashboard", "about", "how", "insights", "faq"];
  const navLinks = Array.from(document.querySelectorAll(".nav-links a[href^='#']"));
  const sectionLookup = new Map(
    sectionIds
      .map((id) => {
        const section = document.getElementById(id);
        return section ? [id, section] : null;
      })
      .filter(Boolean)
  );

  if ("IntersectionObserver" in window && sectionLookup.size) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const id = entry.target.id;
          navLinks.forEach((link) => {
            const active = link.getAttribute("href") === `#${id}`;
            link.classList.toggle("active", active);
          });
        });
      },
      { threshold: 0.42 }
    );

    sectionLookup.forEach((section) => sectionObserver.observe(section));
  }

  let ticking = false;

  const handleScrollFrame = () => {
    const y = window.scrollY || window.pageYOffset;

    if (navbar) {
      navbar.classList.toggle("scrolled", y > 44);
    }

    const hero = document.querySelector(".hero");
    if (hero && y < window.innerHeight * 1.2) {
      hero.style.setProperty("--hero-shift", `${Math.min(y * 0.08, 42)}px`);
    }

    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(handleScrollFrame);
        ticking = true;
      }
    },
    { passive: true }
  );

  handleScrollFrame();
});
