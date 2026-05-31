// script.js - ПОЛНАЯ ВЕРСИЯ
const API_URL = window.location.origin;

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let currentUser = null;
let currentQuizId = null;
let currentAttemptId = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentScore = 0;
let timerInterval = null;
let timeLeft = 30;
let questionCount = 1;
let answeredCount = 0;

// ============================================
// НАВИГАЦИЯ
// ============================================
function switchToScreen(screenId) {
    const screens = ['loginScreen', 'menuScreen', 'templatesScreen', 'createScreen',
                     'joinScreen', 'shareScreen', 'quizScreen', 'resultScreen',
                     'myQuizzesScreen', 'devPanelScreen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

window.showMenuScreen = function() { switchToScreen('menuScreen'); };
window.showCreateScreen = function() { switchToScreen('createScreen'); };
window.showTemplatesScreen = function() { switchToScreen('templatesScreen'); };
window.showJoinScreen = function() {
    switchToScreen('joinScreen');
    document.getElementById('quizCodeInput').value = '';
};
window.showMyQuizzesScreen = function() {
    switchToScreen('myQuizzesScreen');
    loadMyQuizzes();
};
window.showDevPanel = function() {
    switchToScreen('devPanelScreen');
    refreshStats();
};

// ============================================
// АВТОРИЗАЦИЯ
// ============================================
window.register = async function() {
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;

    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }

    if (password !== confirm) {
        alert('Пароли не совпадают');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Регистрация успешна! Теперь войдите в аккаунт.');
            switchAuthTab('login');
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').value = '';
        } else {
            alert(data.detail || 'Ошибка регистрации');
        }
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
};

window.login = async function() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        alert('Введите имя пользователя и пароль');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = { id: data.user_id, username: data.username };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            document.getElementById('welcomeUser').textContent = `Добро пожаловать, ${data.username}!`;
            switchToScreen('menuScreen');
        } else {
            alert(data.detail || 'Ошибка входа');
        }
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
};

window.logout = function() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    switchToScreen('loginScreen');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
};

function switchAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.auth-tab');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
}

window.switchAuthTab = switchAuthTab;

function checkSavedSession() {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            document.getElementById('welcomeUser').textContent = `Добро пожаловать, ${currentUser.username}!`;
            switchToScreen('menuScreen');
        } catch(e) {
            switchToScreen('loginScreen');
        }
    } else {
        switchToScreen('loginScreen');
    }
}

// ============================================
// ШАБЛОНЫ
// ============================================
const templates = {
    artist: { title: "🎨 Великие художники", icon: "🎨",
        questions: [
            {text: "Кто написал 'Мона Лизу'?", options: ["Ван Гог", "Да Винчи", "Пикассо", "Рембрандт"], correct: 1, time_limit: 20},
            {text: "Кто отрезал себе ухо?", options: ["Моне", "Пикассо", "Ван Гог", "Дали"], correct: 2, time_limit: 15}
        ]
    },
    examples: { title: "📝 Русский язык", icon: "📝",
        questions: [
            {text: "Какое слово-исключение?", options: ["Жираф", "Шило", "Цирк", "Парашют"], correct: 3, time_limit: 20},
            {text: "Какое слово с Ы после Ц?", options: ["Цирк", "Цитата", "Цыган", "Цифра"], correct: 2, time_limit: 15}
        ]
    }
};

function loadTemplatesGrid() {
    const grid = document.getElementById('templatesGridFull');
    if (!grid) return;
    grid.innerHTML = '';
    const list = [
        {id: 'artist', name: 'Художник', icon: '🎨'},
        {id: 'examples', name: 'Русский язык', icon: '📝'}
    ];
    list.forEach(t => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.innerHTML = `<div class="template-card-icon">${t.icon}</div>
                          <div class="template-card-title">${t.name}</div>
                          <button class="template-card-btn" onclick="window.useTemplate('${t.id}')">Выбрать →</button>`;
        grid.appendChild(card);
    });
}

