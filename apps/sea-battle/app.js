// =============================
// Морской бой Моденова (Vanilla JS)
// =============================

// Константы игры
const SIZE = 10; // размер поля 10х10
// Флот по классике: 1x4, 2x3, 3x2, 4x1
const FLEET_CONFIG = [4,3,3,2,2,2,1,1,1,1];

// Эмодзи для состояния клетки
const EMOJI = {
  water: "🟦",
  ship: "🚢",   // показывается на поле игрока
  miss: "⚪",
  hit: "💥",
  sunk: "☠️"
};

// Состояние игры
const state = {
  phase: "setup", // "setup" | "battle" | "over"
  turn: "player", // "player" | "ai"
  orientation: "H", // "H"orizontal | "V"ertical

  player: {
    grid: null, // матрица клеток
    ships: [],
  },
  ai: {
    grid: null,
    ships: [],
  },

  // Настройки ИИ для баланса
  aiSkill: {
    // вероятность, что ИИ сделает "случайный выстрел" (чтобы не был идеальным охотником)
    randomShotChance: 0.30,
    // небольшая пауза для реализма
    shotDelayMs: 550,
  },

  // Память ИИ для охоты по попаданию
  aiMemory: {
    targets: [], // очередь клеток-кандидатов (рядом с последним попаданием)
    tried: new Set(), // строковые ключи "r,c" уже обстрелянных
  }
};

// ========= УТИЛИТЫ =========
function makeEmptyGrid() {
  // Каждая ячейка — объект: { state: "empty"|"ship"|"hit"|"miss"|"sunk", shipId?: number }
  return Array.from({length: SIZE}, () =>
    Array.from({length: SIZE}, () => ({ state: "empty" }))
  );
}
function cloneGrid(grid) {
  return grid.map(row => row.map(cell => ({...cell})));
}
function inBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}
function key(r,c) { return `${r},${c}`; }

function cellsAround(r, c) {
  // Возвращает соседние 8 клеток (включая диагонали), отфильтрованные по границам.
  const deltas = [
    [-1,-1],[-1,0],[-1,1],
    [ 0,-1],       [ 0,1],
    [ 1,-1],[ 1,0],[ 1,1]
  ];
  return deltas.map(([dr,dc]) => [r+dr,c+dc]).filter(([rr,cc]) => inBounds(rr,cc));
}

// Проверка: можно ли поставить корабль данного размера в (r,c) с ориентацией orient, без касаний
function canPlace(grid, r, c, size, orient) {
  for (let i = 0; i < size; i++) {
    const rr = r + (orient === "V" ? i : 0);
    const cc = c + (orient === "H" ? i : 0);
    if (!inBounds(rr,cc)) return false;
    if (grid[rr][cc].state !== "empty") return false;
    // Чтобы корабли не касались даже по диагонали
    const area = [[rr,cc], ...cellsAround(rr,cc)];
    for (const [ar, ac] of area) {
      if (grid[ar][ac].state === "ship") return false;
    }
  }
  return true;
}

// Размещение корабля на сетке
function placeShip(grid, ships, r, c, size, orient) {
  const id = ships.length;
  const coords = [];
  for (let i = 0; i < size; i++) {
    const rr = r + (orient === "V" ? i : 0);
    const cc = c + (orient === "H" ? i : 0);
    grid[rr][cc] = { state: "ship", shipId: id };
    coords.push([rr,cc]);
  }
  ships.push({ id, size, coords, hits: 0, sunk: false });
}

// Случайная расстановка флота
function randomizeFleet() {
  const grid = makeEmptyGrid();
  const ships = [];
  for (const size of FLEET_CONFIG) {
    let placed = false;
    for (let tries = 0; tries < 2000 && !placed; tries++) {
      const orient = Math.random() < 0.5 ? "H" : "V";
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (canPlace(grid, r, c, size, orient)) {
        placeShip(grid, ships, r, c, size, orient);
        placed = true;
      }
    }
    if (!placed) {
      // На крайний случай — перезапустить процесс (редко, но может пригодиться)
      return randomizeFleet();
    }
  }
  return { grid, ships };
}

