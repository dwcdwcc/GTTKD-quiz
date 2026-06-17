// Global State
let allQuestions = [];
let currentQuizList = [];
let currentQuestionIndex = 0;
let isIncorrectReviewMode = false;
let quizTimerInterval = null;
let quizStartTime = null;

// Per-session quiz tracking
let sessionCorrect = 0;
let sessionTotal = 0;
let lastNavDirection = 'right'; // 'left' or 'right' for animation

// User Data persisted in localStorage
let userData = {
    stats: {
        answeredCount: 0,
        correctCount: 0,
        currentStreak: 0,
        highestStreak: 0
    },
    incorrectList: [], // Array of question IDs
    progress: {
        easy: [],   // Array of answered question IDs
        medium: [], // Array of answered question IDs
        hard: []    // Array of answered question IDs
    }
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Load data from global variable QUESTIONS_DATA (loaded via script tag)
    if (typeof QUESTIONS_DATA !== 'undefined') {
        allQuestions = QUESTIONS_DATA;
    } else {
        console.error("QUESTIONS_DATA is not defined!");
    }
    
    // 2. Load persistent data from localStorage
    loadUserData();
    
    // 3. Initialize Event Listeners
    initEventListeners();
    
    // 4. Update UI Components
    updateDashboardUI();
    updateStatsSidebar();
    
    // 5. Initial View Setup
    switchTab('dashboard');
});

// ==========================================
// LOCAL STORAGE ACTIONS
// ==========================================
function loadUserData() {
    const savedData = localStorage.getItem('gttkd_quiz_userdata');
    if (savedData) {
        try {
            const parsed = jsonSafeParse(savedData);
            if (parsed) {
                userData = {
                    stats: { ...userData.stats, ...parsed.stats },
                    incorrectList: parsed.incorrectList || [],
                    progress: { ...userData.progress, ...parsed.progress }
                };
            }
        } catch (e) {
            console.error("Error parsing user data from localStorage", e);
        }
    }
}

function saveUserData() {
    localStorage.setItem('gttkd_quiz_userdata', JSON.stringify(userData));
    updateStatsSidebar();
    updateDashboardUI();
}

function jsonSafeParse(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function initEventListeners() {
    // Sidebar Tabs
    document.querySelectorAll(".nav-item").forEach(button => {
        button.addEventListener("click", (e) => {
            const tabId = button.getAttribute("data-tab");
            switchTab(tabId);
        });
    });
    
    // Reset Data
    document.getElementById("btn-reset-data").addEventListener("click", () => {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử học tập? Thống kê và sổ tay câu sai sẽ bị đặt lại về 0.")) {
            localStorage.removeItem('gttkd_quiz_userdata');
            userData = {
                stats: { answeredCount: 0, correctCount: 0, currentStreak: 0, highestStreak: 0 },
                incorrectList: [],
                progress: { easy: [], medium: [], hard: [] }
            };
            saveUserData();
            switchTab('dashboard');
            showToast("Đã đặt lại toàn bộ dữ liệu thành công!");
        }
    });
    
    // Quiz View Buttons
    document.getElementById("btn-quiz-back").addEventListener("click", () => {
        stopQuizTimer();
        switchTab('dashboard');
    });
    
    document.getElementById("btn-prev-question").addEventListener("click", () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderCurrentQuestion('left');
        }
    });
    
    document.getElementById("btn-next-question").addEventListener("click", () => {
        if (currentQuestionIndex < currentQuizList.length - 1) {
            currentQuestionIndex++;
            renderCurrentQuestion('right');
        } else {
            // End of Quiz List
            stopQuizTimer();
            showResultModal();
        }
    });
    
    // Incorrect Tab Action
    document.getElementById("btn-start-review-incorrect").addEventListener("click", () => {
        startIncorrectReviewQuiz();
    });
    
    // Search & Filter Events
    document.getElementById("search-input").addEventListener("input", filterAllQuestionsList);
    document.getElementById("filter-level-select").addEventListener("change", filterAllQuestionsList);
}

