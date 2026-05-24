// script.js - ПОЛНАЯ ВЕРСИЯ

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let currentQuizId = null;
let currentAttemptId = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentScore = 0;
let timerInterval = null;
let timeLeft = 30;
let questionCount = 1;
let answeredCount = 0;

let currentUser = null;

const API_URL = '';

// ============================================
// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ЭКРАНОВ
// ============================================
function switchToScreen(screenId) {
    const screens = [
        'loginScreen', 'menuScreen', 'templatesScreen', 'createScreen', 'joinScreen',
        'shareScreen', 'quizScreen', 'resultScreen', 'myQuizzesScreen', 'devPanelScreen'
    ];

    screens.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.classList.add('hidden');
    });

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.remove('hidden');

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

window.showMenuScreen = function() { switchToScreen('menuScreen'); }
window.showTemplatesScreen = function() { switchToScreen('templatesScreen'); }
window.showCreateScreen = function() { switchToScreen('createScreen'); }
window.showJoinScreenFromMenu = function() {
    switchToScreen('joinScreen');
    const codeInput = document.getElementById('quizCodeInput');
    if (codeInput) codeInput.value = '';
}
window.showMyQuizzesScreen = async function() {
    switchToScreen('myQuizzesScreen');
    await loadMyQuizzes();
}
window.showDevPanel = function() {
    switchToScreen('devPanelScreen');
    isDevLoggedIn = false;
    const devLoginPanel = document.getElementById('devLoginPanel');
    const devPanelContent = document.getElementById('devPanelContent');
    const devPassword = document.getElementById('devPassword');

    if (devLoginPanel) devLoginPanel.classList.remove('hidden');
    if (devPanelContent) devPanelContent.classList.add('hidden');
    if (devPassword) devPassword.value = '';

    refreshStats();
}

// ============================================
// АВТОРИЗАЦИЯ
// ============================================
window.login = async function() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        alert('Введите имя пользователя и пароль');
        return;
    }

    try {
        const response = await fetch(`/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.detail || 'Ошибка входа');
            return;
        }

        const data = await response.json();
        currentUser = { id: data.user_id, username: data.username };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        const welcomeUser = document.getElementById('welcomeUser');
        if (welcomeUser) welcomeUser.textContent = `Добро пожаловать, ${data.username}!`;
        switchToScreen('menuScreen');

    } catch (error) {
        alert('Ошибка при входе: ' + error.message);
    }
}

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
        const response = await fetch(`/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.detail || 'Ошибка регистрации');
            return;
        }

        alert('Регистрация успешна! Теперь войдите в аккаунт.');
        switchAuthTab('login');
        document.getElementById('loginUsername').value = username;
        document.getElementById('loginPassword').value = '';

    } catch (error) {
        alert('Ошибка при регистрации: ' + error.message);
    }
}

window.logout = function() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    switchToScreen('loginScreen');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.auth-tab');

    if (tab === 'login') {
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (tabs[0]) tabs[0].classList.add('active');
        if (tabs[1]) tabs[1].classList.remove('active');
    } else {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (tabs[0]) tabs[0].classList.remove('active');
        if (tabs[1]) tabs[1].classList.add('active');
    }
}

function checkSavedSession() {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            const welcomeUser = document.getElementById('welcomeUser');
            if (welcomeUser) welcomeUser.textContent = `Добро пожаловать, ${currentUser.username}!`;
            switchToScreen('menuScreen');
        } catch(e) {
            switchToScreen('loginScreen');
        }
    } else {
        switchToScreen('loginScreen');
    }
}

window.switchAuthTab = switchAuthTab;