// Пересчитать статус корабля -> потоплен?
function updateShipSunkStatus(board, ship) {
  ship.hits = ship.coords.reduce((acc, [r,c]) => acc + (board.grid[r][c].state === "hit" || board.grid[r][c].state === "sunk" ? 1 : 0), 0);
  if (!ship.sunk && ship.hits >= ship.size) {
    ship.sunk = true;
    // Пометить все клетки корабля как sunk
    for (const [r,c] of ship.coords) {
      board.grid[r][c].state = "sunk";
    }
    return true; // только что потопили
  }
  return false;
}

// Проверка полной победы (все корабли потоплены)
function isAllSunk(ships) {
  return ships.every(s => s.sunk);
}

// Преобразование состояния клетки в эмодзи (для отображения)
function emojiFor(cell, revealShips=false) {
  switch (cell.state) {
    case "empty": return EMOJI.water;
    case "ship": return revealShips ? EMOJI.ship : EMOJI.water;
    case "miss": return EMOJI.miss;
    case "hit": return EMOJI.hit;
    case "sunk": return EMOJI.sunk;
    default: return " ";
  }
}

// ========= РЕНДЕРИНГ =========
const els = {
  playerBoard: document.getElementById("playerBoard"),
  aiBoard: document.getElementById("aiBoard"),
  phaseBadge: document.getElementById("phaseBadge"),
  turnBadge: document.getElementById("turnBadge"),
  remaining: document.getElementById("remaining"),
  rotateBtn: document.getElementById("rotateBtn"),
  autoPlaceBtn: document.getElementById("autoPlaceBtn"),
  clearBtn: document.getElementById("clearBtn"),
  startBtn: document.getElementById("startBtn"),
  newGameBtn: document.getElementById("newGameBtn"),
  log: document.getElementById("log"),
  rulesBtn: document.getElementById("rulesBtn"),
  rulesModal: document.getElementById("rulesModal"),
  rulesClose: document.getElementById("rulesClose"),
  rulesOk: document.getElementById("rulesOk"),
  themeBtn: document.getElementById("themeBtn")
};

function renderBoard(boardEl, board, isPlayer=false) {
  // Очистить
  boardEl.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board.grid[r][c];
      const btn = document.createElement("button");
      btn.className = "cell";
      btn.dataset.r = r;
      btn.dataset.c = c;
      btn.setAttribute("aria-label", `Клетка ${r+1}:${c+1}`);

      // На поле игрока корабли всегда видны; на поле ИИ — скрыты до попадания
      const reveal = isPlayer || (cell.state !== "ship");
      btn.textContent = emojiFor(cell, reveal);

      // События клика зависят от фазы
      if (isPlayer) {
        if (state.phase === "setup") {
          btn.addEventListener("click", onPlayerCellClickSetup);
        } else {
          // Во время боя — клики по своему полю не нужны
          btn.disabled = true;
        }
      } else {
        // Поле ИИ: кликабельно только во время боя и только если ваш ход
        btn.disabled = !(state.phase === "battle" && state.turn === "player");
        if (!btn.disabled) {
          btn.addEventListener("click", onAiCellClickBattle);
        }
      }
      boardEl.appendChild(btn);
    }
  }
}

// Обновить текст "Осталось расставить"
function renderRemaining() {
  if (state.phase !== "setup") {
    els.remaining.textContent = "";
    return;
  }
  const counts = countRemainingShipsToPlace();
  const parts = [];
  if (counts[4]) parts.push(`4‑палубный ×${counts[4]}`);
  if (counts[3]) parts.push(`3‑палубный ×${counts[3]}`);
  if (counts[2]) parts.push(`2‑палубный ×${counts[2]}`);
  if (counts[1]) parts.push(`1‑палубный ×${counts[1]}`);
  els.remaining.textContent = parts.length ? ("Осталось: " + parts.join(", ")) : "Флот готов — нажмите «Начать игру»";
}