// ==========================================
// NAVIGATION & TABS
// ==========================================
function switchTab(tabId) {
    // Update Sidebar Navigation States
    document.querySelectorAll(".nav-item").forEach(item => {
        if (item.getAttribute("data-tab") === tabId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
    
    // Update Main Panels Visibility
    document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.remove("active");
    });
    
    // Title/Subtitle dictionary
    const headings = {
        'dashboard': { title: 'Trang Chủ', sub: 'Học và ôn tập hiệu quả cùng GTTKD Quiz' },
        'quiz': { title: 'Luyện Tập Trắc Nghiệm', sub: 'Rèn luyện kiến thức theo cấp độ khó' },
        'incorrect-book': { title: 'Sổ Tay Câu Sai', sub: 'Ôn tập lại các câu hỏi đã chọn sai để nhớ kỹ hơn' },
        'all-questions': { title: 'Danh Sách Câu Hỏi', sub: 'Tra cứu toàn bộ câu hỏi và đáp án chuẩn trong file ôn tập' }
    };
    
    // Update heading
    const headingInfo = headings[tabId] || headings['dashboard'];
    document.getElementById("header-heading").textContent = headingInfo.title;
    document.getElementById("header-sub").textContent = headingInfo.sub;
    
    // Show selected panel
    if (tabId === 'dashboard') {
        document.getElementById("panel-dashboard").classList.add("active");
        updateDashboardUI();
    } else if (tabId === 'quiz') {
        document.getElementById("panel-quiz").classList.add("active");
    } else if (tabId === 'incorrect-book') {
        document.getElementById("panel-incorrect-book").classList.add("active");
        renderIncorrectList();
    } else if (tabId === 'all-questions') {
        document.getElementById("panel-all-questions").classList.add("active");
        renderAllQuestionsList();
    }
}

// ==========================================
// DASHBOARD VIEW
// ==========================================
function updateDashboardUI() {
    // 1. Calculate and update Level Completion Progress
    const levels = ['easy', 'medium', 'hard'];
    levels.forEach(level => {
        const total = allQuestions.filter(q => q.level === level).length;
        const answered = userData.progress[level] ? userData.progress[level].length : 0;
        const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;
        
        const bar = document.getElementById(`progress-${level}`);
        const text = document.getElementById(`percent-${level}`);
        if (bar && text) {
            bar.style.width = `${percentage}%`;
            text.textContent = `${percentage}% (${answered}/${total})`;
        }
    });
    
    // 2. Update Incorrect Count Badge
    const incorrectBadge = document.getElementById("incorrect-count");
    if (incorrectBadge) {
        incorrectBadge.textContent = userData.incorrectList.length;
        if (userData.incorrectList.length > 0) {
            incorrectBadge.style.display = 'inline-block';
        } else {
            incorrectBadge.style.display = 'none';
        }
    }
}

function updateStatsSidebar() {
    // 1. Accuracy
    const totalAns = userData.stats.answeredCount;
    const correct = userData.stats.correctCount;
    const accuracy = totalAns > 0 ? Math.round((correct / totalAns) * 100) : 0;
    document.getElementById("stats-accuracy").textContent = `${accuracy}%`;
    
    // 2. Streak
    document.getElementById("stats-streak").textContent = `${userData.stats.currentStreak} (Kỷ lục: ${userData.stats.highestStreak})`;
    
    // 3. Answered Total Unique
    const uniqueAnswered = new Set([
        ...userData.progress.easy,
        ...userData.progress.medium,
        ...userData.progress.hard
    ]).size;
    document.getElementById("stats-answered").textContent = `${uniqueAnswered}/${allQuestions.length}`;
}

// ==========================================
// QUIZ CORE LOGIC
// ==========================================
function startQuizLevel(level) {
    // Filter questions for the selected level
    currentQuizList = allQuestions.filter(q => q.level === level);
    if (currentQuizList.length === 0) {
        alert("Không tìm thấy câu hỏi cho cấp độ này!");
        return;
    }
    
    isIncorrectReviewMode = false;
    currentQuestionIndex = 0;
    sessionCorrect = 0;
    sessionTotal = 0;
    lastNavDirection = 'right';
    
    // Update Quiz Header Tags
    const levelNames = { easy: "Dễ (Chương 1)", medium: "Trung Bình (Chương 2)", hard: "Khó (Chương 3)" };
    document.getElementById("current-quiz-level").textContent = levelNames[level] || level;
    document.getElementById("current-quiz-level").className = `quiz-level-tag ${level}`;
    
    // Switch view to Quiz
    switchTab('quiz');
    
    // Start Timer
    startQuizTimer();
    
    // Render first question
    renderCurrentQuestion();
}

function renderCurrentQuestion(direction = 'right') {
    if (currentQuizList.length === 0) return;
    const question = currentQuizList[currentQuestionIndex];
    
    // Update Progress Indicators
    document.getElementById("quiz-progress-counter").textContent = `Câu ${currentQuestionIndex + 1}/${currentQuizList.length}`;
    const progressPercent = ((currentQuestionIndex + 1) / currentQuizList.length) * 100;
    document.getElementById("quiz-progress-fill").style.width = `${progressPercent}%`;
    
    // Card Info
    document.getElementById("question-id").textContent = `Câu ${question.id}`;
    
    const diffNames = { easy: "Dễ", medium: "Trung Bình", hard: "Khó" };
    const diffBadge = document.getElementById("question-diff-badge");
    diffBadge.textContent = diffNames[question.level] || question.level;
    diffBadge.className = `question-difficulty ${question.level}`;
    
    document.getElementById("question-text").textContent = question.text;
    
    // Slide animation on card
    const card = document.getElementById("quiz-card");
    card.classList.remove('slide-in-right', 'slide-in-left');
    void card.offsetWidth; // force reflow to restart animation
    card.classList.add(direction === 'right' ? 'slide-in-right' : 'slide-in-left');
    
    // Render Options
    const optionsContainer = document.getElementById("options-container");
    optionsContainer.innerHTML = "";
    
    // Remove any previous feedback banner
    const existingFeedback = document.getElementById("feedback-banner");
    if (existingFeedback) existingFeedback.remove();
    
    question.options.forEach(optionStr => {
        // Option is formatted like "A. Text..." or "B. Text..."
        const optLetter = optionStr.substring(0, 1);
        const optContent = optionStr.substring(2).trim();
        
        const button = document.createElement("button");
        button.className = "option-btn";
        button.dataset.letter = optLetter;
        button.innerHTML = `
            <span><strong>${optLetter}</strong>. ${optContent}</span>
            <i class="option-icon fa-solid"></i>
        `;
        
        button.addEventListener("click", () => handleOptionSelect(optLetter, question));
        optionsContainer.appendChild(button);
    });
    
    // Disable Next button until answered
    document.getElementById("btn-next-question").disabled = true;
    
    // Enable/Disable Prev button
    document.getElementById("btn-prev-question").disabled = (currentQuestionIndex === 0);
}

function handleOptionSelect(selectedLetter, question) {
    const optionsContainer = document.getElementById("options-container");
    const buttons = optionsContainer.querySelectorAll(".option-btn");
    
    // Prevent multiple selections
    if (optionsContainer.querySelector(".correct") || optionsContainer.querySelector(".incorrect")) return;
    
    const correctLetter = question.answer;
    const isCorrect = (selectedLetter === correctLetter);
    
    // Mark buttons with correct/incorrect styles
    buttons.forEach(btn => {
        const btnLetter = btn.dataset.letter;
        btn.classList.add("disabled");
        btn.style.pointerEvents = "none";
        
        if (btnLetter === correctLetter) {
            btn.classList.add("correct");
            btn.querySelector("i").classList.add("fa-circle-check");
        } else if (btnLetter === selectedLetter && !isCorrect) {
            btn.classList.add("incorrect");
            btn.querySelector("i").classList.add("fa-circle-xmark");
        }
    });
    
    // Update Stats
    userData.stats.answeredCount++;
    if (isCorrect) {
        userData.stats.correctCount++;
        userData.stats.currentStreak++;
        if (userData.stats.currentStreak > userData.stats.highestStreak) {
            userData.stats.highestStreak = userData.stats.currentStreak;
        }
        
        // Remove from incorrect list if in Incorrect Review Mode
        if (isIncorrectReviewMode) {
            const idx = userData.incorrectList.indexOf(question.id);
            if (idx > -1) {
                userData.incorrectList.splice(idx, 1);
            }
        }
        
        // Add to completed progress for level (avoid duplicates)
        if (!isIncorrectReviewMode) {
            const lvlProgress = userData.progress[question.level];
            if (!lvlProgress.includes(question.id)) {
                lvlProgress.push(question.id);
            }
        }
    } else {
        userData.stats.currentStreak = 0;
        
        // Add to incorrect list (avoid duplicates)
        if (!userData.incorrectList.includes(question.id)) {
            userData.incorrectList.push(question.id);
        }
    }
    
    saveUserData();
    
    // Session stats — count only questions answered (not navigation revisits)
    sessionTotal++;
    if (isCorrect) sessionCorrect++;
    
    // Show feedback banner
    showFeedbackBanner(isCorrect, question);
    
    // Enable Next button
    document.getElementById("btn-next-question").disabled = false;
}

function showFeedbackBanner(isCorrect, question) {
    // Remove existing
    const existing = document.getElementById("feedback-banner");
    if (existing) existing.remove();
    
    const correctOpt = question.options.find(o => o.startsWith(question.answer)) || question.answer;
    const streakVal = userData.stats.currentStreak;
    
    const banner = document.createElement('div');
    banner.id = 'feedback-banner';
    banner.className = `feedback-banner ${isCorrect ? 'correct-banner' : 'incorrect-banner'}`;
    
    if (isCorrect) {
        banner.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <div>
                <strong>Chính xác!</strong>
                ${streakVal >= 3 ? `<span class="streak-burst" style="margin-left:10px;">🔥 Chuỗi ${streakVal} câu đúng!</span>` : ''}
            </div>
        `;
    } else {
        banner.innerHTML = `
            <i class="fa-solid fa-circle-xmark"></i>
            <div>
                <strong>Chưa đúng!</strong>
                <span style="margin-left:10px;font-weight:400;">Đáp án đúng là: <strong>${correctOpt}</strong></span>
            </div>
        `;
    }
    
    // Append inside quiz-card
    document.getElementById("quiz-card").appendChild(banner);
}

function showResultModal() {
    const total = sessionTotal;
    const correct = sessionCorrect;
    const incorrect = total - correct;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    const elapsed = quizStartTime ? Math.floor((Date.now() - quizStartTime) / 1000) : 0;
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    
    // Determine emoji
    let emoji = '🎉';
    if (acc >= 90) emoji = '🏆';
    else if (acc >= 70) emoji = '👏';
    else if (acc >= 50) emoji = '💪';
    else emoji = '📚';
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card">
            <div class="modal-emoji">${emoji}</div>
            <h2>Hoàn thành bài luyện tập!</h2>
            <p>Bạn đã trả lời <strong>${total}</strong> câu hỏi với độ chính xác <strong>${acc}%</strong>. Tiếp tục cố gắng nhé!</p>
            <div class="modal-stats">
                <div class="modal-stat">
                    <span class="modal-stat-num" style="color: var(--color-correct)">${correct}</span>
                    <span class="modal-stat-lbl">Đúng</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-stat-num" style="color: var(--color-incorrect)">${incorrect}</span>
                    <span class="modal-stat-lbl">Sai</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-stat-num">${mins}:${secs}</span>
                    <span class="modal-stat-lbl">Thời gian</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-stat-num">${acc}%</span>
                    <span class="modal-stat-lbl">Chính xác</span>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" id="modal-back-btn">
                    <i class="fa-solid fa-house-chimney"></i> Trang Chủ
                </button>
                <button class="btn btn-primary" id="modal-retry-btn">
                    <i class="fa-solid fa-rotate-right"></i> Làm Lại
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('modal-back-btn').addEventListener('click', () => {
        overlay.remove();
        switchTab('dashboard');
    });
    
    document.getElementById('modal-retry-btn').addEventListener('click', () => {
        overlay.remove();
        // Restart from index 0
        sessionCorrect = 0;
        sessionTotal = 0;
        currentQuestionIndex = 0;
        startQuizTimer();
        renderCurrentQuestion('right');
    });
}

// ==========================================
// INCORRECT BOOK & RE-STUDY
// ==========================================
function renderIncorrectList() {
    const listContainer = document.getElementById("incorrect-list-container");
    const title = document.getElementById("incorrect-count-title");
    const startBtn = document.getElementById("btn-start-review-incorrect");
    
    const count = userData.incorrectList.length;
    title.textContent = `Bạn có ${count} câu trả lời sai`;
    
    if (count === 0) {
        startBtn.disabled = true;
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-square-check"></i>
                <h3>Tuyệt vời!</h3>
                <p>Bạn không có câu hỏi sai nào cả. Hãy tiếp tục luyện tập nhé!</p>
            </div>
        `;
        return;
    }
    
    startBtn.disabled = false;
    listContainer.innerHTML = "";
    
    // Load incorrect questions details
    const incorrectQuestions = allQuestions.filter(q => userData.incorrectList.includes(q.id));
    
    incorrectQuestions.forEach(q => {
        const card = document.createElement("div");
        card.className = "incorrect-item-card";
        
        // Level badge class and name
        const levels = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };
        const levelText = levels[q.level] || q.level;
        
        // Find correct option text
        const correctOpt = q.options.find(opt => opt.startsWith(q.answer)) || `${q.answer}.`;
        
        card.innerHTML = `
            <div class="incorrect-item-header">
                <span>Câu ${q.id}</span>
                <span class="question-row-badge ${q.level}-badge">${levelText}</span>
            </div>
            <div class="incorrect-item-title">${q.text}</div>
            <div class="incorrect-item-answer">
                <i class="fa-solid fa-circle-check"></i> Đáp án đúng: ${correctOpt}
            </div>
        `;
        
        listContainer.appendChild(card);
    });
}

