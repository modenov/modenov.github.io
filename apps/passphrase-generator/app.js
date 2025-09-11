/* Генератор парольных фраз — Владимир Моденов */
// Тёмная тема
(function initTheme(){
  const html = document.documentElement;
  const hour = new Date().getHours();
  const isNight = (hour >= 20 || hour < 7);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(prefersDark || isNight){ html.classList.add('theme-dark'); }
})();

// DOM
const wordsCountInput = document.getElementById('wordsCount');
const separatorInput = document.getElementById('separator');
const capitalizeInput = document.getElementById('capitalize');
const addDigitInput = document.getElementById('addDigit');
const addSymbolInput = document.getElementById('addSymbol');

const phraseEl = document.getElementById('phrase');
const phraseWrap = document.getElementById('phraseWrap');
const copyBtn = document.getElementById('copyBtn');
const exportBtn = document.getElementById('exportBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyList = document.getElementById('historyList');
const generateBtn = document.getElementById('generateBtn');

const footerYear = document.getElementById('year');
footerYear.textContent = new Date().getFullYear();

copyBtn.addEventListener('click', () => copyPlainText(phraseEl));
exportBtn.addEventListener('click', exportHistory);
clearHistoryBtn.addEventListener('click', clearHistory);
generateBtn.addEventListener('click', generatePhrase);

// История
const HISTORY_LIMIT = 30;
const history = [];

// Генерация
function generatePhrase(){
  const wordsCount = clamp(Number(wordsCountInput.value) || 6, 3, 20);
  const sep = separatorInput.value ?? "-";

  const words = [];
  for(let i=0;i<wordsCount;i++){
    const w = pickWord();
    words.push(capitalizeInput.checked ? capitalize(w) : w);
  }

  // модификаторы
  const indices = shuffle([...Array(wordsCount).keys()]);
  let usedIndex = -1;
  if(addDigitInput.checked){
    const idx = indices.pop();
    words[idx] = words[idx] + randomDigit();
    usedIndex = idx;
  }
  if(addSymbolInput.checked){
    let idx = indices.pop();
    if(idx === undefined || idx === usedIndex){
      idx = Math.floor(Math.random() * wordsCount);
    }
    words[idx] = words[idx] + randomSymbol();
  }

  const colored = words.map(tokenizeAndColor).join(sep);
  phraseEl.innerHTML = colored;

  applyDynamicSize(phraseEl.textContent.length);
  pushHistory(phraseEl.textContent);
}

function pickWord(){
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return w;
}

function tokenizeAndColor(s){
  const parts = s.split(/([0-9]|[!%&^])/g);
  return parts.map(part => {
    if(part === '') return '';
    if(/[0-9]/.test(part)) return `<span class="digit">${part}</span>`;
    if(/[!%&^]/.test(part)) return `<span class="special">${part}</span>`;
    return `<span class="word">${escapeHtml(part)}</span>`;
  }).join('');
}

function escapeHtml(str){
  return str.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function randomDigit(){ return String(Math.floor(Math.random()*10)); }
function randomSymbol(){ return ['!','%','&','^'][Math.floor(Math.random()*4)]; }
function capitalize(w){ return w.charAt(0).toUpperCase() + w.slice(1); }
function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

function applyDynamicSize(len){
  phraseEl.classList.remove('small','medium','tiny');
  if(len > 60)      phraseEl.classList.add('tiny');
  else if(len > 40) phraseEl.classList.add('small');
  else if(len > 28) phraseEl.classList.add('medium');
}

// История
function pushHistory(text){
  if(!text || text.trim()==='') return;
  history.unshift(text);
  while(history.length > HISTORY_LIMIT) history.pop();
  renderHistory();
}
function renderHistory(){
  historyList.innerHTML = '';
  history.forEach(item => {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = item;
    li.appendChild(code);
    historyList.appendChild(li);
  });
}
function clearHistory(){
  history.length = 0;
  renderHistory();
}
function exportHistory(){
  if(history.length === 0) return;
  const blob = new Blob([history.join('\n')], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'passphrases.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Копирование
async function copyPlainText(codeEl){
  const text = codeEl.textContent;
  try{
    await navigator.clipboard.writeText(text);
    flash(codeEl, 'Скопировано!');
  }catch(e){
    console.error(e);
    flash(codeEl, 'Не удалось скопировать');
  }
}
function flash(target, msg){
  const bubble = document.createElement('span');
  bubble.className = 'help';
  bubble.textContent = msg;
  bubble.style.marginLeft = '8px';
  target.after(bubble);
  setTimeout(() => bubble.remove(), 1600);
}

// Утилиты
function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Первый запуск
generatePhrase();