// ============================================
// ШАБЛОНЫ ВИКТОРИН
// ============================================
const templates = {
    artist: {
        title: "🎨 Великие художники",
        icon: "🎨",
        questions: [
            {text: "Кто написал картину 'Мона Лиза'?", options: ["Ван Гог", "Леонардо да Винчи", "Пикассо", "Рембрандт"], correct: 1, time_limit: 20},
            {text: "Какой художник отрезал себе ухо?", options: ["Клод Моне", "Пабло Пикассо", "Винсент Ван Гог", "Сальвадор Дали"], correct: 2, time_limit: 15},
            {text: "Кто написал 'Звездную ночь'?", options: ["Леонардо да Винчи", "Ван Гог", "Микеланджело", "Эдвард Мунк"], correct: 1, time_limit: 25},
            {text: "Какой художник известен своими 'Танцующими фигурами'?", options: ["Эдгар Дега", "Анри Матисс", "Пабло Пикассо", "Клод Моне"], correct: 1, time_limit: 30}
        ]
    },
    examples: {
        title: "📝 Русский язык",
        icon: "📝",
        questions: [
            {text: "Какое слово является исключением?", options: ["Жираф", "Шило", "Цирк", "Парашют"], correct: 3, time_limit: 20},
            {text: "Какое слово пишется с буквой 'Ы' после Ц?", options: ["Цирк", "Цитата", "Цыган", "Циферблат"], correct: 2, time_limit: 15},
            {text: "Какое слово является исключением из правила 'после Ц пишется И'?", options: ["Циновка", "Цистерна", "Цыпленок", "Цифра"], correct: 2, time_limit: 25},
            {text: "Как правильно пишется?", options: ["Розыгрыш", "Розыгрышь", "Розігриш", "Разіграш"], correct: 0, time_limit: 20}
        ]
    },
    inequalities: {
        title: "📐 Математика",
        icon: "📐",
        questions: [
            {text: "Какое неравенство верно?", options: ["5 > 10", "3 < 7", "8 = 6", "4 > 9"], correct: 1, time_limit: 15},
            {text: "Решите: 2x + 3 > 7, x > ?", options: ["1", "2", "3", "4"], correct: 1, time_limit: 30},
            {text: "Если x = 5, то какое неравенство верно?", options: ["x < 3", "x > 8", "x > 4", "x = 10"], correct: 2, time_limit: 20},
            {text: "Какое число удовлетворяет неравенству x ≤ 7?", options: ["8", "9", "7", "10"], correct: 2, time_limit: 15}
        ]
    },
    movies: {
        title: "🎬 Кино",
        icon: "🎬",
        questions: [
            {text: "Кто сыграл Джона Уика?", options: ["Том Круз", "Киану Ривз", "Брэд Питт", "Мэтт Деймон"], correct: 1, time_limit: 20},
            {text: "Какой фильм получил Оскар в 2020 году?", options: ["1917", "Джокер", "Паразиты", "Ирландец"], correct: 2, time_limit: 25},
            {text: "Кто режиссер фильма 'Интерстеллар'?", options: ["Квентин Тарантино", "Кристофер Нолан", "Джеймс Кэмерон", "Стивен Спилберг"], correct: 1, time_limit: 20},
            {text: "Какой актер играл Железного человека?", options: ["Крис Эванс", "Крис Хемсворт", "Роберт Дауни мл.", "Скарлетт Йоханссон"], correct: 2, time_limit: 15}
        ]
    },
    music: {
        title: "🎵 Музыка",
        icon: "🎵",
        questions: [
            {text: "Кто исполнил песню 'Billie Jean'?", options: ["Принс", "Майкл Джексон", "Стиви Уандер", "Лайонел Ричи"], correct: 1, time_limit: 20},
            {text: "Какая группа спела 'Bohemian Rhapsody'?", options: ["The Beatles", "Queen", "Rolling Stones", "Pink Floyd"], correct: 1, time_limit: 25},
            {text: "Кто такая Бейонсе?", options: ["Актриса", "Певица", "Спортсменка", "Политик"], correct: 1, time_limit: 15},
            {text: "Какой певец известен как 'Король поп-музыки'?", options: ["Элвис Пресли", "Майкл Джексон", "Фредди Меркьюри", "Принс"], correct: 1, time_limit: 20}
        ]
    },
    sports: {
        title: "⚽ Спорт",
        icon: "⚽",
        questions: [
            {text: "Кто выиграл ЧМ по футболу в 2018?", options: ["Бразилия", "Германия", "Франция", "Аргентина"], correct: 2, time_limit: 20},
            {text: "Сколько игроков в футбольной команде?", options: ["10", "11", "12", "9"], correct: 1, time_limit: 15},
            {text: "Кто самый титулованный теннисист?", options: ["Федерер", "Надаль", "Джокович", "Сампрас"], correct: 2, time_limit: 25},
            {text: "Какой вид спорта называют 'королевой спорта'?", options: ["Футбол", "Баскетбол", "Легкая атлетика", "Плавание"], correct: 2, time_limit: 20}
        ]
    }
};

