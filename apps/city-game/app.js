(() => {
  'use strict';

  // ===== Utilities =====
  const normalize = (s) => (s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();

  const onlyRusLetters = (s) => /^[А-ЯЁа-яё][А-ЯЁа-яё\s\-()]+$/.test(s);

  const lettersOnly = (s) => (s || '').toLowerCase().replace(/[^а-яё]/g, '').replace(/ё/g,'е');

  const lastSignificantLetter = (word) => {
    const s = lettersOnly(word);
    const skip = new Set(['ь','ъ','ы','й']);
    for (let i = s.length - 1; i >= 0; i--) {
      const ch = s[i];
      if (!skip.has(ch)) return ch === 'ё' ? 'е' : ch;
    }
    return '';
  };

  const firstLetter = (word) => {
    const s = lettersOnly(word);
    return s[0] || '';
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  const DICT = (window.CITIES || []).slice();
  let used = new Set();
  let usedDisplay = [];
  let needLetter = '';
  let timer = null;
  let timeLeft = 60;
  let score = 0;
  let highScore = Number(localStorage.getItem('cityGameHighScore') || '0');
  highScoreEl.textContent = String(highScore);

  // Online cache (localStorage)
  const cacheKey = 'cityGameOnlineCacheV1';
  const cache = (() => {
    try { return JSON.parse(localStorage.getItem(cacheKey) || '{}'); } catch { return {}; }
  })();
  function saveCache() { try { localStorage.setItem(cacheKey, JSON.stringify(cache)); } catch {} }

  // Theme by local time: dark 21:00-07:00, light otherwise
  function applyThemeByLocalTime() {
    const hr = new Date().getHours();
    const theme = (hr >= 21 || hr < 7) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const metaTC = document.querySelector('meta[name="theme-color"]');
    if (metaTC) metaTC.setAttribute('content', theme === 'dark' ? '#0b0f14' : '#ffffff');
  }
  applyThemeByLocalTime();

  // dynamic year
  document.getElementById('year').textContent = new Date().getFullYear();

  // ===== Online validation (Wikidata primary, OSM fallback) =====

  // Allowed instance-of (P31) items on Wikidata
  const WD_ALLOWED = new Set([
    'Q515',      // city
    'Q3957',     // town
    'Q1549591',  // metropolis
    'Q532',      // village
    'Q15284',    // urban-type settlement
    'Q486972',   // human settlement (broad)
    'Q1093829',  // municipality of Russia
    'Q202435',   // rural locality
    'Q1637706',  // urban settlement of Russia
  ]);

  async function fetchJson(url, {timeout=7000} = {}) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {signal: ctrl.signal, headers: {'Accept': 'application/json'}});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(id);
    }
  }

  function normEq(a, b) { return normalize(a) === normalize(b); }

  function ruStrings(obj) {
    const out = [];
    if (!obj) return out;
    if (obj.labels && obj.labels.ru) out.push(obj.labels.ru.value);
    if (obj.aliases && obj.aliases.ru) out.push(...obj.aliases.ru.map(x => x.value));
    if (obj.labels && obj.labels.uk) out.push(obj.labels.uk.value);
    if (obj.aliases && obj.aliases.uk) out.push(...obj.aliases.uk.map(x => x.value));
    return out;
  }

  async function wikidataValidate(name) {
    const q = encodeURIComponent(name);
    // 1) Search entity by Russian label
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${q}&language=ru&uselang=ru&type=item&limit=6&origin=*`;
    const s = await fetchJson(searchUrl);
    if (!s || !s.search || !s.search.length) return null;

    // Prefer exact label/alias match in RU/UK
    const candidates = s.search.filter(it => {
      const all = [it.label, ...(it.aliases || [])];
      return all.some(str => normEq(str, name));
    });
    const pool = (candidates.length ? candidates : s.search).slice(0, 4);

    for (const it of pool) {
      // 2) Load entity data
      const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${it.id}.json`;
      const data = await fetchJson(entityUrl);
      const entity = data && data.entities && (data.entities[it.id] || data.entities[it.id.toUpperCase()]);
      if (!entity) continue;

      // Check P31 (instance of)
      const p31 = (entity.claims && entity.claims.P31) || [];
      const ok = p31.some(claim => {
        const v = claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value;
        const id = v && v.id;
        return id && WD_ALLOWED.has(id);
      });
      if (!ok) continue;

      // Finalize: return canonical Russian label if available
      const ru = ruStrings(entity).find(str => str && str.trim().length > 0);
      return { ok: true, display: ru || it.label || name };
    }
    return null;
  }

  async function nominatimValidate(name) {
    const q = encodeURIComponent(name);
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ru&q=${q}&limit=5`;
    try {
      const data = await fetchJson(url, {timeout: 7000});
      if (!Array.isArray(data) || !data.length) return null;
      // Accept place type city/town/village
      const okTypes = new Set(['city','town','village','municipality','borough','suburb']);
      for (const item of data) {
        const t = (item.type || '').toLowerCase();
        if (okTypes.has(t)) {
          // Prefer display_name first token
          const disp = (item.display_name || '').split(',')[0].trim();
          // Ensure name is close
          if (normalize(disp) === normalize(name) || normalize(item.name || '') === normalize(name)) {
            return { ok: true, display: disp };
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function validateOnline(name) {
    const n = normalize(name);
    if (cache[n]) return cache[n]; // {ok:boolean, display?:string}

    // Primary: Wikidata
    let res = await wikidataValidate(name);
    if (!res) {
      // Fallback: Nominatim
      res = await nominatimValidate(name);
    }
    cache[n] = res || { ok: false };
    saveCache();
    return cache[n];
  }

  // ===== Game UI =====
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
      setTimeout(() => {
        messageEl.textContent = reason + ' Новый рекорд: ' + highScore + '!';
      }, 200);
    }
  }

  function randomOf(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function computerTurn(reqLetter) {
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
    const pool = DICT.filter(c => !used.has(normalize(c)));
    const first = randomOf(pool.length ? pool : ['Москва','Париж','Лондон','Берлин']);
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

  // ===== Validation (async) =====
  async function validateUserCity(raw) {
    const trimmed = raw.trim();
    if (!onlyRusLetters(trimmed)) {
      return { ok:false, reason:'Пишите город русскими буквами.' };
    }
    const norm = normalize(trimmed);
    if (used.has(norm)) {
      return { ok:false, reason:'Этот город уже использован.' };
    }
    if (!needLetter) {
      return { ok:false, reason:'Системная ошибка: не задана буква.' };
    }
    if (firstLetter(norm) !== needLetter) {
      return { ok:false, reason:`Город должен начинаться на букву «${needLetter.toUpperCase()}».` };
    }

    // 1) Quick allow if present in local list (быстро, оффлайн)
    if (DICT.some(c => normalize(c) === norm)) {
      return { ok:true, norm, display: DICT.find(c => normalize(c) === norm) };
    }

    // 2) Online validation
    messageEl.textContent = 'Проверяем город по справочникам…';
    const online = await validateOnline(trimmed);
    if (online && online.ok) {
      // Add to local dict for this session
      DICT.push(online.display);
      return { ok:true, norm: normalize(online.display), display: online.display };
    }
    return { ok:false, reason:'Такого города не найдено в авторитетных справочниках.' };
  }

  // ===== Handlers =====
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value;
    input.disabled = true;
    try {
      const res = await validateUserCity(value);
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
        if (!ans) return;
      }, 180);
    } finally {
      input.disabled = false;
      input.focus();
    }
  });

  newGameBtn.addEventListener('click', () => startNewGame());
  giveUpBtn.addEventListener('click', () => endGame('Вы сдались. Победа компьютера.'));

  // Kickoff
  startNewGame();
})();