window.useTemplate = function(name) {
    const t = templates[name];
    if (!t) return;
    document.getElementById('quizTitle').value = t.title;
    document.getElementById('questionsContainer').innerHTML = '';
    questionCount = 1;
    t.questions.forEach((q, i) => {
        addQuestionWithData(i+1, q.text, q.options, q.correct, q.time_limit);
    });
    switchToScreen('createScreen');
};

// ============================================
// СОЗДАНИЕ ВИКТОРИНЫ
// ============================================
window.addQuestion = function() {
    addQuestionWithData(questionCount, "", ["", "", "", ""], 0, 30);
    questionCount++;
};

function addQuestionWithData(num, text, opts, correct, timeLimit) {
    const container = document.getElementById('questionsContainer');
    const div = document.createElement('div');
    div.className = 'question-editor';
    div.innerHTML = `
        <div class="question-header">Вопрос ${num}</div>
        <input type="text" class="input-field q-text" placeholder="Текст вопроса" value="${text.replace(/"/g, '&quot;')}">
        <div class="options-editor">
            <input type="text" class="input-field opt" placeholder="A" value="${opts[0]}">
            <input type="text" class="input-field opt" placeholder="B" value="${opts[1]}">
            <input type="text" class="input-field opt" placeholder="C" value="${opts[2]}">
            <input type="text" class="input-field opt" placeholder="D" value="${opts[3]}">
        </div>
        <select class="input-field time-select">
            <option value="10">10 сек</option><option value="15">15 сек</option>
            <option value="20">20 сек</option><option value="25">25 сек</option>
            <option value="30" ${timeLimit==30?'selected':''}>30 сек</option>
            <option value="45">45 сек</option><option value="60">60 сек</option>
        </select>
        <select class="input-field correct-select">
            <option value="0" ${correct==0?'selected':''}>A</option>
            <option value="1" ${correct==1?'selected':''}>B</option>
            <option value="2" ${correct==2?'selected':''}>C</option>
            <option value="3" ${correct==3?'selected':''}>D</option>
        </select>
        <button class="btn-remove" onclick="this.parentElement.remove()">🗑</button>
    `;
    container.appendChild(div);
}

