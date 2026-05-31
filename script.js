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
window.showTemplatesScreen = function() {
    switchToScreen('templatesScreen');
    loadTemplatesGrid();
};
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
    artist: {
        title: "🎨 Великие художники",
        icon: "🎨",
        questions: [
            {text: "Кто написал картину 'Мона Лиза'?", options: ["Ван Гог", "Леонардо да Винчи", "Пикассо", "Рембрандт"], correct: 1, time_limit: 20},
            {text: "Какой художник отрезал себе ухо?", options: ["Клод Моне", "Пабло Пикассо", "Винсент Ван Гог", "Сальвадор Дали"], correct: 2, time_limit: 15},
            {text: "Кто написал 'Звездную ночь'?", options: ["Да Винчи", "Ван Гог", "Микеланджело", "Мунк"], correct: 1, time_limit: 25},
            {text: "Какой художник известен 'Танцующими фигурами'?", options: ["Дега", "Матисс", "Пикассо", "Моне"], correct: 1, time_limit: 20}
        ]
    },
    examples: {
        title: "📝 Русский язык",
        icon: "📝",
        questions: [
            {text: "Какое слово-исключение?", options: ["Жираф", "Шило", "Цирк", "Парашют"], correct: 3, time_limit: 20},
            {text: "Какое слово с Ы после Ц?", options: ["Цирк", "Цитата", "Цыган", "Цифра"], correct: 2, time_limit: 15},
            {text: "Какое слово-исключение из правила?", options: ["Циновка", "Цистерна", "Цыпленок", "Цифра"], correct: 2, time_limit: 25},
            {text: "Как правильно пишется?", options: ["Розыгрыш", "Розыгрышь", "Розігриш", "Разіграш"], correct: 0, time_limit: 20}
        ]
    },
    inequalities: {
        title: "📐 Математика",
        icon: "📐",
        questions: [
            {text: "Какое неравенство верно?", options: ["5 > 10", "3 < 7", "8 = 6", "4 > 9"], correct: 1, time_limit: 15},
            {text: "2x + 3 > 7, x > ?", options: ["1", "2", "3", "4"], correct: 1, time_limit: 30},
            {text: "Если x = 5, то какое неравенство верно?", options: ["x < 3", "x > 8", "x > 4", "x = 10"], correct: 2, time_limit: 20},
            {text: "Какое число подходит для x ≤ 7?", options: ["8", "9", "7", "10"], correct: 2, time_limit: 15}
        ]
    },
    movies: {
        title: "🎬 Кино",
        icon: "🎬",
        questions: [
            {text: "Кто сыграл Джона Уика?", options: ["Том Круз", "Киану Ривз", "Брэд Питт", "Мэтт Деймон"], correct: 1, time_limit: 20},
            {text: "Какой фильм получил Оскар в 2020?", options: ["1917", "Джокер", "Паразиты", "Ирландец"], correct: 2, time_limit: 25},
            {text: "Кто режиссер 'Интерстеллара'?", options: ["Тарантино", "Нолан", "Кэмерон", "Спилберг"], correct: 1, time_limit: 20},
            {text: "Кто играл Железного человека?", options: ["Крис Эванс", "Крис Хемсворт", "Роберт Дауни мл.", "Скарлетт Йоханссон"], correct: 2, time_limit: 15}
        ]
    },
    music: {
        title: "🎵 Музыка",
        icon: "🎵",
        questions: [
            {text: "Кто спел 'Billie Jean'?", options: ["Принс", "Майкл Джексон", "Стиви Уандер", "Лайонел Ричи"], correct: 1, time_limit: 20},
            {text: "Какая группа спела 'Bohemian Rhapsody'?", options: ["The Beatles", "Queen", "Rolling Stones", "Pink Floyd"], correct: 1, time_limit: 25},
            {text: "Кто такая Бейонсе?", options: ["Актриса", "Певица", "Спортсменка", "Политик"], correct: 1, time_limit: 15},
            {text: "Кого называют 'Король поп-музыки'?", options: ["Элвис Пресли", "Майкл Джексон", "Фредди Меркьюри", "Принс"], correct: 1, time_limit: 20}
        ]
    },
    sports: {
        title: "⚽ Спорт",
        icon: "⚽",
        questions: [
            {text: "Кто выиграл ЧМ-2018 по футболу?", options: ["Бразилия", "Германия", "Франция", "Аргентина"], correct: 2, time_limit: 20},
            {text: "Сколько игроков в футбольной команде?", options: ["10", "11", "12", "9"], correct: 1, time_limit: 15},
            {text: "Самый титулованный теннисист?", options: ["Федерер", "Надаль", "Джокович", "Сампрас"], correct: 2, time_limit: 25},
            {text: "Какой спорт - 'королева спорта'?", options: ["Футбол", "Баскетбол", "Легкая атлетика", "Плавание"], correct: 2, time_limit: 20}
        ]
    }
};

