// script.js - ПОЛНАЯ ВЕРСИЯ ДЛЯ RENDER + SUPABASE
const API_URL = window.location.origin;  // Автоматически подставляет адрес сервера

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

// ============================================
// НАВИГАЦИЯ
// ============================================
function showMenuScreen() {
    document.getElementById('menuScreen').classList.remove('hidden');
    document.getElementById('createScreen').classList.add('hidden');
    document.getElementById('joinScreen').classList.add('hidden');
    document.getElementById('shareScreen').classList.add('hidden');
    document.getElementById('quizScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.add('hidden');
}

function showCreateScreen() {
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('createScreen').classList.remove('hidden');
}

function showJoinScreen() {
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('joinScreen').classList.remove('hidden');
    document.getElementById('quizCodeInput').value = '';
}

// ============================================
// ШАБЛОНЫ ВИКТОРИН (6 готовых тем)
// ============================================
const templates = {
    artist: {
        title: "🎨 Великие художники",
        icon: "🎨",
        questions: [
            {text: "Кто написал картину 'Мона Лиза'?", options: ["Ван Гог", "Леонардо да Винчи", "Пикассо", "Рембрандт"], correct: 1, time_limit: 20},
            {text: "Какой художник отрезал себе ухо?", options: ["Клод Моне", "Пабло Пикассо", "Винсент Ван Гог", "Сальвадор Дали"], correct: 2, time_limit: 15},
            {text: "Кто написал 'Звездную ночь'?", options: ["Да Винчи", "Ван Гог", "Микеланджело", "Мунк"], correct: 1, time_limit: 25},
            {text: "Какой художник написал 'Танцующие фигуры'?", options: ["Дега", "Матисс", "Пикассо", "Моне"], correct: 1, time_limit: 20}
        ]
    },
    examples: {
        title: "📝 Русский язык",
        icon: "📝",
        questions: [
            {text: "Какое слово-исключение?", options: ["Жираф", "Шило", "Цирк", "Парашют"], correct: 3, time_limit: 20},
            {text: "Какое слово с Ы после Ц?", options: ["Цирк", "Цитата", "Цыган", "Цифра"], correct: 2, time_limit: 15},
            {text: "Какое слово-исключение из правила 'после Ц пишется И'?", options: ["Циновка", "Цистерна", "Цыпленок", "Цифра"], correct: 2, time_limit: 25},
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

function loadTemplates() {
    const grid = document.getElementById('templatesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const templateList = [
        {id: 'artist', name: 'Художник', icon: '🎨'},
        {id: 'examples', name: 'Русский язык', icon: '📝'},
        {id: 'inequalities', name: 'Математика', icon: '📐'},
        {id: 'movies', name: 'Кино', icon: '🎬'},
        {id: 'music', name: 'Музыка', icon: '🎵'},
        {id: 'sports', name: 'Спорт', icon: '⚽'}
    ];
    
    templateList.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'template-btn';
        btn.innerHTML = `<span class="template-icon">${t.icon}</span><span>${t.name}</span>`;
        btn.onclick = () => useTemplate(t.id);
        grid.appendChild(btn);
    });
}

function useTemplate(templateName) {
    const template = templates[templateName];
    if (!template) return;
    
    document.getElementById('quizTitle').value = template.title;
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    questionCount = 1;
    
    template.questions.forEach((q, index) => {
        addQuestionWithData(index + 1, q.text, q.options, q.correct, q.time_limit || 30);
    });
    
    showCreateScreen();
}

// ============================================
// СОЗДАНИЕ ВИКТОРИНЫ
// ============================================
function addQuestion() {
    addQuestionWithData(questionCount, "", ["", "", "", ""], 0, 30);
    questionCount++;
}

function addQuestionWithData(num, text, options, correctAnswer, timeLimit) {
    const container = document.getElementById('questionsContainer');
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

async function createQuiz() {
    const title = document.getElementById('quizTitle').value;
    if (!title) {
        alert('Введите название викторины');
        return;
    }
    
    const editors = document.querySelectorAll('.question-editor');
    const questions = [];
    
    for (let editor of editors) {
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
        const response = await fetch(`${API_URL}/create_quiz`, {
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
        document.getElementById('shareCode').textContent = currentQuizId;
        document.getElementById('createScreen').classList.add('hidden');
        document.getElementById('shareScreen').classList.remove('hidden');
        
        // Показываем рекламу
        showFullscreenAd();
        
    } catch (error) {
        alert('Ошибка при создании викторины: ' + error.message);
    }
}

function copyCode() {
    const code = document.getElementById('shareCode').textContent;
    navigator.clipboard.writeText(code);
    alert('✅ Код скопирован! Поделись им с друзьями');
}

// ============================================
// РЕКЛАМА (полноэкранная, 5 секунд)
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
        timerElement.textContent = seconds;
        
        if (seconds <= 0) {
            clearInterval(interval);
            timerElement.textContent = "0";
            closeBtn.classList.remove('hidden');
            timerElement.style.opacity = "0.5";
        }
    }, 1000);
}

function closeFullscreenAd() {
    const overlay = document.querySelector('.fullscreen-ad-overlay');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
    }
}

// Реклама между вопросами (3 секунды)
function showMidQuizAd(onComplete) {
    document.body.style.overflow = 'hidden';
    
    if (timerInterval) clearInterval(timerInterval);
    
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
        timerElement.textContent = seconds;
        
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
async function joinQuiz() {
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
        
        const startResponse = await fetch(`${API_URL}/start_quiz/${currentQuizId}`, {
            method: 'POST'
        });
        const startData = await startResponse.json();
        currentAttemptId = startData.attempt_id;
        
        document.getElementById('quizTitleDisplay').textContent = quiz.title;
        showMenuScreen();
        document.getElementById('quizScreen').classList.remove('hidden');
        
        startQuiz();
    } catch (error) {
        alert('Викторина не найдена! Проверьте код');
    }
}

let answeredCount = 0;

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
    document.getElementById('questionText').textContent = question.text;
    document.getElementById('progressText').textContent = 
        `Вопрос ${currentQuestionIndex + 1} из ${currentQuestions.length}`;
    
    const container = document.getElementById('optionsContainer');
    container.innerHTML = '';
    
    const letters = ['A', 'B', 'C', 'D'];
    question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${letters[index]}. ${option}`;
        btn.onclick = () => submitAnswer(index);
        container.appendChild(btn);
    });
    
    const timeLimit = question.time_limit || 30;
    startTimer(timeLimit);
}

function startTimer(seconds) {
    if (timerInterval) clearInterval(timerInterval);
    
    timeLeft = seconds;
    const timerElement = document.getElementById('timer');
    timerElement.textContent = timeLeft;
    timerElement.classList.remove('timer-warning');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        
        if (timeLeft <= 5) {
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
        
        // Реклама после каждых 3 вопросов
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
        
        document.getElementById('quizScreen').classList.add('hidden');
        document.getElementById('resultScreen').classList.remove('hidden');
    } catch (error) {
        alert('Ошибка при завершении викторины');
    }
}

function shareToTikTok() {
    const score = document.getElementById('finalScore').textContent;
    const total = document.getElementById('totalQuestions').textContent;
    const text = `Я набрал ${score}${total} в TikTok викторине! Попробуй побить мой рекорд! 🎯`;
    
    navigator.clipboard.writeText(text);
    alert('✅ Текст скопирован! Вставь его в TikTok вместе со скриншотом результата');
}

// ============================================
// ПРОВЕРКА РАБОТЫ СЕРВЕРА
// ============================================
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        console.log('🟢 Сервер:', data);
    } catch (error) {
        console.log('🔴 Сервер недоступен, запускаем локально');
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
loadTemplates();
addQuestion();
checkServerHealth();