window.createQuiz = async function() {
    if (!currentUser) {
        alert('Необходимо войти в аккаунт');
        return;
    }
    const title = document.getElementById('quizTitle').value;
    if (!title) return alert('Введите название');

    const editors = document.querySelectorAll('.question-editor');
    const questions = [];
    for (let ed of editors) {
        const text = ed.querySelector('.q-text').value;
        const opts = [
            ed.querySelectorAll('.opt')[0]?.value || '',
            ed.querySelectorAll('.opt')[1]?.value || '',
            ed.querySelectorAll('.opt')[2]?.value || '',
            ed.querySelectorAll('.opt')[3]?.value || ''
        ];
        const correct = parseInt(ed.querySelector('.correct-select').value);
        const time_limit = parseInt(ed.querySelector('.time-select')?.value || 30);
        if (!text || opts.some(o => !o)) return alert('Заполните все поля');
        questions.push({text, options: opts, correct, time_limit});
    }

    try {
        const response = await fetch(`${API_URL}/create_quiz?user_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, questions })
        });
        if (!response.ok) {
            const err = await response.json();
            alert(err.detail || 'Ошибка');
            return;
        }
        const data = await response.json();
        document.getElementById('shareCode').textContent = data.quiz_id;
        switchToScreen('shareScreen');
        showFullscreenAd();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
};

window.copyCode = function() {
    const code = document.getElementById('shareCode').textContent;
    navigator.clipboard.writeText(code);
    alert('Код скопирован!');
};

// ============================================
// РЕКЛАМА
// ============================================
function showFullscreenAd() {
    document.body.style.overflow = 'hidden';
    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-ad-overlay';
    overlay.innerHTML = `
        <div class="fullscreen-ad-container">
            <div class="fullscreen-ad-content">
                <div class="ad-product-icon">🧃</div>
                <div class="ad-product-name">FRESH JUICE</div>
                <div class="ad-product-title">НОВИНКА!</div>
                <div class="ad-product-desc">
                    <span class="ad-fruit">🍍 МАНГО</span>
                    <span class="ad-fruit-plus">+</span>
                    <span class="ad-fruit">🥭 МАРАКУЙЯ</span>
                </div>
                <div class="ad-slogan">Свежевыжатый сок<br>тропический вкус</div>
                <div class="ad-timer" id="adTimer">5</div>
                <div class="ad-wait-text">Реклама закончится через...</div>
                <button class="ad-close-btn hidden" id="adCloseBtn" onclick="closeFullscreenAd()">✕ ПРОПУСТИТЬ</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    let seconds = 5;
    const timerEl = overlay.querySelector('#adTimer');
    const closeBtn = overlay.querySelector('#adCloseBtn');
    const interval = setInterval(() => {
        seconds--;
        timerEl.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(interval);
            closeBtn.classList.remove('hidden');
        }
    }, 1000);
}

window.closeFullscreenAd = function() {
    const overlay = document.querySelector('.fullscreen-ad-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
};

// ============================================
// ПРОХОЖДЕНИЕ
// ============================================
window.joinQuiz = async function() {
    if (!currentUser) return alert('Необходимо войти в аккаунт');
    const code = document.getElementById('quizCodeInput').value;
    if (!code) return alert('Введите код');

    try {
        const response = await fetch(`${API_URL}/quiz/${code}`);
        if (!response.ok) throw new Error();
        const quiz = await response.json();
        currentQuizId = code;
        currentQuestions = quiz.questions;
        const startRes = await fetch(`${API_URL}/start_quiz/${code}?user_id=${currentUser.id}`, {method: 'POST'});
        const startData = await startRes.json();
        currentAttemptId = startData.attempt_id;
        document.getElementById('quizTitleDisplay').textContent = quiz.title;
        switchToScreen('quizScreen');
        startQuiz();
    } catch(e) {
        alert('Викторина не найдена');
    }
};

function startQuiz() {
    currentQuestionIndex = 0;
    currentScore = 0;
    answeredCount = 0;
    loadQuestion();
}

function loadQuestion() {
    if (currentQuestionIndex >= currentQuestions.length) {
        finishQuiz();
        return;
    }
    const q = currentQuestions[currentQuestionIndex];
    document.getElementById('questionText').textContent = q.text;
    document.getElementById('progressText').textContent = `Вопрос ${currentQuestionIndex+1} из ${currentQuestions.length}`;
    const container = document.getElementById('optionsContainer');
    container.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${letters[i]}. ${opt}`;
        btn.onclick = () => submitAnswer(i);
        container.appendChild(btn);
    });
    startTimer(q.time_limit || 30);
}

function startTimer(seconds) {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = seconds;
    const timerEl = document.getElementById('timer');
    timerEl.textContent = timeLeft;
    timerEl.classList.remove('timer-warning');
    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 5) timerEl.classList.add('timer-warning');
        if (timeLeft <= 0) { clearInterval(timerInterval); submitAnswer(-1); }
    }, 1000);
}

async function submitAnswer(answerIndex) {
    if (timerInterval) clearInterval(timerInterval);
    try {
        const res = await fetch(`${API_URL}/answer/${currentAttemptId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_index: currentQuestionIndex, answer: answerIndex })
        });
        const data = await res.json();
        currentScore = data.score;
        currentQuestionIndex++;
        answeredCount++;
        loadQuestion();
    } catch(e) {
        alert('Ошибка при отправке ответа');
    }
}

async function finishQuiz() {
    try {
        const res = await fetch(`${API_URL}/finish_quiz/${currentAttemptId}`, {method: 'POST'});
        const result = await res.json();
        document.getElementById('finalScore').textContent = result.score;
        document.getElementById('totalQuestions').textContent = `/${result.total}`;
        let msg = result.percentage === 100 ? '🎉 Идеально!' : result.percentage >= 80 ? '🌟 Отлично!' : '👍 Хорошо!';
        document.getElementById('resultMessage').textContent = msg;
        switchToScreen('resultScreen');
    } catch(e) {
        alert('Ошибка при завершении');
    }
}