// ========= ПОДГОТОВКА ФЛОТА ИГРОКА =========
function currentUnplacedSize() {
  // Возвращает следующий размер корабля, который нужно поставить (по порядку FLEET_CONFIG)
  const placedCounts = state.player.ships.length;
  if (placedCounts >= FLEET_CONFIG.length) return null;
  return FLEET_CONFIG[placedCounts];
}
function countRemainingShipsToPlace() {
  const remain = {...{1:0,2:0,3:0,4:0}};
  for (const s of FLEET_CONFIG) {
    remain[s]++;
  }
  for (const _ of state.player.ships) {
    const size = FLEET_CONFIG[state.player.ships.length - (_ ? 1 : 1)]; // не используется
  }
  // Более корректно: посчитать уже поставленные размерам
  const placedSizes = state.player.ships.map(s => s.size);
  for (const sz of placedSizes) {
    remain[sz]--;
  }
  return remain;
}

function onPlayerCellClickSetup(e) {
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;

  const cell = state.player.grid[r][c];
  // Если клик по уже стоящему кораблю — удалить целиком этот корабль
  if (cell.state === "ship" && typeof cell.shipId === "number") {
    removeShip(state.player, cell.shipId);
    renderAll();
    return;
  }

  const size = currentUnplacedSize();
  if (!size) {
    toast("Флот уже полностью расставлен.");
    return;
  }
  if (canPlace(state.player.grid, r, c, size, state.orientation)) {
    placeShip(state.player.grid, state.player.ships, r, c, size, state.orientation);
    renderAll();
    // Активируем кнопку начала игры, если всё расставлено
    if (state.player.ships.length === FLEET_CONFIG.length) {
      els.startBtn.disabled = false;
      els.phaseBadge.textContent = "Подготовка завершена";
    }
  } else {
    toast("Сюда поставить нельзя (выход за поле, пересечение или касание).");
  }
}

function removeShip(board, shipId) {
  const ship = board.ships.find(s => s.id === shipId);
  if (!ship) return;
  for (const [r,c] of ship.coords) {
    board.grid[r][c] = { state: "empty" };
  }
  // Переиндексацию делать не будем — просто пометим корабль как удалённый
  board.ships = board.ships.filter(s => s.id !== shipId);
  // Но shipId в клетках больше не используется, так что порядок не критичен
}

// ========= БОЙ =========
function onAiCellClickBattle(e) {
  if (state.turn !== "player") return;
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  const cell = state.ai.grid[r][c];

  if (cell.state === "miss" || cell.state === "hit" || cell.state === "sunk") {
    toast("Сюда уже стреляли.");
    return;
  }

  // Попадание?
  if (cell.state === "ship") {
    cell.state = "hit";
    const ship = state.ai.ships[cell.shipId];
    const sunkNow = updateShipSunkStatus(state.ai, ship);
    renderAll();

    if (sunkNow) toast("Есть! Корабль противника потоплен ☠️");
    else toast("Попадание 💥");

    if (isAllSunk(state.ai.ships)) {
      endGame("win");
      return;
    }
  } else {
    // Промах
    state.ai.grid[r][c].state = "miss";
    toast("Промах ⚪");
    state.turn = "ai";
    updateBadges();
    renderAll();
    // Ход ИИ с небольшой задержкой
    setTimeout(aiTurn, state.aiSkill.shotDelayMs);
    return;
  }

  // По классике — 1 выстрел в ход, даже при попадании
  state.turn = "ai";
  updateBadges();
  setTimeout(aiTurn, state.aiSkill.shotDelayMs);
}

