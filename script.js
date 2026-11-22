const STORAGE_KEY = "quizmate_data_v2";
const API_URL = "http://localhost:3000/api";

const defaultQuizzes = [
  {
    id: 1,
    title: "C Programming Basics",
    subject: "Programming",
    description: "Test your understanding of basic C programming concepts.",
    duration: 5,
    questions: [
      { q: "Which symbol is used to end a statement in C?", options: [":", ";", ".", ","], answer: 1 },
      { q: "Which function is the starting point of a C program?", options: ["start()", "main()", "run()", "printf()"], answer: 1 },
      { q: "Which header file is used for printf()?", options: ["math.h", "string.h", "stdio.h", "conio.h"], answer: 2 },
      { q: "Which data type stores a whole number?", options: ["int", "float", "char", "double"], answer: 0 },
      { q: "Which operator is used for equality comparison?", options: ["=", "==", "!=", ">"], answer: 1 }
    ]
  },
  {
    id: 2,
    title: "Introduction to AI",
    subject: "Artificial Intelligence",
    description: "Explore the fundamentals of Artificial Intelligence.",
    duration: 5,
    questions: [
      { q: "What does AI stand for?", options: ["Automatic Internet", "Artificial Intelligence", "Advanced Input", "Applied Information"], answer: 1 },
      { q: "Which is a subset of AI?", options: ["Machine Learning", "Typing", "Networking", "Hardware"], answer: 0 },
      { q: "Which language is widely used in AI?", options: ["HTML", "CSS", "Python", "SQL only"], answer: 2 },
      { q: "What is an algorithm?", options: ["A step-by-step procedure", "A monitor", "A database", "An operating system"], answer: 0 },
      { q: "Which field helps computers learn from data?", options: ["Machine Learning", "Web Design", "Computer Repair", "Networking"], answer: 0 }
    ]
  },
  {
    id: 3,
    title: "Data Structures",
    subject: "Computer Science",
    description: "Check your knowledge of arrays, stacks and linked lists.",
    duration: 5,
    questions: [
      { q: "Which data structure follows LIFO?", options: ["Queue", "Stack", "Array", "Tree"], answer: 1 },
      { q: "Which data structure follows FIFO?", options: ["Stack", "Queue", "Graph", "Heap"], answer: 1 },
      { q: "Array elements are generally stored in:", options: ["Random locations", "Contiguous memory", "Only registers", "Files"], answer: 1 },
      { q: "A linked list consists of:", options: ["Nodes", "Only indexes", "Only arrays", "Tables"], answer: 0 },
      { q: "Which is the first node of a linked list called?", options: ["Tail", "Root", "Head", "Top"], answer: 2 }
    ]
  },
  {
    id: 4,
    title: "Basic Mathematics",
    subject: "Mathematics",
    description: "Practice fundamental mathematical concepts.",
    duration: 4,
    questions: [
      { q: "What is 12 × 8?", options: ["84", "96", "108", "88"], answer: 1 },
      { q: "What is the square of 9?", options: ["18", "72", "81", "99"], answer: 2 },
      { q: "What is the value of 2³?", options: ["6", "8", "9", "12"], answer: 1 },
      { q: "What is 25% of 200?", options: ["25", "40", "50", "75"], answer: 2 }
    ]
  },
  {
    id: 5,
    title: "General Knowledge",
    subject: "General Knowledge",
    description: "A quick quiz to test your general awareness.",
    duration: 4,
    questions: [
      { q: "What is the capital of India?", options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], answer: 1 },
      { q: "Which is the national animal of India?", options: ["Lion", "Elephant", "Tiger", "Peacock"], answer: 2 },
      { q: "How many colours are there in the Indian national flag?", options: ["Two", "Three", "Four", "Five"], answer: 1 },
      { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1 }
    ]
  }
];

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (saved && Array.isArray(saved.quizzes)) {
      if (!Array.isArray(saved.results)) saved.results = [];
      return saved;
    }
  } catch (error) {
    console.warn("Could not load saved data:", error);
  }

  return {
    quizzes: defaultQuizzes,
    results: []
  };
}