function loadTemplatesGrid() {
    const grid = document.getElementById('templatesGridFull');
    if (!grid) return;
    grid.innerHTML = '';
    const list = [
        {id: 'artist', name: 'Великие художники', icon: '🎨', desc: 'Проверь знания о художниках'},
        {id: 'examples', name: 'Русский язык', icon: '📝', desc: 'Правила и исключения'},
        {id: 'inequalities', name: 'Математика', icon: '📐', desc: 'Неравенства и задачи'},
        {id: 'movies', name: 'Кино', icon: '🎬', desc: 'Фильмы и актеры'},
        {id: 'music', name: 'Музыка', icon: '🎵', desc: 'Хиты и исполнители'},
        {id: 'sports', name: 'Спорт', icon: '⚽', desc: 'Достижения и рекорды'}
    ];
    list.forEach(t => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.innerHTML = `
            <div class="template-card-icon">${t.icon}</div>
            <div class="template-card-title">${t.name}</div>
            <div class="template-card-desc">${t.desc}</div>
            <button class="template-card-btn" onclick="window.useTemplate('${t.id}')">Выбрать →</button>
        `;
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
            <input type="text" class="input-field opt" placeholder="Вариант A" value="${opts[0]}">
            <input type="text" class="input-field opt" placeholder="Вариант B" value="${opts[1]}">
            <input type="text" class="input-field opt" placeholder="Вариант C" value="${opts[2]}">
            <input type="text" class="input-field opt" placeholder="Вариант D" value="${opts[3]}">
        </div>
        <div class="time-selector">
            <label>⏱ Время на вопрос:</label>
            <select class="input-field time-select">
                <option value="10" ${timeLimit === 10 ? 'selected' : ''}>10 секунд</option>
                <option value="15" ${timeLimit === 15 ? 'selected' : ''}>15 секунд</option>
                <option value="20" ${timeLimit === 20 ? 'selected' : ''}>20 секунд</option>
                <option value="25" ${timeLimit === 25 ? 'selected' : ''}>25 секунд</option>
                <option value="30" ${timeLimit === 30 ? 'selected' : ''}>30 секунд</option>
                <option value="45" ${timeLimit === 45 ? 'selected' : ''}>45 секунд</option>
                <option value="60" ${timeLimit === 60 ? 'selected' : ''}>60 секунд</option>
            </select>
        </div>
        <select class="input-field correct-select">
            <option value="0" ${correct === 0 ? 'selected' : ''}>Правильный ответ: A</option>
            <option value="1" ${correct === 1 ? 'selected' : ''}>Правильный ответ: B</option>
            <option value="2" ${correct === 2 ? 'selected' : ''}>Правильный ответ: C</option>
            <option value="3" ${correct === 3 ? 'selected' : ''}>Правильный ответ: D</option>
        </select>
        <button class="btn-remove" onclick="this.parentElement.remove()">🗑 Удалить вопрос</button>
    `;
    container.appendChild(div);
}

window.createQuiz = async function() {
    if (!currentUser) {
        alert('Необходимо войти в аккаунт');
        return;
    }

    const title = document.getElementById('quizTitle').value;
    if (!title) {
        alert('Введите название викторины');
        return;
    }

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

        if (!text || opts.some(o => !o)) {
            alert('Заполните все поля вопросов');
            return;
        }
        questions.push({ text, options: opts, correct, time_limit });
    }

    if (questions.length === 0) {
        alert('Добавьте хотя бы один вопрос');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/create_quiz?user_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, questions })
        });

        if (!response.ok) {
            const err = await response.json();
            alert(err.detail || 'Ошибка создания');
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
    alert('Код скопирован! Поделись им с друзьями');
};

// ============================================
// РЕКЛАМА (ПОЛНОЭКРАННАЯ)
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
// ПРОХОЖДЕНИЕ ВИКТОРИНЫ
// ============================================
window.joinQuiz = async function() {
    if (!currentUser) {
        alert('Необходимо войти в аккаунт');
        return;
    }

    const code = document.getElementById('quizCodeInput').value;
    if (!code) {
        alert('Введите код викторины');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/quiz/${code}`);
        if (!response.ok) throw new Error();
        const quiz = await response.json();

        currentQuizId = code;
        currentQuestions = quiz.questions;

        const startRes = await fetch(`${API_URL}/start_quiz/${code}?user_id=${currentUser.id}`, {
            method: 'POST'
        });
        const startData = await startRes.json();
        currentAttemptId = startData.attempt_id;

        document.getElementById('quizTitleDisplay').textContent = quiz.title;
        switchToScreen('quizScreen');
        startQuiz();
    } catch (error) {
        alert('Викторина не найдена! Проверьте код');
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
    document.getElementById('progressText').textContent = `Вопрос ${currentQuestionIndex + 1} из ${currentQuestions.length}`;

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

        if (timeLeft <= 5) {
            timerEl.classList.add('timer-warning');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitAnswer(-1);
        }
    }, 1000);
}