function loadTemplatesGrid() {
    const grid = document.getElementById('templatesGridFull');
    if (!grid) return;

    grid.innerHTML = '';

    const templateList = [
        {id: 'artist', name: 'Великие художники', icon: '🎨', desc: 'Проверь знания о художниках'},
        {id: 'examples', name: 'Русский язык', icon: '📝', desc: 'Правила и исключения'},
        {id: 'inequalities', name: 'Математика', icon: '📐', desc: 'Неравенства и задачи'},
        {id: 'movies', name: 'Кино', icon: '🎬', desc: 'Фильмы и актеры'},
        {id: 'music', name: 'Музыка', icon: '🎵', desc: 'Хиты и исполнители'},
        {id: 'sports', name: 'Спорт', icon: '⚽', desc: 'Достижения и рекорды'}
    ];

    templateList.forEach(t => {
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

window.useTemplate = function(templateName) {
    const template = templates[templateName];
    if (!template) return;

    document.getElementById('quizTitle').value = template.title;
    const container = document.getElementById('questionsContainer');
    if (container) container.innerHTML = '';
    questionCount = 1;

    template.questions.forEach((q, index) => {
        addQuestionWithData(index + 1, q.text, q.options, q.correct, q.time_limit || 30);
    });

    showCreateScreen();
}

// ============================================
// СОЗДАНИЕ ВИКТОРИНЫ
// ============================================
window.addQuestion = function() {
    addQuestionWithData(questionCount, "", ["", "", "", ""], 0, 30);
    questionCount++;
}

function addQuestionWithData(num, text, options, correctAnswer, timeLimit) {
    const container = document.getElementById('questionsContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'question-editor';
    div.innerHTML = `
        <div class="question-header">Вопрос ${num}</div>
        <input type="text" class="input-field q-text" placeholder="Текст вопроса" value="${text.replace(/"/g, '&quot;')}">
        <div class="options-editor">
            <input type="text" class="input-field opt" placeholder="Вариант A" value="${options[0].replace(/"/g, '&quot;')}">
            <input type="text" class="input-field opt" placeholder="Вариант B" value="${options[1].replace(/"/g, '&quot;')}">
            <input type="text" class="input-field opt" placeholder="Вариант C" value="${options[2].replace(/"/g, '&quot;')}">
            <input type="text" class="input-field opt" placeholder="Вариант D" value="${options[3].replace(/"/g, '&quot;')}">
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
            <option value="0" ${correctAnswer === 0 ? 'selected' : ''}>Правильный ответ: A</option>
            <option value="1" ${correctAnswer === 1 ? 'selected' : ''}>Правильный ответ: B</option>
            <option value="2" ${correctAnswer === 2 ? 'selected' : ''}>Правильный ответ: C</option>
            <option value="3" ${correctAnswer === 3 ? 'selected' : ''}>Правильный ответ: D</option>
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

    const questionEditors = document.querySelectorAll('.question-editor');
    const questions = [];

    for (let editor of questionEditors) {
        const text = editor.querySelector('.q-text').value;
        const options = [
            editor.querySelectorAll('.opt')[0]?.value || '',
            editor.querySelectorAll('.opt')[1]?.value || '',
            editor.querySelectorAll('.opt')[2]?.value || '',
            editor.querySelectorAll('.opt')[3]?.value || ''
        ];
        const correct = parseInt(editor.querySelector('.correct-select').value);
        const time_limit = parseInt(editor.querySelector('.time-select')?.value || 30);

        if (!text || options.some(opt => !opt)) {
            alert('Заполните все поля вопросов');
            return;
        }
        questions.push({ text, options, correct, time_limit });
    }

    if (questions.length === 0) {
        alert('Добавьте хотя бы один вопрос');
        return;
    }

    try {
        const response = await fetch(`/create_quiz?user_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, questions })
        });

        if (!response.ok) {
            const error = await response.json();
            alert('Ошибка: ' + (error.detail || 'Неизвестная ошибка'));
            return;
        }

        const data = await response.json();
        currentQuizId = data.quiz_id;
        const shareCode = document.getElementById('shareCode');
        if (shareCode) shareCode.textContent = currentQuizId;
        const createScreen = document.getElementById('createScreen');
        const shareScreen = document.getElementById('shareScreen');
        if (createScreen) createScreen.classList.add('hidden');
        if (shareScreen) shareScreen.classList.remove('hidden');

        showFullscreenAd();

    } catch (error) {
        alert('Ошибка при создании викторины: ' + error.message);
    }
}

