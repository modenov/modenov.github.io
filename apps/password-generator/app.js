/* Генератор паролей — Владимир Моденов
   Логика генерации и UI
*/

// Тёмная тема: используем prefers-color-scheme, а также "ночные часы" 20:00–07:00
(function initTheme(){
  const html = document.documentElement;
  const hour = new Date().getHours();
  const isNight = (hour >= 20 || hour < 7);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(prefersDark || isNight){ html.classList.add('theme-dark'); }
})();

// DOM элементы
const lengthInput = document.getElementById('length');
const lengthValue = document.getElementById('lengthValue');
const countInput  = document.getElementById('count');

const useUpper = document.getElementById('useUpper');
const useLower = document.getElementById('useLower');
const useDigits= document.getElementById('useDigits');
const useSpecial=document.getElementById('useSpecial');

const excludeAmbiguous = document.getElementById('excludeAmbiguous');
const excludeComplex   = document.getElementById('excludeComplex');
const avoidRepeats     = document.getElementById('avoidRepeats');

const typesWarning = document.getElementById('typesWarning');
const repeatsWarning = document.getElementById('repeatsWarning');

const generateBtn = document.getElementById('generateBtn');
const exportBtn = document.getElementById('exportBtn');
const listEl = document.getElementById('passwordList');
const tpl = document.getElementById('passwordItemTemplate');

const footerYear = document.getElementById('year');
footerYear.textContent = new Date().getFullYear();

lengthInput.addEventListener('input', () => lengthValue.textContent = lengthInput.value);
[countInput, useUpper, useLower, useDigits, useSpecial].forEach(el => {
  el.addEventListener('input', validateState);
  el.addEventListener('change', validateState);
});
[excludeAmbiguous, excludeComplex, avoidRepeats, lengthInput].forEach(el => {
  el.addEventListener('input', validateState);
  el.addEventListener('change', validateState);
});

exportBtn.addEventListener('click', exportTxt);
generateBtn.addEventListener('click', generatePasswords);

// Базовые наборы
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
// Спецсимволы только из задания
const SPECIAL = '$%!#';

// Неоднозначные символы (исключаются при включённой опции)
const AMBIGUOUS = new Set([
  'O','0','o','I','l','1','L','|','S','5','B','8','G','6','Z','2','Q','9'
]);
// Сложные символы (исключаются при включённой опции)
const COMPLEX = new Set(['"','~','`','^']);

// Сервис: фильтрация набора с учётом исключений
function filteredSet(str){
  const out = [];
  for(const ch of str){
    if(excludeAmbiguous.checked && AMBIGUOUS.has(ch)) continue;
    if(excludeComplex.checked && COMPLEX.has(ch)) continue;
    out.push(ch);
  }
  return out;
}


// Оценка надёжности пароля
function assessStrength(container, codeEl){
  const text = codeEl.textContent;
  const length = text.length;
  const spans = Array.from(codeEl.querySelectorAll('span'));
  const present = {
    upper: spans.some(s => s.classList.contains('upper')),
    lower: spans.some(s => s.classList.contains('lower')),
    digits:spans.some(s => s.classList.contains('digit')),
    special:spans.some(s => s.classList.contains('special'))
  };
  // Размер алфавита по фактическим классам в пароле и текущим исключениям
  const sets = buildActiveSets();
  let R = 0;
  if(present.upper)   R += sets.upper.length;
  if(present.lower)   R += sets.lower.length;
  if(present.digits)  R += sets.digits.length;
  if(present.special) R += sets.special.length;
  R = Math.max(R, 1);

  const bits = length * Math.log2(R);

  // Нормируем к 100 для прогресс-бара (условный максимум 100 бит)
  const pct = Math.max(0, Math.min(100, Math.round((bits / 100) * 100)));
  const label = strengthLabel(bits);

  const strengthEl = container.querySelector('.strength');
  const meter = strengthEl.querySelector('.meter');
  const lab = strengthEl.querySelector('.label');

  strengthEl.classList.remove('weak','fair','good','strong');
  strengthEl.classList.add(label.className);
  lab.textContent = `${label.text} (${Math.round(bits)} бит)`;
  meter.setAttribute('aria-valuenow', String(pct));
  // CSS inset trick: right inset = 100 - pct%
  meter.style.setProperty('--pct', pct + '%');
  meter.style.setProperty('inset', `0 ${100-pct}% 0 0`);
}

// Текстовая шкала
function strengthLabel(bits){
  if(bits < 40)  return {text:'Слабый', className:'weak'};
  if(bits < 60)  return {text:'Удовлетворительно', className:'fair'};
  if(bits < 80)  return {text:'Хороший', className:'good'};
  return {text:'Сильный', className:'strong'};
}
// Проверяем состояние и валидность
function validateState(){
  const selectedTypes = [
    useUpper.checked, useLower.checked, useDigits.checked, useSpecial.checked
  ].filter(Boolean).length;

  // Если ни одного типа — блокируем кнопку генерации
  if(selectedTypes === 0){
    generateBtn.disabled = true;
    typesWarning.hidden = false;
  } else {
    typesWarning.hidden = true;
    // Проверяем возможность "без повторов"
    const length = Number(lengthInput.value);
    const sets = buildActiveSets();
    const totalUnique = sets.upper.length + sets.lower.length + sets.digits.length + sets.special.length;
    const noRepeatsImpossible = avoidRepeats.checked && length > Math.max(1, totalUnique);
    repeatsWarning.hidden = !noRepeatsImpossible;
    generateBtn.disabled = noRepeatsImpossible;
  }
}