function aiTurn() {
  if (state.phase !== "battle") return;

  // Обнаруженные цели (если ранее было попадание)
  const { targets, tried } = state.aiMemory;

  let targetCell = null;

  // Иногда (randomShotChance) ИИ делает полностью случайный выстрел,
  // чтобы не казаться «прозорливым» и не выносить флот слишком быстро.
  const makeRandom = Math.random() < state.aiSkill.randomShotChance || targets.length === 0;

  if (!makeRandom && targets.length) {
    // Выбираем следующую цель из очереди
    targetCell = targets.shift();
  } else {
    // Случайный выбор нестрелянной клетки
    const candidates = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const k = key(r,c);
        if (!tried.has(k) && state.player.grid[r][c].state !== "hit" && state.player.grid[r][c].state !== "miss" && state.player.grid[r][c].state !== "sunk") {
          candidates.push([r,c]);
        }
      }
    }
    if (candidates.length === 0) return; // на всякий случай
    targetCell = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const [r, c] = targetCell;
  const k = key(r,c);
  tried.add(k);

  const cell = state.player.grid[r][c];

  if (cell.state === "ship") {
    // Попадание
    cell.state = "hit";
    const ship = state.player.ships[cell.shipId];
    const sunkNow = updateShipSunkStatus(state.player, ship);

    // Если не потопили, добавим соседей как цели (вперёд/назад/вверх/вниз)
    if (!sunkNow) {
      const nextTargets = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([rr,cc]) => (
        inBounds(rr,cc) && !state.aiMemory.tried.has(key(rr,cc))
      ));
      // Перемешаем немного (чтобы «комбинации» были разными)
      shuffle(nextTargets);
      state.aiMemory.targets.push(...nextTargets);
      toast("Противник попал по вашему кораблю 💥");
    } else {
      // При потоплении — очищаем очередь целей, чтоб ИИ «переосмыслил» охоту
      state.aiMemory.targets.length = 0;
      toast("Осторожно: корабль потоплен противником ☠️");
    }

    renderAll();
    if (isAllSunk(state.player.ships)) {
      endGame("lose");
      return;
    }
  } else {
    // Промах
    state.player.grid[r][c].state = "miss";
    toast("Противник промахнулся ⚪");
    renderAll();
  }

  // Ход переходит вам
  state.turn = "player";
  updateBadges();
}

// Простая перестановка массива
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ========= ИНИЦИАЛИЗАЦИЯ И УПРАВЛЕНИЕ =========
function resetAll(newRandom = true) {
  state.phase = "setup";
  state.turn = "player";
  state.orientation = "H";
  state.aiMemory.targets = [];
  state.aiMemory.tried = new Set();
  els.startBtn.disabled = true;
  els.turnBadge.classList.add("hidden");
  els.phaseBadge.textContent = "Подготовка: расставьте флот";

  // Поле игрока пустое, корабли отсутствуют
  state.player.grid = makeEmptyGrid();
  state.player.ships = [];

  // Поле ИИ всегда случайное
  if (newRandom) {
    const ai = randomizeFleet();
    state.ai.grid = ai.grid;
    state.ai.ships = ai.ships;
  } else {
    // На случай рестарта без смены флотилии ИИ (не используется)
  }

  renderAll();
  renderRemaining();
}

function startBattle() {
  if (state.player.ships.length !== FLEET_CONFIG.length) {
    toast("Сначала расставьте весь флот.");
    return;
  }
  state.phase = "battle";
  els.phaseBadge.textContent = "Бой начался";
  els.turnBadge.classList.remove("hidden");
  updateBadges();
  renderAll();
  toast("Ваш ход. Стреляйте по верхнему полю.");
}

function updateBadges() {
  els.turnBadge.textContent = state.turn === "player" ? "Ваш ход" : "Ход компьютера";
  // Перерендер кнопок клика по AI-полю (активно только на вашем ходу)
  renderBoard(els.aiBoard, {grid: state.ai.grid}, false);
}

