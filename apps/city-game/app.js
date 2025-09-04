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
  const controls = document.querySelector('.controls');

  // ===== Inject UI: online toggle + status =====
  const statusEl = document.createElement('span');
  statusEl.id = 'onlineStatus';
  statusEl.style.minHeight = '24px';
  statusEl.style.alignSelf = 'center';
  statusEl.style.fontSize = '14px';
  statusEl.style.color = 'var(--muted)';
  statusEl.style.marginLeft = '8px';

  const toggleWrap = document.createElement('label');
  toggleWrap.style.display = 'inline-flex';
  toggleWrap.style.alignItems = 'center';
  toggleWrap.style.gap = '8px';
  toggleWrap.style.padding = '10px 12px';
  toggleWrap.style.border = '1px solid var(--border)';
  toggleWrap.style.borderRadius = '12px';
  toggleWrap.style.background = 'var(--bg)';
  toggleWrap.style.boxShadow = 'var(--shadow)';
  toggleWrap.style.userSelect = 'none';

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = (localStorage.getItem('cityGameOnlineEnabled') ?? '1') !== '0';
  toggle.addEventListener('change', () => {
    localStorage.setItem('cityGameOnlineEnabled', toggle.checked ? '1' : '0');
    statusEl.textContent = toggle.checked ? 'Онлайн-валидация включена' : 'Онлайн-валидация выключена';
    setTimeout(() => { statusEl.textContent = ''; }, 1200);
  });

  const toggleText = document.createElement('span');
  toggleText.textContent = 'Онлайн-валидация';

  toggleWrap.appendChild(toggle);
  toggleWrap.appendChild(toggleText);

  if (controls) {
    controls.appendChild(toggleWrap);
    controls.appendChild(statusEl);
  }

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
  const cacheKey = 'cityGameOnlineCacheV2';
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

  // ===== Online validation (Wikidata API w/ CORS + Nominatim fallback) =====

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

  async function fetchJson(url, {timeout=8000} = {}) {
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

  function ruStringsFromEntity(entity) {
    const out = [];
    if (!entity) return out;
    const labels = entity.labels || {};
    const aliases = entity.aliases || {};
    if (labels.ru) out.push(labels.ru.value);
    if (aliases.ru) out.push(...aliases.ru.map(x => x.value));
    if (labels.uk) out.push(labels.uk.value);
    if (aliases.uk) out.push(...aliases.uk.map(x => x.value));
    return out;
  }

  async function wikidataValidate(name) {
    try {
      const q = encodeURIComponent(name);
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${q}&language=ru&uselang=ru&type=item&limit=6&origin=*`;
      const s = await fetchJson(searchUrl);
      if (!s || !s.search || !s.search.length) return null;

      // Build ids pool (prefer exact matches first)
      const exact = s.search.filter(it => {
        const all = [it.label, ...(it.aliases || [])];
        return all.some(str => normEq(str, name));
      });
      const pool = (exact.length ? exact : s.search).slice(0, 6);
      const ids = pool.map(it => it.id).join('|');

      // Fetch entities via API (has CORS)
      const entUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&languages=ru|uk&props=labels|aliases|claims&format=json&origin=*`;
      const data = await fetchJson(entUrl);
      const entities = data && data.entities ? data.entities : {};

      for (const it of pool) {
        const entity = entities[it.id];
        if (!entity) continue;

        // Check P31 instance-of
        const p31 = (entity.claims && entity.claims.P31) || [];
        const ok = p31.some(claim => {
          const v = claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value;
          const id = v && v.id;
          return id && WD_ALLOWED.has(id);
        });
        if (!ok) continue;

        const candidates = ruStringsFromEntity(entity);
        const ru = candidates.find(x => !!x) || it.label || name;
        return { ok: true, display: ru };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function nominatimValidate(name) {
    try {
      const q = encodeURIComponent(name);
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ru&q=${q}&limit=5&addressdetails=0`;
      const data = await fetchJson(url, {timeout: 8000});
      if (!Array.isArray(data) || !data.length) return null;
      const okTypes = new Set(['city','town','village','municipality','borough','suburb']);
      for (const item of data) {
        const t = (item.type || '').toLowerCase();
        if (!okTypes.has(t)) continue;
        const disp = (item.display_name || '').split(',')[0].trim();
        const nm = (item.name || '').trim();
        if (normEq(disp, name) || normEq(nm, name)) {
          return { ok: true, display: disp };
        }
      }
      // As a lenient fallback, accept first settlement-like hit
      const first = data.find(item => new Set(['city','town','village']).has((item.type || '').toLowerCase()));
      if (first) {
        const disp = (first.display_name || '').split(',')[0].trim();
        return { ok: true, display: disp };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function withOverallTimeout(promise, ms, onTimeout) {
    let to;
    const timeout = new Promise((resolve) => {
      to = setTimeout(() => resolve(onTimeout ? onTimeout() : null), ms);
    });
    const res = await Promise.race([promise, timeout]);
    clearTimeout(to);
    return res;
  }

  async function validateOnline(name) {
    const n = normalize(name);
    if (cache[n]) return cache[n];

    // Try Wikidata first, then Nominatim; cap total time
    const res = await withOverallTimeout((async () => {
      let r = await wikidataValidate(name);
      if (!r) r = await nominatimValidate(name);
      return r;
    })(), 9000, () => null);

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
    statusEl.textContent = '';
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
    statusEl.textContent = '';
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

    // Offline quick path
    const localHit = DICT.find(c => normalize(c) === norm);
    if (localHit) {
      return { ok:true, norm, display: localHit };
    }

    // Online validation (optional)
    if (!toggle.checked) {
      return { ok:false, reason:'Города нет в локальной базе. Включите онлайн-валидацию или расширьте cities.js.' };
    }

    statusEl.textContent = '⏳ Проверка…';
    try {
      const online = await validateOnline(trimmed);
      if (online && online.ok) {
        statusEl.textContent = '✔ Найдено в справочниках';
        setTimeout(() => { if (statusEl.textContent.startsWith('✔')) statusEl.textContent = ''; }, 1200);
        DICT.push(online.display);
        return { ok:true, norm: normalize(online.display), display: online.display };
      }
      statusEl.textContent = '✖ Не найдено';
      setTimeout(() => { if (statusEl.textContent.startsWith('✖')) statusEl.textContent = ''; }, 1500);
      return { ok:false, reason:'Такого города не найдено в справочниках.' };
    } catch (e) {
      statusEl.textContent = '⚠ Ошибка сети';
      setTimeout(() => { if (statusEl.textContent.startsWith('⚠')) statusEl.textContent = ''; }, 1500);
      return { ok:false, reason:'Не удалось проверить из‑за сетевой ошибки. Попробуйте снова или отключите онлайн-валидацию.' };
    }
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
    } catch (err) {
      // Absolute safety net
      statusEl.textContent = '⚠ Ошибка';
      messageEl.textContent = 'Не удалось проверить город из‑за ошибки. Попробуйте снова.';
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