function startIncorrectReviewQuiz() {
    if (userData.incorrectList.length === 0) return;
    
    // Build quiz list from incorrect list
    currentQuizList = allQuestions.filter(q => userData.incorrectList.includes(q.id));
    isIncorrectReviewMode = true;
    currentQuestionIndex = 0;
    sessionCorrect = 0;
    sessionTotal = 0;
    
    // Header Setup
    document.getElementById("current-quiz-level").textContent = "Ôn Tập Câu Sai";
    document.getElementById("current-quiz-level").className = "quiz-level-tag hard";
    
    // Switch view
    switchTab('quiz');
    startQuizTimer();
    renderCurrentQuestion('right');
}

// ==========================================
// VIEW ALL & SEARCH FILTER
// ==========================================
function renderAllQuestionsList() {
    filterAllQuestionsList();
}

function filterAllQuestionsList() {
    const listContainer = document.getElementById("all-questions-list-container");
    if (!listContainer) return;
    
    const searchVal = document.getElementById("search-input").value.toLowerCase().trim();
    const filterLevel = document.getElementById("filter-level-select").value;
    
    listContainer.innerHTML = "";
    
    // Filter questions
    const filtered = allQuestions.filter(q => {
        // Level match
        if (filterLevel !== "all" && q.level !== filterLevel) {
            return false;
        }
        
        // Search text match
        if (searchVal !== "") {
            const inText = q.text.toLowerCase().includes(searchVal);
            const inId = q.id.toLowerCase().includes(searchVal);
            const inOpts = q.options.some(opt => opt.toLowerCase().includes(searchVal));
            return inText || inId || inOpts;
        }
        
        return true;
    });
    
    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass"></i>
                <h3>Không tìm thấy câu hỏi</h3>
                <p>Thử nhập từ khóa khác xem sao nhé!</p>
            </div>
        `;
        return;
    }
    
    // Render filtered items (render max 50 first to avoid lagging if too many)
    const limit = Math.min(filtered.length, 100);
    
    for (let i = 0; i < limit; i++) {
        const q = filtered[i];
        const card = document.createElement("div");
        card.className = "question-row-card";
        
        const levels = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };
        const levelText = levels[q.level] || q.level;
        
        // Options rendering
        let optionsHtml = "";
        q.options.forEach(opt => {
            const isAns = opt.startsWith(q.answer);
            optionsHtml += `
                <div class="row-opt ${isAns ? 'is-answer' : ''}">
                    ${isAns ? '<i class="fa-solid fa-circle-check"></i> ' : ''}
                    ${opt}
                </div>
            `;
        });
        
        card.innerHTML = `
            <div class="question-row-header">
                <span class="question-row-id">Câu ${q.id}</span>
                <span class="question-row-badge ${q.level}-badge">${levelText}</span>
            </div>
            <div class="question-row-text">${q.text}</div>
            <div class="question-row-options">
                ${optionsHtml}
            </div>
        `;
        listContainer.appendChild(card);
    }
    
    if (filtered.length > limit) {
        const moreBtn = document.createElement("div");
        moreBtn.style.textAlign = "center";
        moreBtn.style.padding = "10px 0";
        moreBtn.innerHTML = `<span style="color:var(--text-secondary);font-size:12px;">Đang hiển thị ${limit}/${filtered.length} câu. Gõ tìm kiếm cụ thể để tìm câu mong muốn.</span>`;
        listContainer.appendChild(moreBtn);
    }
}

// ==========================================
// TIMER UTILITIES
// ==========================================
function startQuizTimer() {
    stopQuizTimer();
    quizStartTime = Date.now();
    quizTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        document.getElementById("quiz-timer-val").textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopQuizTimer() {
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    toast.style.background = "var(--accent-primary)";
    toast.style.color = "#fff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "30px";
    toast.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.3)";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "700";
    toast.style.zIndex = "9999";
    toast.style.transition = "all 0.3s ease";
    toast.style.opacity = "0";
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = "translateX(-50%) translateY(0)";
        toast.style.opacity = "1";
    }, 10);
    
    // Animate out
    setTimeout(() => {
        toast.style.transform = "translateX(-50%) translateY(-20px)";
        toast.style.opacity = "0";
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2500);
}

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================
document.addEventListener('keydown', (e) => {
    // Only active during Quiz tab
    const quizPanel = document.getElementById('panel-quiz');
    if (!quizPanel || !quizPanel.classList.contains('active')) return;
    
    // Don't intercept if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const key = e.key;
    
    // A B C D — quick select option
    if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(key)) {
        const letter = key.toUpperCase();
        const optionsContainer = document.getElementById('options-container');
        if (!optionsContainer) return;
        const buttons = optionsContainer.querySelectorAll('.option-btn');
        for (const btn of buttons) {
            if (btn.dataset.letter === letter) {
                btn.click();
                break;
            }
        }
        return;
    }
    
    // Space / Enter — go to next question
    if (key === ' ' || key === 'Enter') {
        e.preventDefault();
        const nextBtn = document.getElementById('btn-next-question');
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
        return;
    }
    
    // ArrowRight — next question
    if (key === 'ArrowRight') {
        e.preventDefault();
        const nextBtn = document.getElementById('btn-next-question');
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
        return;
    }
    
    // ArrowLeft — previous question
    if (key === 'ArrowLeft') {
        e.preventDefault();
        const prevBtn = document.getElementById('btn-prev-question');
        if (prevBtn && !prevBtn.disabled) prevBtn.click();
        return;
    }
});
