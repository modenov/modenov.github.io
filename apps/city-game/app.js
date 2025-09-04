(() => {
  'use strict';

  // ===== Utilities =====
  const normalize = (s) => (s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();

  const onlyRusLetters = (s) => /^[А-ЯЁа-яё][А-ЯЁа-яё\s\-]+$/.test(s);

  const lettersOnly = (s) => (s || '').toLowerCase().replace(/[^а-яё]/g, '').replace(/ё/g,'е');

  const lastSignificantLetter = (word) => {
    const s = lettersOnly(word);
    const skip = new Set(['ь','ъ','ы','й']);
    for (let i = s.length - 1; i >= 0; i--) {
      const ch = s[i];
      if (!skip.has(ch)) return ch === 'ё' ? 'е' : ch;
    }
    return ''; // fallback
  };

  const firstLetter = (word) => {
    const s = lettersOnly(word);
    return s[0] || '';
  };

  // ===== DOM =====
  const $ = (sel) => document.querySelector(sel);
  const scoreEl = $('#score');
  const highScoreEl = $('#highScore');
  const timerEl = $('#timer');
  const needLetterEl = $('#needLetter');
  const computerCityEl = $('#computerCity');
  const usedListEl = $('#usedList');
  const messageEl = $('#message');
  const input = $('#cityInput');
  const form = $('#form');
  const newGameBtn = $('#newGameBtn');
  const giveUpBtn = $('#giveUpBtn');

  // ===== State =====
  const DICT = (window.CITIES || []).slice(); // raw list for display
  const dictNorm = new Set(DICT.map(normalize));
  let used = new Set();
  let usedDisplay = [];
  let needLetter = '';
  let timer = null;
  let timeLeft = 60;
  let score = 0;
  let highScore = Number(localStorage.getItem('cityGameHighScore') || '0');
  highScoreEl.textContent = String(highScore);

  // Theme by local time: dark 21:00-07:00, light otherwise
  function applyThemeByLocalTime() {
    const hr = new Date().getHours();
    const theme = (hr >= 21 || hr < 7) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    // Update meta theme-color
    const metaTC = document.querySelector('meta[name="theme-color"]');
    if (metaTC) metaTC.setAttribute('content', theme === 'dark' ? '#0b0f14' : '#ffffff');
  }
  applyThemeByLocalTime();

  // dynamic year
  document.getElementById('year').textContent = new Date().getFullYear();

  // ===== Game Logic =====
  function resetUI() {
    score = 0;
    scoreEl.textContent = '0';
    timeLeft = 60;
    timerEl.textContent = '60';
    needLetterEl.textContent = '—';
    computerCityEl.textContent = '—';
    used = new Set();
    usedDisplay = [];
    usedListEl.innerHTML = '';
    messageEl.textContent = '';
    input.value = '';
    input.classList.remove('success','error');
    input.disabled = false;
  }

  function pushUsed(city) {
    used.add(normalize(city));
    usedDisplay.push(city);
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = city;
    usedListEl.appendChild(chip);
  }

  function startTimer() {
    stopTimer();
    timeLeft = 60;
    timerEl.textContent = String(timeLeft);
    timer = setInterval(() => {
      timeLeft--;
      timerEl.textContent = String(timeLeft);
      if (timeLeft <= 0) {
        stopTimer();
        endGame('Время вышло. Победа компьютера.');
      }
    }, 1000);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function endGame(reason) {
    stopTimer();
    input.disabled = true;
    messageEl.textContent = reason;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('cityGameHighScore', String(highScore));
      highScoreEl.textContent = String(highScore);
      // gentle notice
      setTimeout(() => {
        messageEl.textContent = reason + ' Новый рекорд: ' + highScore + '!';
      }, 200);
    }
  }

  function randomOf(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function computerTurn(reqLetter) {
    // pick a city that starts with reqLetter and is not used
    const candidates = [];
    for (const city of DICT) {
      const n = normalize(city);
      if (!used.has(n) && firstLetter(n) === reqLetter) {
        candidates.push(city);
      }
    }
    if (candidates.length === 0) {
      endGame('Компьютер не нашёл город. Вы победили!');
      return null;
    }
    const choice = randomOf(candidates);
    pushUsed(choice);
    computerCityEl.textContent = choice;
    needLetter = lastSignificantLetter(choice);
    needLetterEl.textContent = needLetter ? needLetter.toUpperCase() : '—';
    startTimer();
    return choice;
  }

  function firstComputerCity() {
    // computer starts randomly
    const first = randomOf(DICT.filter(c => !used.has(normalize(c))));
    pushUsed(first);
    computerCityEl.textContent = first;
    needLetter = lastSignificantLetter(first);
    needLetterEl.textContent = needLetter ? needLetter.toUpperCase() : '—';
    startTimer();
  }

  function startNewGame() {
    resetUI();
    firstComputerCity();
    input.focus();
  }

  // Validate user input
  function validateUserCity(raw) {
    const trimmed = raw.trim();
    if (!onlyRusLetters(trimmed)) {
      return { ok:false, reason:'Пишите город русскими буквами.' };
    }
    const norm = normalize(trimmed);
    if (!dictNorm.has(norm)) {
      return { ok:false, reason:'Такого города нет в базе или он написан неверно.' };
    }
    if (used.has(norm)) {
      return { ok:false, reason:'Этот город уже использован.' };
    }
    if (!needLetter) {
      return { ok:false, reason:'Системная ошибка: не задана буква.' };
    }
    if (firstLetter(norm) !== needLetter) {
      return { ok:false, reason:`Город должен начинаться на букву «${needLetter.toUpperCase()}».` };
    }
    return { ok:true, norm, display: DICT.find(c => normalize(c) === norm) || trimmed };
  }

  // Submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    const res = validateUserCity(value);
    if (!res.ok) {
      input.classList.remove('success');
      input.classList.add('error');
      messageEl.textContent = res.reason;
      setTimeout(() => input.classList.remove('error'), 600);
      return;
    }

    // success
    pushUsed(res.display);
    score += 1;
    scoreEl.textContent = String(score);
    input.classList.remove('error');
    input.classList.add('success');
    messageEl.textContent = 'Отлично!';
    setTimeout(() => input.classList.remove('success'), 600);
    input.value = '';

    // Next: computer turn from last letter of user's city
    stopTimer();
    const nextLetter = lastSignificantLetter(res.display);
    needLetter = nextLetter;
    needLetterEl.textContent = needLetter.toUpperCase();
    setTimeout(() => {
      const ans = computerTurn(nextLetter);
      if (!ans) return; // user already won
    }, 180);
  });

  newGameBtn.addEventListener('click', () => startNewGame());
  giveUpBtn.addEventListener('click', () => endGame('Вы сдались. Победа компьютера.'));

  // Kickoff
  startNewGame();
})();