window.copyCode = function() {
    const code = document.getElementById('shareCode').textContent;
    navigator.clipboard.writeText(code);
    alert('Код скопирован! Поделись им с друзьями');
}

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
    const timerElement = overlay.querySelector('#adTimer');
    const closeBtn = overlay.querySelector('#adCloseBtn');

    const interval = setInterval(() => {
        seconds--;
        if (timerElement) timerElement.textContent = seconds;

        if (seconds <= 0) {
            clearInterval(interval);
            if (timerElement) timerElement.textContent = "0";
            if (closeBtn) closeBtn.classList.remove('hidden');
            if (timerElement) timerElement.style.opacity = "0.5";
        }
    }, 1000);
}

window.closeFullscreenAd = function() {
    const overlay = document.querySelector('.fullscreen-ad-overlay');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
    }
}

function showMidQuizAd(onComplete) {
    document.body.style.overflow = 'hidden';

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    const overlay = document.createElement('div');
    overlay.className = 'midquiz-ad-overlay';

    overlay.innerHTML = `
        <div class="midquiz-ad-container">
            <div class="midquiz-ad-content">
                <div class="midquiz-ad-icon">🧃</div>
                <div class="midquiz-ad-title">ПЕРЕРЫВ НА СОК!</div>
                <div class="midquiz-ad-product">🍍 FRESH JUICE 🥭</div>
                <div class="midquiz-ad-desc">Свежевыжатый сок<br><strong>Манго + Маракуйя</strong></div>
                <div class="midquiz-ad-offer">🔥 Тропический заряд энергии! 🔥</div>
                <div class="midquiz-ad-timer" id="midquizTimer">3</div>
                <div class="midquiz-ad-wait">Реклама закончится через...</div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    let seconds = 3;
    const timerElement = overlay.querySelector('#midquizTimer');

    const interval = setInterval(() => {
        seconds--;
        if (timerElement) timerElement.textContent = seconds;

        if (seconds <= 0) {
            clearInterval(interval);
            overlay.remove();
            document.body.style.overflow = '';
            if (onComplete) onComplete();
        }
    }, 1000);
}

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
        const response = await fetch(`/quiz/${code}`);
        if (!response.ok) throw new Error();
        const quiz = await response.json();

        currentQuizId = code;
        currentQuestions = quiz.questions;

        const startResponse = await fetch(`/start_quiz/${currentQuizId}?user_id=${currentUser.id}`, {
            method: 'POST'
        });
        const startData = await startResponse.json();
        currentAttemptId = startData.attempt_id;

        const quizTitleDisplay = document.getElementById('quizTitleDisplay');
        if (quizTitleDisplay) quizTitleDisplay.textContent = quiz.title;
        switchToScreen('quizScreen');

        startQuiz();
    } catch (error) {
        alert('Викторина не найдена! Проверьте код');
    }
}

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

    const question = currentQuestions[currentQuestionIndex];
    const questionText = document.getElementById('questionText');
    const progressText = document.getElementById('progressText');
    if (questionText) questionText.textContent = question.text;
    if (progressText) progressText.textContent = `Вопрос ${currentQuestionIndex + 1} из ${currentQuestions.length}`;

    const container = document.getElementById('optionsContainer');
    if (container) container.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${letters[index]}. ${option}`;
        btn.onclick = () => submitAnswer(index);
        if (container) container.appendChild(btn);
    });

    const questionTime = question.time_limit || 30;
    startTimer(questionTime);
}