let db = loadData();
let currentUser = JSON.parse(
  sessionStorage.getItem("quizmate_user") || "null"
);

let activeQuiz = null;
let currentQuestion = 0;
let selectedAnswers = [];
let timerInterval = null;
let timeLeft = 0;
let quizStartedAt = 0;

let studentServerResults = [];
let studentResultsLoaded = false;
let dashboardStats = null;
let teacherAttempts = [];

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 2600);
}

function openLogin() {
  document.getElementById("loginModal").classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function showHome() {
  document.getElementById("dashboard").classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Registration and Login
document.getElementById("loginForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const action = event.submitter?.value || "login";

  const name = document.getElementById("loginName").value.trim();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const role = document.getElementById("loginRole").value;

  if (!email || !password) {
    return showToast("Please enter email and password.");
  }

  if (action === "register" && !name) {
    return showToast("Please enter your name.");
  }

  try {
    const response = await fetch(`${API_URL}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "register"
          ? { name, email, password, role }
          : { email, password }
      )
    });

    const data = await response.json();

    if (!response.ok) {
      return showToast(data.message || "Request failed.");
    }

    if (action === "register") {
      showToast("Account created successfully! Now login.");
      document.getElementById("loginPassword").value = "";
      return;
    }

    currentUser = data.user;
    sessionStorage.setItem("quizmate_user", JSON.stringify(currentUser));

    studentServerResults = [];
    studentResultsLoaded = false;
    dashboardStats = null;
    teacherAttempts = [];

    closeModal("loginModal");
    updateNavigation();

    await loadServerQuizzes();
    await showDashboard();

    showToast(`Welcome, ${currentUser.name}!`);

  } catch (error) {
    console.error("Authentication error:", error);
    showToast("Server connection failed. Please check backend.");
  }
});

function googleDemo() {
  showToast("Google sign-in requires Firebase setup. Use email login for now.");
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem("quizmate_user");

  studentServerResults = [];
  studentResultsLoaded = false;
  dashboardStats = null;
  teacherAttempts = [];

  updateNavigation();
  document.getElementById("dashboard").classList.add("hidden");

  showToast("You have logged out.");
}

function updateNavigation() {
  const label = document.getElementById("userLabel");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (currentUser) {
    label.textContent = `${currentUser.name} (${currentUser.role})`;
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    label.textContent = "";
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }
}

// Load quizzes from MySQL
async function loadServerQuizzes() {
  try {
    const response = await fetch(`${API_URL}/quizzes`);

    if (!response.ok) {
      throw new Error("Could not fetch quizzes.");
    }

    const serverQuizzes = await response.json();

    const formattedQuizzes = serverQuizzes.map(quiz => {
      let questions = quiz.questions;

      if (typeof questions === "string") {
        questions = JSON.parse(questions);
      }

      return {
        ...quiz,
        id: Number(quiz.id),
        duration: Number(quiz.duration),
        created_by: Number(quiz.created_by),
        questions
      };
    });

    db.quizzes = [
      ...defaultQuizzes,
      ...formattedQuizzes
    ];

    saveData();
    renderQuizzes();
    await renderLeaderboard();

  } catch (error) {
    console.error("Quiz loading error:", error);
    showToast("Could not load quizzes from server.");
  }
}

// Load Student Result History from MySQL
async function loadStudentResults() {
  if (!currentUser || currentUser.role !== "Student") {
    return [];
  }

  try {
    const response = await fetch(
      `${API_URL}/results/${encodeURIComponent(currentUser.id)}`
    );

    if (!response.ok) {
      throw new Error("Could not load result history.");
    }

    const rows = await response.json();

    studentServerResults = rows.map(row => ({
      id: row.id,
      name: currentUser.name,
      quizId: Number(row.quiz_id),
      quizTitle: row.quiz_title || "Quiz",
      subject: row.subject || "General",
      correct: Number(row.correct_answers),
      total: Number(row.total_questions),
      percentage: Number(row.score),
      date: row.attempted_at
        ? new Date(row.attempted_at).toLocaleString("en-IN")
        : "Date unavailable"
    }));

    studentResultsLoaded = true;
    return studentServerResults;

  } catch (error) {
    console.error("Student result history error:", error);
    studentResultsLoaded = false;

    return db.results.filter(
      result => result.name === currentUser.name
    );
  }
}

// Load Dashboard Statistics from MySQL
async function loadDashboardStats() {
  if (!currentUser) return null;

  try {
    const response = await fetch(
      `${API_URL}/dashboard/${encodeURIComponent(currentUser.id)}`
    );

    if (!response.ok) {
      throw new Error("Dashboard statistics could not be loaded.");
    }

    dashboardStats = await response.json();
    return dashboardStats;

  } catch (error) {
    console.error("Dashboard stats error:", error);
    dashboardStats = null;
    return null;
  }
}

// Load Teacher Attempts from MySQL
async function loadTeacherAttempts() {
  if (!currentUser || currentUser.role !== "Teacher") {
    return [];
  }

  try {
    const response = await fetch(
      `${API_URL}/teacher-attempts/${encodeURIComponent(currentUser.id)}`
    );

    if (!response.ok) {
      throw new Error("Teacher attempts could not be loaded.");
    }

    teacherAttempts = await response.json();
    return teacherAttempts;

  } catch (error) {
    console.error("Teacher attempts error:", error);
    teacherAttempts = [];
    return [];
  }
}

// Quiz Listing
function renderQuizzes() {
  const subject = document.getElementById("subjectFilter").value;

  const list = db.quizzes.filter(
    quiz => subject === "All" || quiz.subject === subject
  );

  document.getElementById("quizCount").textContent = db.quizzes.length;

  document.getElementById("quizTotal").textContent =
    `${list.length} quiz${list.length === 1 ? "" : "zes"} found`;

  const grid = document.getElementById("quizGrid");

  if (!list.length) {
    grid.innerHTML = `
      <p class="empty-state">No quizzes found in this subject.</p>
    `;
    return;
  }

  grid.innerHTML = list.map(quiz => `
    <article class="quiz-card">
      <div class="quiz-card-top">
        <span class="subject-tag">${escapeHTML(quiz.subject)}</span>
        <span>📚</span>
      </div>

      <h3>${escapeHTML(quiz.title)}</h3>
      <p>${escapeHTML(quiz.description || "")}</p>

      <div class="quiz-meta">
        <span>❓ ${quiz.questions.length} Questions</span>
        <span>⏱ ${quiz.duration} min</span>
      </div>

      <button class="btn btn-primary" onclick="startQuiz(${quiz.id})">
        Start Quiz →
      </button>
    </article>
  `).join("");
}

// Start Quiz
function startQuiz(id) {
  if (!currentUser) {
    showToast("Please login before starting a quiz.");
    openLogin();
    return;
  }

  if (currentUser.role !== "Student") {
    showToast("Please login as a Student to attempt quizzes.");
    return;
  }

  activeQuiz = db.quizzes.find(
    quiz => Number(quiz.id) === Number(id)
  );

  if (!activeQuiz || !activeQuiz.questions.length) {
    return showToast("This quiz has no questions.");
  }

  currentQuestion = 0;
  selectedAnswers = new Array(activeQuiz.questions.length).fill(null);

  timeLeft = Math.max(1, Number(activeQuiz.duration) || 1) * 60;
  quizStartedAt = Date.now();

  document.getElementById("activeQuizTitle").textContent = activeQuiz.title;
  document.getElementById("quizSubjectLabel").textContent = activeQuiz.subject;
  document.getElementById("quizModal").classList.remove("hidden");

  renderQuestion();
  updateTimer();

  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      showToast("Time is up! Your quiz is being submitted.");
      submitQuiz();
    }
  }, 1000);
}

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  document.getElementById("quizTimer").textContent =
    `⏱ ${minutes}:${seconds}`;
}

function renderQuestion() {
  const question = activeQuiz.questions[currentQuestion];
  const total = activeQuiz.questions.length;

  document.getElementById("questionProgress").style.width =
    `${((currentQuestion + 1) / total) * 100}%`;

  document.getElementById("questionArea").innerHTML = `
    <p class="muted">Question ${currentQuestion + 1} of ${total}</p>
    <h3 class="question-text">${escapeHTML(question.q)}</h3>

    <div>
      ${question.options.map((option, index) => `
        <label class="option-label">
          <input
            type="radio"
            name="answer"
            value="${index}"
            ${selectedAnswers[currentQuestion] === index ? "checked" : ""}
          >
          <span>${escapeHTML(option)}</span>
        </label>
      `).join("")}
    </div>
  `;

  document.querySelectorAll('input[name="answer"]').forEach(input => {
    input.addEventListener("change", () => {
      selectedAnswers[currentQuestion] = Number(input.value);
    });
  });

  document.getElementById("prevQuestion").disabled = currentQuestion === 0;
  document.getElementById("prevQuestion").style.opacity =
    currentQuestion === 0 ? ".45" : "1";

  document.getElementById("nextQuestion").classList.toggle(
    "hidden",
    currentQuestion === total - 1
  );

  document.getElementById("submitQuiz").classList.toggle(
    "hidden",
    currentQuestion !== total - 1
  );
}

function changeQuestion(direction) {
  const next = currentQuestion + direction;

  if (next < 0 || next >= activeQuiz.questions.length) return;

  currentQuestion = next;
  renderQuestion();
}

function closeQuiz() {
  if (timerInterval) clearInterval(timerInterval);

  document.getElementById("quizModal").classList.add("hidden");
  activeQuiz = null;
}

// Submit Quiz
async function submitQuiz() {
  if (!activeQuiz) return;

  clearInterval(timerInterval);

  const total = activeQuiz.questions.length;
  let correct = 0;

  activeQuiz.questions.forEach((question, index) => {
    if (selectedAnswers[index] === question.answer) {
      correct++;
    }
  });

  const percentage = Math.round((correct / total) * 100);

  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - quizStartedAt) / 1000)
  );

  const quizBeingSubmitted = activeQuiz;

  const result = {
    id: Date.now(),
    name: currentUser.name,
    quizId: quizBeingSubmitted.id,
    quizTitle: quizBeingSubmitted.title,
    subject: quizBeingSubmitted.subject,
    correct,
    total,
    percentage,
    date: new Date().toLocaleString(),
    durationSeconds
  };

  db.results.push(result);
  saveData();

  try {
    const response = await fetch(`${API_URL}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: currentUser.id,
        quiz_id: quizBeingSubmitted.id,
        score: percentage,
        total_questions: total,
        correct_answers: correct
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Result could not be saved.");
    }

    await loadStudentResults();
    await renderLeaderboard();

    showToast("Result saved to MySQL successfully!");

  } catch (error) {
    console.error("MySQL Result Save Error:", error);
    showToast("Result saved locally, but server saving failed.");
  }

  document.getElementById("quizModal").classList.add("hidden");

  document.getElementById("resultScore").textContent =
    `${percentage}%`;

  document.getElementById("resultMessage").textContent =
    percentage >= 80
      ? "Excellent work! Keep it up."
      : percentage >= 50
        ? "Good effort! Keep practising."
        : "Keep learning. Every attempt helps you improve.";

  document.getElementById("resultDetails").innerHTML = `
    <div>
      <strong>${correct}/${total}</strong><br>
      <span>Correct</span>
    </div>

    <div>
      <strong>${total - correct}</strong><br>
      <span>Incorrect / Skipped</span>
    </div>

    <div>
      <strong>${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s</strong><br>
      <span>Time Taken</span>
    </div>
  `;

  document.getElementById("resultModal").classList.remove("hidden");
  activeQuiz = null;

  renderQuizzes();
}

// Dashboard
async function showDashboard() {
  if (!currentUser) {
    openLogin();
    return;
  }

  const dashboard = document.getElementById("dashboard");
  dashboard.classList.remove("hidden");

  document.getElementById("dashboardTitle").textContent =
    `${currentUser.role} Dashboard`;

  document.getElementById("dashboardSubtitle").textContent =
    `Welcome back, ${currentUser.name}. Here's your overview.`;

  document.getElementById("rolePill").textContent = currentUser.role;

  document.getElementById("dashboardStats").innerHTML =
    `<p class="empty-state">Loading dashboard data...</p>`;

  document.getElementById("dashboardContent").innerHTML =
    `<p class="empty-state">Please wait...</p>`;

  await loadDashboardStats();

  if (currentUser.role === "Student") {
    await loadStudentResults();
    renderStudentDashboard();

  } else if (currentUser.role === "Teacher") {
    await loadTeacherAttempts();
    await renderTeacherDashboard();

  } else if (currentUser.role === "Admin") {
    await renderAdminDashboard();
  }

  dashboard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function makeStat(label, value) {
  return `
    <div class="stat-card">
      <small>${escapeHTML(label)}</small>
      <strong>${escapeHTML(value)}</strong>
    </div>
  `;
}

// Student Dashboard
function renderStudentDashboard() {
  const mine = studentResultsLoaded
    ? studentServerResults
    : db.results.filter(result => result.name === currentUser.name);

  const average = mine.length
    ? Math.round(
        mine.reduce((sum, result) => sum + Number(result.percentage || 0), 0)
        / mine.length
      )
    : 0;

  const availableQuizzes =
    dashboardStats?.total_quizzes ?? db.quizzes.length;

  document.getElementById("dashboardStats").innerHTML =
    makeStat("Quizzes Attempted", mine.length) +
    makeStat("Average Score", `${average}%`) +
    makeStat("Available Quizzes", availableQuizzes);

  document.getElementById("dashboardContent").innerHTML = `
    <h3>📈 My Result History</h3>

    ${mine.length ? mine.map(result => `
      <div class="dashboard-row">
        <div>
          <strong>${escapeHTML(result.quizTitle)}</strong>
          <small>
            ${escapeHTML(result.subject)}
            ·
            ${escapeHTML(result.date)}
          </small>
          <small>
            ${Number(result.correct || 0)}/${Number(result.total || 0)} Correct Answers
          </small>
        </div>

        <strong>${Number(result.percentage || 0)}%</strong>
      </div>
    `).join("") : `
      <p class="empty-state">
        You haven't attempted any quizzes yet. Choose a quiz above to get started!
      </p>
    `}

    ${!studentResultsLoaded ? `
      <p class="muted" style="margin-top:12px">
        Showing locally saved results because server history could not be loaded.
      </p>
    ` : ""}
  `;
}

// Teacher Dashboard
async function renderTeacherDashboard() {
  const stats = dashboardStats || {};

  const myQuizzes = db.quizzes.filter(
    quiz => Number(quiz.created_by) === Number(currentUser.id)
  );

  document.getElementById("dashboardStats").innerHTML =
    makeStat("My Quizzes", stats.total_quizzes ?? myQuizzes.length) +
    makeStat("Student Attempts", stats.total_attempts ?? 0) +
    makeStat("Available Quizzes", db.quizzes.length);

  document.getElementById("dashboardContent").innerHTML = `
    <h3>🧑‍🏫 Manage My Quizzes</h3>

    <button class="btn btn-primary create-btn" onclick="createQuiz()">
      + Create New Quiz
    </button>

    ${myQuizzes.length ? myQuizzes.map(quiz => `
      <div class="dashboard-row">
        <div>
          <strong>${escapeHTML(quiz.title)}</strong>
          <small>
            ${escapeHTML(quiz.subject)}
            ·
            ${quiz.questions.length} questions
          </small>
        </div>

        <div class="quiz-actions">
          <button class="small-btn" onclick="editQuiz(${quiz.id})">
            Edit
          </button>

          <button class="small-btn danger" onclick="deleteQuiz(${quiz.id})">
            Delete
          </button>
        </div>
      </div>
    `).join("") : `
      <p class="empty-state">You have not created any quizzes yet.</p>
    `}

    <h3 style="margin-top:25px">Recent Student Attempts</h3>

    ${teacherAttempts.length ? teacherAttempts.map(attempt => `
      <div class="dashboard-row">
        <div>
          <strong>${escapeHTML(attempt.student_name)}</strong>
          <small>
            ${escapeHTML(attempt.quiz_title)}
            ·
            ${attempt.attempted_at
              ? new Date(attempt.attempted_at).toLocaleString("en-IN")
              : ""}
          </small>
        </div>
        <strong>${Number(attempt.score)}%</strong>
      </div>
    `).join("") : `
      <p class="empty-state">No attempts on your quizzes yet.</p>
    `}
  `;
}

// Admin Dashboard
async function renderAdminDashboard() {
  const stats = dashboardStats || {};

  const databaseQuizzes = db.quizzes.filter(
    quiz => quiz.created_by !== undefined && quiz.created_by !== null
  );

  document.getElementById("dashboardStats").innerHTML =
    makeStat("Total Students", stats.total_students ?? 0) +
    makeStat("Total Teachers", stats.total_teachers ?? 0) +
    makeStat("Total Quizzes", stats.total_quizzes ?? db.quizzes.length) +
    makeStat("Total Attempts", stats.total_attempts ?? 0);

  document.getElementById("dashboardContent").innerHTML = `
    <h3>⚙️ Admin Control Panel</h3>

    <p class="muted">
      Manage platform quizzes and review activity stored in MySQL.
    </p>

    <div class="dashboard-row">
      <div>
        <strong>Quiz Management</strong>
        <small>Create or remove quizzes from the platform.</small>
      </div>

      <button class="small-btn" onclick="createQuiz()">
        Create Quiz
      </button>
    </div>

    <div class="dashboard-row">
      <div>
        <strong>Clear All Results</strong>
        <small>Delete all quiz attempts stored in the database.</small>
      </div>

      <button class="small-btn danger" onclick="clearResults()">
        Clear Results
      </button>
    </div>

    <h3 style="margin-top:25px">All Platform Quizzes</h3>

    ${databaseQuizzes.length ? databaseQuizzes.map(quiz => `
      <div class="dashboard-row">
        <div>
          <strong>${escapeHTML(quiz.title)}</strong>
          <small>${escapeHTML(quiz.subject)}</small>
        </div>

        <div class="quiz-actions">
          <button class="small-btn" onclick="editQuiz(${quiz.id})">
            Edit
          </button>

          <button class="small-btn danger" onclick="deleteQuiz(${quiz.id})">
            Delete
          </button>
        </div>
      </div>
    `).join("") : `
      <p class="empty-state">No database quizzes available yet.</p>
    `}
  `;
}

// Create Quiz and Save to MySQL
async function createQuiz() {
  if (!currentUser || !["Teacher", "Admin"].includes(currentUser.role)) {
    return showToast("Only teachers and admins can create quizzes.");
  }

  const title = prompt("Enter quiz title:");
  if (!title || !title.trim()) return;

  const subjectText = prompt(
    "Enter subject:",
    "Programming"
  );

  if (!subjectText || !subjectText.trim()) return;

  const durationText = prompt("Enter duration in minutes:", "5");
  const duration = Number(durationText);

  if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
    return showToast("Enter a valid duration (1–180 minutes).");
  }

  const questionCount = Number(
    prompt("How many questions? (1 to 10)", "3")
  );

  if (
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    questionCount > 10
  ) {
    return showToast("Please enter between 1 and 10 questions.");
  }

  const questions = [];

  for (let i = 0; i < questionCount; i++) {
    const q = prompt(`Question ${i + 1}:`);

    if (!q || !q.trim()) {
      return showToast("Question cannot be empty.");
    }

    const options = [];

    for (let j = 0; j < 4; j++) {
      const option = prompt(
        `Question ${i + 1} — Option ${j + 1}:`
      );

      if (!option || !option.trim()) {
        return showToast("Option cannot be empty.");
      }

      options.push(option.trim());
    }

    const correct = Number(
      prompt("Correct option number? Enter 1, 2, 3 or 4:", "1")
    );

    if (
      !Number.isInteger(correct) ||
      correct < 1 ||
      correct > 4
    ) {
      return showToast("Invalid correct option.");
    }

    questions.push({
      q: q.trim(),
      options,
      answer: correct - 1
    });
  }

  try {
    const response = await fetch(`${API_URL}/quizzes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        subject: subjectText.trim(),
        description: "Created by " + currentUser.name,
        duration,
        questions,
        created_by: currentUser.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return showToast(data.message || "Quiz creation failed.");
    }

    await loadServerQuizzes();
    await showDashboard();

    showToast("Quiz saved to MySQL successfully!");

  } catch (error) {
    console.error("Quiz creation error:", error);
    showToast("Server connection failed.");
  }
}

// Edit Quiz and Update MySQL
async function editQuiz(id) {
  if (!currentUser || !["Teacher", "Admin"].includes(currentUser.role)) {
    return showToast("Only teachers and admins can edit quizzes.");
  }

  const quiz = db.quizzes.find(
    item => Number(item.id) === Number(id)
  );

  if (!quiz) {
    return showToast("Quiz not found.");
  }

  // Sample quizzes are not stored in MySQL
  if (quiz.created_by === undefined || quiz.created_by === null) {
    return showToast("Sample quizzes cannot be edited.");
  }

  // Teacher can edit only their own quizzes
  if (
    currentUser.role === "Teacher" &&
    Number(quiz.created_by) !== Number(currentUser.id)
  ) {
    return showToast("You can only edit your own quizzes.");
  }

  const title = prompt("Edit quiz title:", quiz.title);
  if (title === null) return;

  if (!title.trim()) {
    return showToast("Quiz title cannot be empty.");
  }

  const subject = prompt("Edit subject:", quiz.subject);
  if (subject === null) return;

  if (!subject.trim()) {
    return showToast("Subject cannot be empty.");
  }

  const description = prompt(
    "Edit quiz description:",
    quiz.description || ""
  );
  if (description === null) return;

  const durationText = prompt(
    "Edit duration in minutes:",
    String(quiz.duration)
  );
  if (durationText === null) return;

  const duration = Number(durationText);

  if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
    return showToast("Enter a valid duration (1–180 minutes).");
  }

  const questionCountText = prompt(
    "How many questions should this quiz have? (1 to 10)",
    String(quiz.questions.length)
  );
  if (questionCountText === null) return;

  const questionCount = Number(questionCountText);

  if (
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    questionCount > 10
  ) {
    return showToast("Please enter between 1 and 10 questions.");
  }

  const questions = [];

  for (let i = 0; i < questionCount; i++) {
    const oldQuestion = quiz.questions[i];

    const questionText = prompt(
      `Question ${i + 1}:`,
      oldQuestion ? oldQuestion.q : ""
    );

    if (questionText === null) return;

    if (!questionText.trim()) {
      return showToast("Question cannot be empty.");
    }

    const options = [];

    for (let j = 0; j < 4; j++) {
      const oldOption = oldQuestion?.options?.[j] || "";

      const option = prompt(
        `Question ${i + 1} — Option ${j + 1}:`,
        oldOption
      );

      if (option === null) return;

      if (!option.trim()) {
        return showToast("Option cannot be empty.");
      }

      options.push(option.trim());
    }

    const oldAnswer = oldQuestion
      ? String(oldQuestion.answer + 1)
      : "1";

    const correctText = prompt(
      `Question ${i + 1}: Correct option number? Enter 1, 2, 3 or 4:`,
      oldAnswer
    );

    if (correctText === null) return;

    const correct = Number(correctText);

    if (
      !Number.isInteger(correct) ||
      correct < 1 ||
      correct > 4
    ) {
      return showToast("Invalid correct option.");
    }

    questions.push({
      q: questionText.trim(),
      options,
      answer: correct - 1
    });
  }

  if (!confirm("Save all changes to this quiz?")) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/quizzes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: currentUser.id,
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim(),
        duration,
        questions
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return showToast(data.message || "Quiz update failed.");
    }

    await loadServerQuizzes();
    await showDashboard();

    showToast("Quiz updated successfully!");

  } catch (error) {
    console.error("Quiz editing error:", error);
    showToast("Server connection failed. Please check backend.");
  }
}

// Delete Quiz from MySQL
async function deleteQuiz(id) {
  if (!currentUser) {
    return showToast("Please login first.");
  }

  const quiz = db.quizzes.find(
    item => Number(item.id) === Number(id)
  );

  if (!quiz) {
    return showToast("Quiz not found.");
  }

  if (quiz.created_by === undefined || quiz.created_by === null) {
    return showToast("Sample quizzes cannot be deleted.");
  }

  if (!confirm(
    `Delete "${quiz.title}" from the database? Its saved result history will also be deleted.`
  )) {
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/quizzes/${id}?user_id=${encodeURIComponent(currentUser.id)}`,
      { method: "DELETE" }
    );

    const data = await response.json();

    if (!response.ok) {
      return showToast(data.message || "Quiz deletion failed.");
    }

    await loadServerQuizzes();
    await showDashboard();

    showToast("Quiz deleted from MySQL successfully!");

  } catch (error) {
    console.error("Quiz deletion error:", error);
    showToast("Server connection failed.");
  }
}

// Admin: Clear Results from MySQL
async function clearResults() {
  if (!currentUser || currentUser.role !== "Admin") {
    return showToast("Only Admin can clear all results.");
  }

  if (!confirm(
    "Are you sure? This will permanently delete all quiz attempts from MySQL."
  )) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/admin/results`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: currentUser.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return showToast(data.message || "Could not clear results.");
    }

    db.results = [];
    saveData();

    await renderLeaderboard();
    await showDashboard();

    showToast("All MySQL results cleared successfully!");

  } catch (error) {
    console.error("Clear results error:", error);
    showToast("Server connection failed.");
  }
}

// MySQL Leaderboard
async function renderLeaderboard() {
  const container = document.getElementById("leaderboardList");

  if (!container) return;

  container.innerHTML = `
    <p class="empty-state">Loading leaderboard...</p>
  `;

  try {
    const response = await fetch(`${API_URL}/leaderboard`);

    if (!response.ok) {
      throw new Error("Leaderboard loading failed.");
    }

    const ranked = await response.json();

    container.innerHTML = ranked.length
      ? ranked.slice(0, 10).map((student, index) => `
          <div class="leader-row">
            <span class="rank">
              ${["🥇", "🥈", "🥉"][index] || `#${index + 1}`}
            </span>

            <span>${escapeHTML(student.student_name)}</span>

            <span class="leader-score">
              ${Number(student.average_score)}%
            </span>
          </div>
        `).join("")
      : `
          <p class="empty-state">
            No scores yet. Be the first to attempt a quiz!
          </p>
        `;

  } catch (error) {
    console.error("Leaderboard error:", error);

    container.innerHTML = `
      <p class="empty-state">
        Unable to load leaderboard. Please try again.
      </p>
    `;
  }
}

// Firebase Google Login Connection
window.QUIZMATE_API_URL = API_URL;
window.showQuizMateToast = showToast;

window.completeQuizMateLogin = async function(user) {
  if (!user) {
    showToast("Google login failed. Please try again.");
    return;
  }

  currentUser = user;
  sessionStorage.setItem("quizmate_user", JSON.stringify(currentUser));

  studentServerResults = [];
  studentResultsLoaded = false;
  dashboardStats = null;
  teacherAttempts = [];

  closeModal("loginModal");
  updateNavigation();

  await loadServerQuizzes();
  await showDashboard();

  showToast(`Welcome, ${currentUser.name}!`);
};

// Initialize Website
async function init() {
  updateNavigation();

  renderQuizzes();
  await renderLeaderboard();

  await loadServerQuizzes();

  if (currentUser) {
    await showDashboard();
  }
}

init();