// Собираем активные множества символов
function buildActiveSets(){
  return {
    upper:  useUpper.checked ? filteredSet(UPPER) : [],
    lower:  useLower.checked ? filteredSet(LOWER) : [],
    digits: useDigits.checked ? filteredSet(DIGITS) : [],
    special:useSpecial.checked? filteredSet(SPECIAL): []
  };
}

// Равномерное распределение длины между активными типами
function splitLength(total, types){
  const n = types.length;
  const base = Math.floor(total / n);
  let rest = total % n;
  const parts = new Array(n).fill(base);
  // случайно распределяем остаток
  while(rest > 0){
    const i = Math.floor(Math.random() * n);
    parts[i] += 1;
    rest--;
  }
  return parts;
}

// Взять случайный элемент (без повторов при необходимости)
function takeRandomChar(pool, used){
  if(avoidRepeats.checked){
    // исключаем уже использованные символы
    const filtered = pool.filter(ch => !used.has(ch));
    if(filtered.length === 0) return null;
    const ch = filtered[Math.floor(Math.random() * filtered.length)];
    used.add(ch);
    return ch;
  } else {
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

// Перемешивание массива (Fisher-Yates)
function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Генерация одного пароля по текущим настройкам
function generateOne(){
  const length = Number(lengthInput.value);
  const sets = buildActiveSets();

  // Составляем список активных типов и соответствующих пулов
  const pools = [];
  if(sets.upper.length)  pools.push({type:'upper', pool:sets.upper});
  if(sets.lower.length)  pools.push({type:'lower', pool:sets.lower});
  if(sets.digits.length) pools.push({type:'digits', pool:sets.digits});
  if(sets.special.length)pools.push({type:'special',pool:sets.special});

  // Без типов — возврат
  if(pools.length === 0) return '';

  // Проверка возможности без повторов
  const totalUnique = sets.upper.length + sets.lower.length + sets.digits.length + sets.special.length;
  if(avoidRepeats.checked && length > totalUnique){
    return ''; // валидатор уже покажет предупреждение
  }

  const parts = splitLength(length, pools);
  const used = new Set();
  const draft = [];

  // Гарантируем хотя бы 1 символ каждого выбранного типа (если хватает длины)
  for(let i=0;i<pools.length && i<length;i++){
    const ch = takeRandomChar(pools[i].pool, used);
    if(ch !== null) {
      draft.push({ch, type:pools[i].type});
      parts[i] = Math.max(0, parts[i]-1);
    }
  }

  // Добираем остаток по распределению
  for(let i=0;i<pools.length;i++){
    for(let k=0;k<parts[i];k++){
      const ch = takeRandomChar(pools[i].pool, used);
      // Если без повторов закончился пул — пробуем добрать из других
      if(ch === null){
        // попытка из любого пула
        let alt = null, t = null;
        for(const p of pools){
          const tryCh = takeRandomChar(p.pool, used);
          if(tryCh !== null){ alt = tryCh; t = p.type; break; }
        }
        if(alt === null) break; // совсем нечего добавить
        draft.push({ch: alt, type: t});
      }else{
        draft.push({ch, type:pools[i].type});
      }
    }
  }

  // Перемешиваем для большей случайности
  shuffle(draft);

  // Окрашивание символов: цифры — синие, спец — красные, остальное — чёрные
  const span = (c, type) => {
    if(type === 'digits')  return `<span class="digit">${c}</span>`;
    if(type === 'special') return `<span class="special">${c}</span>`;
    if(type === 'upper')   return `<span class="letter upper">${c}</span>`;
    if(type === 'lower')   return `<span class="letter lower">${c}</span>`;
    return `<span class="letter">${c}</span>`;
  };

  return draft.map(item => span(item.ch, item.type)).join('');
}

// Генерация списка
function generatePasswords(){
  listEl.setAttribute('aria-busy', 'true');
  listEl.innerHTML = '';
  const n = Math.min(50, Math.max(1, Number(countInput.value) || 10));

  for(let i=0;i<n;i++){
    const html = generateOne();
    const node = tpl.content.cloneNode(true);
    const code = node.querySelector('.pw');
    code.innerHTML = html || '<span class="letter">—</span>';
    const li = node.querySelector('.passwordItem');
    const btn = node.querySelector('.copyBtn');
    btn.addEventListener('click', () => copyPlainText(code));
    const liEl = node.querySelector('.passwordItem');
    assessStrength(liEl, code);
    listEl.appendChild(node);
  }
  listEl.setAttribute('aria-busy', 'false');
}

// Копирование текста пароля без HTML-разметки
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

// Вспышка уведомления
function flash(target, msg){
  const bubble = document.createElement('span');
  bubble.className = 'help';
  bubble.textContent = msg;
  bubble.style.marginLeft = '8px';
  target.after(bubble);
  setTimeout(() => bubble.remove(), 1600);
}

// Экспорт всех паролей в .txt
function exportTxt(){
  const items = Array.from(document.querySelectorAll('.passwordItem .pw'));
  if(items.length === 0){ return; }
  const lines = items.map(el => el.textContent);
  const blob = new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'passwords.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Инициализация начального состояния
validateState();