function renderAll() {
  renderBoard(els.playerBoard, {grid: state.player.grid}, true);
  renderBoard(els.aiBoard, {grid: state.ai.grid}, false);
  renderRemaining();
  updateYear();
}

function toast(message) {
  els.log.textContent = message;
}

// Кнопки
els.rotateBtn.addEventListener("click", () => {
  state.orientation = state.orientation === "H" ? "V" : "H";
  els.rotateBtn.textContent = state.orientation === "H" ? "Горизонтально ⟷" : "Вертикально ↕";
  toast(state.orientation === "H" ? "Ориентация: по горизонтали" : "Ориентация: по вертикали");
});
els.autoPlaceBtn.addEventListener("click", () => {
  // Случайная расстановка на поле игрока
  const rnd = randomizeFleet();
  state.player.grid = rnd.grid;
  state.player.ships = rnd.ships;
  els.startBtn.disabled = false;
  els.phaseBadge.textContent = "Подготовка завершена";
  renderAll();
  toast("Флот расставлен автоматически.");
});
els.clearBtn.addEventListener("click", () => {
  state.player.grid = makeEmptyGrid();
  state.player.ships = [];
  els.startBtn.disabled = true;
  els.phaseBadge.textContent = "Подготовка: расставьте флот";
  renderAll();
  toast("Поле очищено.");
});
els.startBtn.addEventListener("click", startBattle);
els.newGameBtn.addEventListener("click", () => resetAll(true));

// Модал «Правила»
function openRules() {
  els.rulesModal.setAttribute("aria-hidden", "false");
}
function closeRules() {
  els.rulesModal.setAttribute("aria-hidden", "true");
}
els.rulesBtn.addEventListener("click", openRules);
els.rulesClose.addEventListener("click", closeRules);
els.rulesOk.addEventListener("click", closeRules);
els.rulesModal.addEventListener("click", (e) => {
  if (e.target.dataset.close === "true") closeRules();
});

// Динамический год в футере
function updateYear() {
  const y = new Date().getFullYear();
  const el = document.getElementById("year");
  if (el) el.textContent = String(y);
}

// Тёмная тема: автоматически «от заката до рассвета» (приближённо)
// — без геолокации и сетевых запросов. Используем локальное время.
// По умолчанию светлая тема; ночью (21:00–06:59) — тёмная.
function isNight() {
  const h = new Date().getHours();
  return (h >= 21 || h < 7);
}
function applyTheme(auto = true) {
  // Если пользователь вручную трогает тему — запоминаем в localStorage
  const manual = localStorage.getItem("seaBattleTheme");
  let dark = false;
  if (manual === "dark") dark = true;
  else if (manual === "light") dark = false;
  else dark = isNight(); // авто
  document.documentElement.classList.toggle("dark", dark);
}
applyTheme(true);

// Позволим вручную переключать (на случай, если ночью хочется светлую и наоборот)
els.themeBtn.addEventListener("click", () => {
  const currentlyDark = document.documentElement.classList.contains("dark");
  const next = !currentlyDark;
  document.documentElement.classList.toggle("dark", next);
  localStorage.setItem("seaBattleTheme", next ? "dark" : "light");
});

// Переоценка темы раз в несколько минут (вдруг пользователь оставил вкладку открытой и время суток сменилось)
setInterval(() => {
  // Если пользователь не фиксировал вручную — обновим авто-режим
  const manual = localStorage.getItem("seaBattleTheme");
  if (!manual) applyTheme(true);
}, 5 * 60 * 1000);

// ==== СТАРТ ====
resetAll(true);

// Подсказка по клику правой кнопкой (необязательно)
// Отключаем контекстное меню на клетках для эстетики
document.addEventListener("contextmenu", (e) => {
  if (e.target && e.target.classList && e.target.classList.contains("cell")) {
    e.preventDefault();
  }
});