function startTimer(seconds) {
    if (timerInterval) clearInterval(timerInterval);

    timeLeft = seconds;
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = timeLeft;
        timerElement.classList.remove('timer-warning');
    }

    timerInterval = setInterval(() => {
        timeLeft--;
        if (timerElement) timerElement.textContent = timeLeft;

        if (timeLeft <= 5 && timerElement) {
            timerElement.classList.add('timer-warning');
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
        const response = await fetch(`/answer/${currentAttemptId}`, {
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

        if (answeredCount % 3 === 0 && currentQuestionIndex < currentQuestions.length) {
            showMidQuizAd(() => {
                loadQuestion();
            });
        } else {
            loadQuestion();
        }
    } catch (error) {
        alert('Ошибка при отправке ответа');
    }
}

async function finishQuiz() {
    try {
        const response = await fetch(`/finish_quiz/${currentAttemptId}`, {
            method: 'POST'
        });
        const result = await response.json();

        const finalScore = document.getElementById('finalScore');
        const totalQuestions = document.getElementById('totalQuestions');
        if (finalScore) finalScore.textContent = result.score;
        if (totalQuestions) totalQuestions.textContent = `/${result.total}`;

        const percentage = result.percentage;
        let message = '';
        if (percentage === 100) message = '🎉 Идеально! Ты гений! 🎉';
        else if (percentage >= 80) message = '🌟 Отлично! Ты крут! 🌟';
        else if (percentage >= 60) message = '👍 Хороший результат! 👍';
        else if (percentage >= 40) message = '😊 Неплохо, но можно лучше! 😊';
        else message = '💪 В следующий раз получится лучше! 💪';

        const resultMessage = document.getElementById('resultMessage');
        if (resultMessage) resultMessage.textContent = message;
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
}

// ============================================
// МОИ ВИКТОРИНЫ
// ============================================
async function loadMyQuizzes() {
    if (!currentUser) {
        switchToScreen('loginScreen');
        return;
    }

    const container = document.getElementById('quizzesList');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const response = await fetch(`/my_quizzes?user_id=${currentUser.id}`);

        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }

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
                    <button class="quiz-card-btn edit" onclick="window.editQuiz('${quiz.id}')">✏️ Изменить</button>
                    <button class="quiz-card-btn delete" onclick="window.deleteQuiz('${quiz.id}')">🗑 Удалить</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.playQuiz = async function(quizId) {
    if (!currentUser) {
        alert('Необходимо войти в аккаунт');
        return;
    }

    try {
        const response = await fetch(`/quiz/${quizId}`);
        if (!response.ok) throw new Error();
        const quiz = await response.json();

        currentQuizId = quizId;
        currentQuestions = quiz.questions;

        const startResponse = await fetch(`/start_quiz/${currentQuizId}?user_id=${currentUser.id}`, {
            method: 'POST'
        });
        const startData = await startResponse.json();
        currentAttemptId = startData.attempt_id;

        const quizTitleDisplay = document.getElementById('quizTitleDisplay');
        if (quizTitleDisplay) quizTitleDisplay.textContent = quiz.title;
        switchToScreen('quizScreen');

        startQuiz();
    } catch (error) {
        alert('Ошибка при запуске викторины');
    }
}

window.editQuiz = async function(quizId) {
    alert(`Редактирование викторины ${quizId} пока в разработке.\nСоздайте новую викторину с изменениями.`);
}

window.deleteQuiz = async function(quizId) {
    if (!currentUser) return;

    if (confirm('Вы уверены, что хотите удалить эту викторину? Это действие необратимо.')) {
        try {
            const response = await fetch(`/delete_quiz/${quizId}?user_id=${currentUser.id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                alert('Викторина удалена');
                await loadMyQuizzes();
            } else {
                alert('Ошибка при удалении');
            }
        } catch (error) {
            alert('Ошибка при удалении');
        }
    }
}

// ============================================
// ПАНЕЛЬ РАЗРАБОТЧИКА
// ============================================
let isDevLoggedIn = false;

window.devLogin = async function() {
    const password = document.getElementById('devPassword').value;

    if (!password) {
        alert('Введите пароль');
        return;
    }

    try {
        const response = await fetch('/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            isDevLoggedIn = true;
            document.getElementById('devLoginPanel').classList.add('hidden');
            document.getElementById('devPanelContent').classList.remove('hidden');
            alert('✅ Добро пожаловать в панель разработчика!');
            await refreshStats();
            await devLoadAllUsers();
        } else {
            alert('❌ Неверный пароль!');
        }
    } catch (error) {
        alert('Ошибка при входе');
    }
}

window.devLoadAllUsers = async function() {
    if (!isDevLoggedIn) return;

    const container = document.getElementById('devUsersList');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const password = document.getElementById('devPassword').value;
        const response = await fetch(`/dev/all_users?password=${encodeURIComponent(password)}`);

        if (!response.ok) throw new Error();

        const users = await response.json();

        if (users.length === 0) {
            container.innerHTML = '<div class="empty">Нет пользователей</div>';
            return;
        }

        container.innerHTML = '';
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-item';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <div>
                    <span class="user-name">${escapeHtml(user.username)}</span><br>
                    <span class="user-id" style="font-size:10px;">ID: ${user.id}</span><br>
                    <span style="font-size:10px;">📅 ${new Date(user.created_at).toLocaleDateString()}</span>
                </div>
                <button class="btn-small" style="background:#dc3545; color:white; padding:5px 10px; border:none; border-radius:5px; cursor:pointer;" onclick="window.devDeleteUserById('${user.id}')">
                    🗑 Удалить
                </button>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
}

window.devDeleteUser = async function() {
    if (!isDevLoggedIn) return;

    const userId = document.getElementById('deleteUserId').value;
    if (!userId) {
        alert('Введите ID пользователя');
        return;
    }
    await devDeleteUserById(userId);
}

window.devDeleteUserById = async function(userId) {
    if (!isDevLoggedIn) return;

    if (confirm(`⚠️ Удалить пользователя ${userId}?\nВсе его викторины и попытки будут также удалены!`)) {
        try {
            const password = document.getElementById('devPassword').value;
            const response = await fetch(`/dev/delete_user/${userId}?password=${encodeURIComponent(password)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('✅ Пользователь удален');
                document.getElementById('deleteUserId').value = '';
                await refreshStats();
                await devLoadAllUsers();
            } else {
                const error = await response.json();
                alert('Ошибка: ' + (error.detail || 'Пользователь не найден'));
            }
        } catch (error) {
            alert('Ошибка при удалении');
        }
    }
}

window.refreshStats = async function() {
    try {
        const response = await fetch(`/admin/stats`);
        const stats = await response.json();

        const statsUsers = document.getElementById('statsUsers');
        const statsQuizzes = document.getElementById('statsQuizzes');
        const statsAttempts = document.getElementById('statsAttempts');
        const statsAvgScore = document.getElementById('statsAvgScore');

        if (statsUsers) statsUsers.textContent = `👥 Пользователей: ${stats.total_users}`;
        if (statsQuizzes) statsQuizzes.textContent = `📊 Викторин: ${stats.total_quizzes}`;
        if (statsAttempts) statsAttempts.textContent = `🎮 Попыток: ${stats.total_attempts}`;
        if (statsAvgScore) statsAvgScore.textContent = `⭐ Средний балл: ${stats.average_score}`;
    } catch (error) {
        console.error('Ошибка загрузки статистики');
    }
}

window.deleteMyAttempts = async function() {
    if (!currentUser) return;

    if (confirm('Удалить ВСЕ ваши попытки прохождения викторин? Это действие необратимо.')) {
        try {
            const response = await fetch(`/delete_all_attempts?user_id=${currentUser.id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                alert('✅ Все ваши попытки удалены');
                await refreshStats();
            } else {
                alert('Ошибка при удалении');
            }
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }
}

window.deleteMyQuizzesOnly = async function() {
    if (!currentUser) return;

    if (confirm('Удалить ВСЕ ваши викторины? Попытки других пользователей также будут удалены.')) {
        try {
            const response = await fetch(`/delete_all_quizzes?user_id=${currentUser.id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                alert('✅ Все ваши викторины удалены');
                await refreshStats();
                if (!document.getElementById('myQuizzesScreen').classList.contains('hidden')) {
                    await loadMyQuizzes();
                }
            } else {
                alert('Ошибка при удалении');
            }
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }
}

window.deleteMyAccount = async function() {
    if (!currentUser) return;

    const confirmed = confirm('⚠️ ВНИМАНИЕ! Это удалит ВАШ АККАУНТ и ВСЕ ваши данные!\n\nВикторины, попытки - всё будет потеряно.\n\nВы уверены?');

    if (confirmed) {
        const password = prompt('Введите ваш пароль для подтверждения:');
        if (!password) return;

        try {
            const loginResponse = await fetch(`/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username, password })
            });

            if (!loginResponse.ok) {
                alert('Неверный пароль! Операция отменена.');
                return;
            }

            const response = await fetch(`/delete_account?user_id=${currentUser.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('✅ Ваш аккаунт и все данные удалены');
                localStorage.removeItem('currentUser');
                currentUser = null;
                switchToScreen('loginScreen');
            } else {
                alert('Ошибка при удалении аккаунта');
            }
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }
}

window.resetAllData = async function() {
    if (!isDevLoggedIn) {
        alert('Доступ запрещен. Войдите в панель разработчика.');
        return;
    }

    const confirmed = confirm('💣 ПОЛНЫЙ СБРОС БАЗЫ ДАННЫХ!\n\nЭто удалит ВСЕХ пользователей, ВСЕ викторины и ВСЕ попытки.\n\nДействие НЕОБРАТИМО!\n\nВы уверены?');

    if (confirmed) {
        const doubleConfirm = prompt('Для подтверждения введите "СБРОСИТЬ ВСЁ" (заглавными буквами):');

        if (doubleConfirm === 'СБРОСИТЬ ВСЁ') {
            try {
                const response = await fetch(`/reset_everything`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    alert('✅ БАЗА ДАННЫХ ПОЛНОСТЬЮ ОЧИЩЕНА!\n\nВсе пользователи, викторины и попытки удалены.');

                    localStorage.removeItem('currentUser');
                    currentUser = null;
                    switchToScreen('loginScreen');
                } else {
                    alert('Ошибка при сбросе базы данных');
                }
            } catch (error) {
                alert('Ошибка: ' + error.message);
            }
        } else {
            alert('❌ Операция отменена. Введён неправильный код подтверждения.');
        }
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
loadTemplatesGrid();
addQuestionWithData(1, "", ["", "", "", ""], 0, 30);
checkSavedSession();