window.shareToTikTok = function() {
    const score = document.getElementById('finalScore').textContent;
    const total = document.getElementById('totalQuestions').textContent;
    navigator.clipboard.writeText(`Я набрал ${score}${total} в TikTok викторине! 🎯`);
    alert('Текст скопирован!');
};

// ============================================
// МОИ ВИКТОРИНЫ
// ============================================
async function loadMyQuizzes() {
    if (!currentUser) return;
    const container = document.getElementById('quizzesList');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    try {
        const res = await fetch(`${API_URL}/my_quizzes?user_id=${currentUser.id}`);
        const quizzes = await res.json();
        if (quizzes.length === 0) {
            container.innerHTML = '<div class="empty-quizzes"><div class="empty-icon">📭</div><p>У вас пока нет викторин</p><button class="btn-primary" onclick="window.showCreateScreen()">✨ Создать первую</button></div>';
            return;
        }
        container.innerHTML = '';
        quizzes.forEach(q => {
            const card = document.createElement('div');
            card.className = 'quiz-card';
            card.innerHTML = `<div class="quiz-card-title">${escapeHtml(q.title)}</div>
                              <div class="quiz-card-code">Код: ${q.id}</div>
                              <div class="quiz-card-buttons">
                                  <button class="quiz-card-btn play" onclick="window.playQuiz('${q.id}')">🎮 Играть</button>
                                  <button class="quiz-card-btn delete" onclick="window.deleteQuiz('${q.id}')">🗑 Удалить</button>
                              </div>`;
            container.appendChild(card);
        });
    } catch(e) {
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
}

window.playQuiz = async function(quizId) {
    if (!currentUser) return alert('Войдите в аккаунт');
    try {
        const res = await fetch(`${API_URL}/quiz/${quizId}`);
        const quiz = await res.json();
        currentQuizId = quizId;
        currentQuestions = quiz.questions;
        const startRes = await fetch(`${API_URL}/start_quiz/${quizId}?user_id=${currentUser.id}`, {method: 'POST'});
        const startData = await startRes.json();
        currentAttemptId = startData.attempt_id;
        document.getElementById('quizTitleDisplay').textContent = quiz.title;
        switchToScreen('quizScreen');
        startQuiz();
    } catch(e) {
        alert('Ошибка запуска');
    }
};

window.deleteQuiz = async function(quizId) {
    if (!confirm('Удалить викторину?')) return;
    const res = await fetch(`${API_URL}/delete_quiz/${quizId}?user_id=${currentUser.id}`, {method: 'DELETE'});
    if (res.ok) {
        alert('Удалено');
        loadMyQuizzes();
    } else {
        alert('Ошибка удаления');
    }
};

window.deleteAllQuizzes = async function() {
    if (!confirm('Удалить ВСЕ свои викторины?')) return;
    const res = await fetch(`${API_URL}/delete_all_quizzes?user_id=${currentUser.id}`, {method: 'DELETE'});
    if (res.ok) {
        alert('Все викторины удалены');
        loadMyQuizzes();
        refreshStats();
    }
};

async function refreshStats() {
    try {
        const res = await fetch(`${API_URL}/admin/stats`);
        const stats = await res.json();
        document.getElementById('statsUsers').textContent = `👥 Пользователей: ${stats.total_users}`;
        document.getElementById('statsQuizzes').textContent = `📊 Викторин: ${stats.total_quizzes}`;
        document.getElementById('statsAttempts').textContent = `🎮 Попыток: ${stats.total_attempts}`;
    } catch(e) {}
}

window.refreshStats = refreshStats;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
loadTemplatesGrid();
addQuestionWithData(1, "", ["", "", "", ""], 0, 30);
checkSavedSession();