async function submitAnswer(answerIndex) {
    if (timerInterval) clearInterval(timerInterval);

    try {
        const response = await fetch(`${API_URL}/answer/${currentAttemptId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_index: currentQuestionIndex,
                answer: answerIndex
            })
        });
        const data = await response.json();
        currentScore = data.score;
        currentQuestionIndex++;
        answeredCount++;
        loadQuestion();
    } catch (error) {
        alert('Ошибка при отправке ответа');
    }
}

async function finishQuiz() {
    try {
        const response = await fetch(`${API_URL}/finish_quiz/${currentAttemptId}`, {
            method: 'POST'
        });
        const result = await response.json();

        document.getElementById('finalScore').textContent = result.score;
        document.getElementById('totalQuestions').textContent = `/${result.total}`;

        const percentage = result.percentage;
        let message = '';
        if (percentage === 100) message = '🎉 Идеально! Ты гений! 🎉';
        else if (percentage >= 80) message = '🌟 Отлично! Ты крут! 🌟';
        else if (percentage >= 60) message = '👍 Хороший результат! 👍';
        else if (percentage >= 40) message = '😊 Неплохо, но можно лучше! 😊';
        else message = '💪 В следующий раз получится лучше! 💪';

        document.getElementById('resultMessage').textContent = message;
        switchToScreen('resultScreen');
    } catch (error) {
        alert('Ошибка при завершении викторины');
    }
}

window.shareToTikTok = function() {
    const score = document.getElementById('finalScore').textContent;
    const total = document.getElementById('totalQuestions').textContent;
    const text = `Я набрал ${score}${total} в TikTok викторине! Попробуй побить мой рекорд! 🎯`;
    navigator.clipboard.writeText(text);
    alert('✅ Текст скопирован! Вставь его в TikTok вместе со скриншотом результата');
};

// ============================================
// МОИ ВИКТОРИНЫ
// ============================================
async function loadMyQuizzes() {
    if (!currentUser) return;

    const container = document.getElementById('quizzesList');
    container.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const response = await fetch(`${API_URL}/my_quizzes?user_id=${currentUser.id}`);
        const quizzes = await response.json();

        if (quizzes.length === 0) {
            container.innerHTML = `
                <div class="empty-quizzes">
                    <div class="empty-icon">📭</div>
                    <p>У вас пока нет созданных викторин</p>
                    <button class="btn-primary" onclick="window.showCreateScreen()">✨ Создать первую</button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'quiz-card';
            card.innerHTML = `
                <div class="quiz-card-title">${escapeHtml(quiz.title)}</div>
                <div class="quiz-card-code">Код: ${quiz.id}</div>
                <div class="quiz-card-date">📅 ${new Date(quiz.created_at).toLocaleDateString()}</div>
                <div class="quiz-card-buttons">
                    <button class="quiz-card-btn play" onclick="window.playQuiz('${quiz.id}')">🎮 Играть</button>
                    <button class="quiz-card-btn delete" onclick="window.deleteQuiz('${quiz.id}')">🗑 Удалить</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
}

window.playQuiz = async function(quizId) {
    if (!currentUser) {
        alert('Необходимо войти в аккаунт');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/quiz/${quizId}`);
        if (!response.ok) throw new Error();
        const quiz = await response.json();

        currentQuizId = quizId;
        currentQuestions = quiz.questions;

        const startRes = await fetch(`${API_URL}/start_quiz/${quizId}?user_id=${currentUser.id}`, {
            method: 'POST'
        });
        const startData = await startRes.json();
        currentAttemptId = startData.attempt_id;

        document.getElementById('quizTitleDisplay').textContent = quiz.title;
        switchToScreen('quizScreen');
        startQuiz();
    } catch (error) {
        alert('Ошибка при запуске викторины');
    }
};

window.deleteQuiz = async function(quizId) {
    if (!confirm('Вы уверены, что хотите удалить эту викторину?')) return;

    try {
        const response = await fetch(`${API_URL}/delete_quiz/${quizId}?user_id=${currentUser.id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            alert('Викторина удалена');
            loadMyQuizzes();
        } else {
            alert('Ошибка при удалении');
        }
    } catch (error) {
        alert('Ошибка при удалении');
    }
};

window.deleteAllQuizzes = async function() {
    if (!confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЕ ваши викторины! Вы уверены?')) return;
    if (!confirm('ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ! Удалить всё?')) return;

    try {
        const response = await fetch(`${API_URL}/delete_all_quizzes?user_id=${currentUser.id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            alert('Все ваши викторины удалены');
            loadMyQuizzes();
            refreshStats();
        } else {
            alert('Ошибка при удалении');
        }
    } catch (error) {
        alert('Ошибка при удалении');
    }
};

// ============================================
// ПАНЕЛЬ РАЗРАБОТЧИКА
// ============================================
async function refreshStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`);
        const stats = await response.json();
        document.getElementById('statsUsers').textContent = `👥 Пользователей: ${stats.total_users}`;
        document.getElementById('statsQuizzes').textContent = `📊 Викторин: ${stats.total_quizzes}`;
        document.getElementById('statsAttempts').textContent = `🎮 Попыток: ${stats.total_attempts}`;
    } catch (error) {
        console.error('Ошибка загрузки статистики');
    }
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