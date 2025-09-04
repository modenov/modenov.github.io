/*
  Математический тренажёр Владимира Моденова
  Простой vanilla JS, без сторонних библиотек. Код подробно прокомментирован.
*/

(function () {
  // ====== УТИЛИТЫ ============================================================
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

  const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
  const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);

  const simplifyFraction = (n, d) => {
    const g = gcd(n, d);
    return [n / g, d / g];
  };
  const fracStr = (n, d) => `${n}/${d}`;

  // Быстрая проверка "равенства" ответов: строки сравниваем как есть, числа — строго
  const isEqual = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    return String(a) === String(b);
  };

  // ====== DOM-ЭЛЕМЕНТЫ =======================================================
  const els = {
    question: document.getElementById('question'),
    options: document.getElementById('options'),
    feedback: document.getElementById('feedback'),
    explanation: document.getElementById('explanation'),
    newTaskBtn: document.getElementById('newTaskBtn'),
    score: document.getElementById('score'),
    attempts: document.getElementById('attempts'),
    difficulty: document.getElementById('difficulty'),
    hintBar: document.getElementById('hintBar'),
    hintBtn: document.getElementById('hintBtn'),
    timer: document.getElementById('timer'),
    hintCountdown: document.getElementById('hintCountdown'),
    year: document.getElementById('year'),
  };

  // Динамический год в футере
  els.year.textContent = new Date().getFullYear();

  // ====== ТЁМНАЯ ТЕМА (авто) ================================================
  // Приближённо: тёмная тема активна ночью (21:00–06:00) + уважаем системный prefers-color-scheme
  const hour = new Date().getHours();
  const isNightByTime = (hour >= 21 || hour <= 6);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isNightByTime || prefersDark) {
    document.body.classList.add('dark');
  }

  // ====== СОСТОЯНИЕ И ТАЙМЕР ПОДСКАЗКИ ======================================
  let state = {
    score: 0,
    attempts: 0,
    currentTask: null,
    locked: false,
    hintTimeoutId: null,
    hintSeconds: 35, // через сколько предлагать подсказку
    hintTickerId: null,
    hintLeft: 0,
  };

  function resetHintTimer() {
    clearTimeout(state.hintTimeoutId);
    clearInterval(state.hintTickerId);
    els.hintBar.classList.add('hidden');
    els.hintCountdown.textContent = '—';
  }

  function startHintTimer() {
    resetHintTimer();
    state.hintLeft = state.hintSeconds;
    els.hintCountdown.textContent = state.hintLeft + ' c';
    state.hintTickerId = setInterval(() => {
      state.hintLeft -= 1;
      if (state.hintLeft >= 0) els.hintCountdown.textContent = state.hintLeft + ' c';
    }, 1000);
    state.hintTimeoutId = setTimeout(() => {
      els.hintBar.classList.remove('hidden');
      clearInterval(state.hintTickerId);
    }, state.hintSeconds * 1000);
  }

  // ====== ГЕНЕРАТОРЫ ЗАДАЧ ===================================================
  // Каждый генератор возвращает: { question, choices, correct, explanation }
  // Варианты ответов — массив (числа или строки), correct — сам правильный ответ (значение).

  // --- ЛЁГКИЙ УРОВЕНЬ ---
  function genAddEasy() {
    const a = randInt(2, 60), b = randInt(2, 40);
    const ans = a + b;
    const choices = shuffle([ans, ans + randInt(1, 5), ans - randInt(1, 5), ans + randInt(6, 12)]);
    return {
      question: `Вычислите: ${a} + ${b}`,
      choices, correct: ans,
      explanation: `Складываем числа: ${a} + ${b} = <b>${ans}</b>.`,
    };
  }

  function genSubEasy() {
    let a = randInt(20, 99), b = randInt(2, 60);
    if (b > a) [a, b] = [b, a]; // избегаем отрицательного результата
    const ans = a - b;
    const choices = shuffle([ans, ans + randInt(1, 4), ans - randInt(1, 4), ans + randInt(5, 9)]);
    return {
      question: `Вычислите: ${a} − ${b}`,
      choices, correct: ans,
      explanation: `Вычитаем: ${a} − ${b} = <b>${ans}</b>.`,
    };
  }

  function genMulEasy() {
    const a = randInt(2, 9), b = randInt(2, 9);
    const ans = a * b;
    const choices = shuffle([ans, ans + randInt(1, 3), ans - randInt(1, 3), (a + 1) * b]);
    return {
      question: `Найдите произведение: ${a} × ${b}`,
      choices, correct: ans,
      explanation: `${a} × ${b} = <b>${ans}</b>.`,
    };
  }

  function genMissingAddend() {
    const x = randInt(2, 30), a = randInt(5, 40);
    const b = x + a;
    const ans = x;
    const choices = shuffle([ans, x + randInt(1, 4), x - randInt(1, 3), a]);
    return {
      question: `Найдите x: x + ${a} = ${b}`,
      choices, correct: ans,
      explanation: `Переносим ${a}: x = ${b} − ${a} = <b>${ans}</b>.`,
    };
  }

  // --- СРЕДНИЙ УРОВЕНЬ ---
  function genMulMedium() {
    const a = randInt(12, 29), b = randInt(3, 9);
    const ans = a * b;
    const choices = shuffle([ans, ans + randInt(3, 15), ans - randInt(3, 15), (a - 1) * b]);
    return {
      question: `Вычислите: ${a} × ${b}`,
      choices, correct: ans,
      explanation: `${a} × ${b} = <b>${ans}</b>.`,
    };
  }

  function genDivMedium() {
    // Целочисленное деление
    const b = randInt(3, 12);
    const ans = randInt(2, 15);
    const a = b * ans;
    const choices = shuffle([ans, ans + randInt(1, 4), ans - randInt(1, 3), b]);
    return {
      question: `Найдите частное: ${a} ÷ ${b}`,
      choices, correct: ans,
      explanation: `${a} ÷ ${b} = <b>${ans}</b>, т.к. ${b} × ${ans} = ${a}.`,
    };
  }

  function genLinearEq() {
    const a = randInt(2, 9);
    const x = randInt(2, 15);
    const b = randInt(1, 20);
    const c = a * x + b;
    const ans = x;
    const choices = shuffle([ans, x + randInt(1, 3), x - randInt(1, 3), c]);
    return {
      question: `Решите уравнение: ${a}x + ${b} = ${c}`,
      choices, correct: ans,
      explanation: `Вычитаем ${b}: ${a}x = ${c} − ${b} = ${a * x}. Делим на ${a}: x = <b>${ans}</b>.`,
    };
  }

  function genPercent() {
    const perc = [10, 20, 25, 50][randInt(0, 3)];
    const base = perc === 25 ? randInt(80, 360) - (randInt(0, 3) * 4) : randInt(80, 300);
    // делаем базу кратной 4 для 25%
    const goodBase = perc === 25 ? base - (base % 4) : base;
    const ans = Math.round(goodBase * (perc / 100));
    const choices = shuffle([ans, ans + randInt(3, 20), ans - randInt(3, 20), Math.round(goodBase * ((perc + 5) / 100))]);
    return {
      question: `Сколько будет ${perc}% от ${goodBase}?`,
      choices, correct: ans,
      explanation: `${perc}% = ${perc}/100. ${goodBase} × ${perc}/100 = <b>${ans}</b>.`,
    };
  }

  function genFracSimplify() {
    let d = randInt(6, 24);
    let n = randInt(2, d - 1);
    // гарантируем, что дробь несократима? нам наоборот нужна сокращаемая
    const k = randInt(2, 5);
    n *= k; d *= k;
    const [sn, sd] = simplifyFraction(n, d);
    const correct = fracStr(sn, sd);
    const wrong1 = fracStr(sn, sd + randInt(1, 3));
    const wrong2 = fracStr(sn + randInt(1, 2), sd);
    const wrong3 = fracStr(n, d); // исходная (несокращённая)
    const choices = shuffle([correct, wrong1, wrong2, wrong3]);
    return {
      question: `Упростите дробь: ${n}/${d}`,
      choices, correct: correct,
      explanation: `НОД(${n}, ${d}) = ${gcd(n, d)}. Делим числитель и знаменатель на НОД: получаем <b>${correct}</b>.`,
    };
  }

  function genPerimeterRect() {
    const a = randInt(3, 20), b = randInt(3, 20);
    const ans = 2 * (a + b);
    const choices = shuffle([ans, a * b, 2 * a + b, 2 * b + a]);
    return {
      question: `Периметр прямоугольника со сторонами ${a} см и ${b} см равен…`,
      choices, correct: ans,
      explanation: `Периметр P = 2(a + b) = 2(${a} + ${b}) = <b>${ans}</b> см.`,
    };
  }

  function genFracAddSameDen() {
    const d = randInt(5, 12);
    const n1 = randInt(1, d - 1);
    const n2 = randInt(1, d - 1);
    const sumN = n1 + n2;
    const [sn, sd] = simplifyFraction(sumN, d);
    const correct = fracStr(sn, sd);
    const choices = shuffle([
      correct,
      fracStr(sumN, d + 1),
      fracStr(sumN - 1, d),
      fracStr(n1 + n2 + 1, d)
    ]);
    return {
      question: `Сложите дроби: ${n1}/${d} + ${n2}/${d}`,
      choices, correct: correct,
      explanation: `Одинаковые знаменатели: складываем числители: ${n1}+${n2}=${sumN}. Получаем ${sumN}/${d} = <b>${correct}</b> (в простом виде).`,
    };
  }

  // --- СЛОЖНЫЙ УРОВЕНЬ ---
  function genTwoStepEq() {
    const a = randInt(2, 9), c = randInt(2, 9);
    const x = randInt(1, 12);
    const sign = Math.random() < 0.5 ? '+' : '−';
    const b = randInt(1, 12);
    // (a*x ± b)/c = d => d = (a*x ± b)/c, подберём целый d
    const d = Math.floor((a * x + (sign === '+' ? b : -b)) / c);
    const rhs = d;
    // Обновим так, чтобы равенство выполнялось точно (целое)
    const left = a * x + (sign === '+' ? b : -b);
    const fixedLeft = c * rhs;
    // Корректируем b, чтобы было строгое равенство
    const adjust = fixedLeft - (a * x + (sign === '+' ? b : -b));
    const bFixed = sign === '+' ? b + adjust : b - adjust;

    const ans = x;
    const choices = shuffle([ans, x + randInt(1, 3), x - randInt(1, 3), rhs]);
    const expr = `(${a}x ${sign} ${bFixed}) ÷ ${c} = ${rhs}`;
    const step1 = `${a}x ${sign} ${bFixed} = ${rhs} × ${c} = ${rhs * c}`;
    const step2 = sign === '+'
      ? `${a}x = ${rhs * c} − ${bFixed} = ${a * x}`
      : `${a}x = ${rhs * c} + ${bFixed} = ${a * x}`;
    return {
      question: `Решите уравнение: ${expr}`,
      choices, correct: ans,
      explanation: `${step1}. ${step2}. Делим на ${a}: x = <b>${ans}</b>.`,
    };
  }

  function genLCM() {
    const a = randInt(4, 12), b = randInt(4, 12);
    const ans = lcm(a, b);
    const choices = shuffle([ans, gcd(a, b), a * b, ans + randInt(2, 6)]);
    return {
      question: `Найдите НОК(${a}, ${b})`,
      choices, correct: ans,
      explanation: `НОК(a,b) = |ab| / НОД(a,b) = ${a*b} / ${gcd(a,b)} = <b>${ans}</b>.`,
    };
  }

  function genGCD() {
    const a = randInt(12, 60), b = randInt(12, 60);
    const ans = gcd(a, b);
    const choices = shuffle([ans, lcm(a, b), Math.min(a, b), ans + randInt(2, 6)]);
    return {
      question: `Найдите НОД(${a}, ${b})`,
      choices, correct: ans,
      explanation: `НОД — наибольший общий делитель. НОД(${a}, ${b}) = <b>${ans}</b>.`,
    };
  }

  function genSquaresRoots() {
    const pool = [
      { q: '√144', a: 12 },
      { q: '√169', a: 13 },
      { q: '√196', a: 14 },
      { q: '7²', a: 49 },
      { q: '9²', a: 81 },
      { q: '12²', a: 144 },
      { q: '√225', a: 15 },
      { q: '8²', a: 64 },
    ];
    const pick = pool[randInt(0, pool.length - 1)];
    const ans = pick.a;
    const choices = shuffle([ans, ans + randInt(2, 12), ans - randInt(2, 10), ans + randInt(13, 25)]);
    return {
      question: `Вычислите: ${pick.q}`,
      choices, correct: ans,
      explanation: `Ответ: <b>${ans}</b>.`,
    };
  }

  function genAverage() {
    const a = randInt(10, 80), b = randInt(10, 80), c = randInt(10, 80);
    const sum = a + b + c;
    const ans = Math.round(sum / 3);
    // делаем аккуратно, чтобы были похожие дистракторы
    const choices = shuffle([ans, ans + randInt(1, 4), ans - randInt(1, 4), Math.floor(sum / 3)]);
    return {
      question: `Найдите среднее арифметическое чисел ${a}, ${b} и ${c} (округлите до целого, если нужно)`,
      choices, correct: ans,
      explanation: `Среднее = ( ${a} + ${b} + ${c} ) / 3 = ${sum} / 3 ≈ <b>${ans}</b>.`,
    };
  }

  function genChainExpr() {
    const a = randInt(10, 20), b = randInt(5, 15), c = randInt(5, 15);
    const ans = 2 * (a + b) - c;
    const choices = shuffle([ans, 2 * a + b - c, 2 * (a + b + c), 2 * (a - b) - c]);
    return {
      question: `Вычислите: 2 × (${a} + ${b}) − ${c}`,
      choices, correct: ans,
      explanation: `Сначала скобки: ${a}+${b}=${a+b}. Умножаем на 2: ${2*(a+b)}. Вычитаем ${c}: получаем <b>${ans}</b>.`,
    };
  }

  // Пулы генераторов по сложности
  const POOLS = {
    easy:   [genAddEasy, genSubEasy, genMulEasy, genMissingAddend],
    medium: [genMulMedium, genDivMedium, genLinearEq, genPercent, genFracSimplify, genPerimeterRect, genFracAddSameDen],
    hard:   [genTwoStepEq, genLCM, genGCD, genSquaresRoots, genAverage, genChainExpr],
  };

  // ====== ОТРИСОВКА ВОПРОСА ==================================================
  function renderTask(task) {
    els.question.innerHTML = task.question;
    els.options.innerHTML = '';
    els.feedback.textContent = '';
    els.feedback.className = 'feedback';
    els.explanation.innerHTML = '';
    els.hintBar.classList.add('hidden');

    // Рисуем 4 кнопки-варианта
    task.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn option';
      btn.type = 'button';
      btn.setAttribute('data-value', String(choice));
      btn.textContent = String(choice);
      btn.addEventListener('click', () => onAnswer(choice, btn));
      els.options.appendChild(btn);
    });

    // Запускаем таймер подсказки
    startHintTimer();
  }

  // ====== НОВАЯ ЗАДАЧА =======================================================
  function newTask() {
    if (state.locked) { /* если предыдущая ещё не завершена — просто генерим заново */ }
    state.locked = false;
    resetHintTimer();

    const pool = POOLS[els.difficulty.value];
    const gen = pool[randInt(0, pool.length - 1)];
    const task = gen();

    // Перестраховка: на случай если вдруг choices не уникальны
    task.choices = Array.from(new Set(task.choices.map(String))).map(v => (isNaN(Number(v)) ? v : Number(v)));
    // Если свели варианты к <4 (маловероятно), достроим рядомстоящими числами
    while (task.choices.length < 4) {
      const delta = randInt(1, 5);
      const candidate = typeof task.correct === 'number' ? (task.correct + delta) : String(task.correct) + "'";
      if (!task.choices.some(ch => isEqual(ch, candidate))) task.choices.push(candidate);
    }
    shuffle(task.choices);

    state.currentTask = task;
    renderTask(task);
  }

  // ====== ОБРАБОТКА ОТВЕТА ===================================================
  function onAnswer(choice, btnEl) {
    if (state.locked || !state.currentTask) return;
    state.locked = true;
    resetHintTimer();

    const correct = state.currentTask.correct;
    const optionButtons = Array.from(els.options.querySelectorAll('.btn.option'));

    // Подсветка
    optionButtons.forEach(btn => {
      const val = btn.getAttribute('data-value');
      const normalized = isNaN(Number(val)) ? val : Number(val);
      if (isEqual(normalized, correct)) {
        btn.classList.add('correct');
      }
    });

    const isCorrect = isEqual(choice, correct);
    if (!isCorrect) {
      btnEl.classList.add('wrong');
    }

    // Статистика
    state.attempts += 1;
    if (isCorrect) state.score += 1;

    els.score.textContent = state.score;
    els.attempts.textContent = state.attempts;

    // Текстовая обратная связь
    els.feedback.textContent = isCorrect ? 'Отлично! Правильно.' : 'Увы, неверно.';
    els.feedback.classList.add(isCorrect ? 'ok' : 'bad');

    // Пояснение решения
    els.explanation.innerHTML = `
      Правильный ответ: <b>${correct}</b><br/>
      Разбор: ${state.currentTask.explanation}
    `;
  }

  // ====== ПОДСКАЗКА: УБРАТЬ 2 НЕВЕРНЫХ ======================================
  function applyHintRemoveTwo() {
    if (!state.currentTask) return;
    const correct = state.currentTask.correct;
    const optionButtons = Array.from(els.options.querySelectorAll('.btn.option'));

    // Находим неверные варианты и скрываем два случайных
    const wrongButtons = optionButtons.filter(btn => {
      const val = btn.getAttribute('data-value');
      const normalized = isNaN(Number(val)) ? val : Number(val);
      return !isEqual(normalized, correct);
    });
    shuffle(wrongButtons);
    wrongButtons.slice(0, 2).forEach(btn => btn.classList.add('hidden'));

    els.hintBar.classList.add('hidden');
  }

  // ====== СВЯЗЫВАЕМ СОБЫТИЯ ==================================================
  els.newTaskBtn.addEventListener('click', newTask);
  els.difficulty.addEventListener('change', newTask);
  els.hintBtn.addEventListener('click', applyHintRemoveTwo);

  // Первичная задача при загрузке
  newTask();
})();
