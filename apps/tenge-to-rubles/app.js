// app.js - логика конвертера
// Автор: Владимир Моденов
// Источник курса: exchangerate.host (бесплатный, без API-ключа для простых запросов)
// Поведение:
// 1) Получаем курс KZT→RUB в реальном времени (кешируем в sessionStorage на 1 час)
// 2) Рассчитываем сумму: raw = price_kzt * rate
// 3) Добавляем 8% посредникам: withFee = raw * 1.08
// 4) Добавляем 100 ₽: final = withFee + 100
// 5) Показываем результат

const API_RATE_URL = 'https://api.exchangerate.host/latest?base=KZT&symbols=RUB';
const RATE_CACHE_KEY = 'kzt-rub-rate';
const RATE_CACHE_TTL_MS = 1000 * 60 * 60; // 1 час

// Utility: форматируем число в рублях
function fmtRub(value){
  return new Intl.NumberFormat('ru-RU', {style:'currency', currency:'RUB'}).format(value);
}

async function fetchRate(){
  // Проверим кеш
  try{
    const cached = sessionStorage.getItem(RATE_CACHE_KEY);
    if(cached){
      const obj = JSON.parse(cached);
      if(Date.now() - obj.timestamp < RATE_CACHE_TTL_MS){
        return obj.rate;
      }
    }
  }catch(e){
    // sessionStorage может быть недоступен — игнорируем
  }

  // Запрашиваем курс у exchangerate.host
  const res = await fetch(API_RATE_URL);
  if(!res.ok) throw new Error('Ошибка сети при получении курса');
  const data = await res.json();
  if(!data || !data.rates || typeof data.rates.RUB !== 'number') throw new Error('Неверный ответ API');
  const rate = data.rates.RUB;

  // Сохраним в кеш
  try{
    sessionStorage.setItem(RATE_CACHE_KEY, JSON.stringify({rate, timestamp: Date.now()}));
  }catch(e){}

  return rate;
}

// Простейшая функция для попытки определения времени заката/рассвета пользователя
// Сначала пробуем получить геолокацию по IP (ipapi.co), затем — время восхода/заката с sunrise-sunset.org.
// Если любой шаг не работает — используем запасной ночной интервал 19:00—07:00.
async function applyAutoThemeBasedOnSun(){
  try{
    // Получаем местоположение по IP
    const ipResp = await fetch('https://ipapi.co/json/');
    if(!ipResp.ok) throw new Error('ip lookup failed');
    const ipInfo = await ipResp.json();
    const lat = parseFloat(ipInfo.latitude);
    const lon = parseFloat(ipInfo.longitude);
    if(!lat || !lon) throw new Error('no coords');

    // Получаем времена рассвета/заката в формате ISO
    const sunResp = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
    if(!sunResp.ok) throw new Error('sun api failed');
    const sun = await sunResp.json();
    if(!sun.results) throw new Error('sun data missing');

    const now = new Date();
    const sunrise = new Date(sun.results.sunrise);
    const sunset = new Date(sun.results.sunset);

    // На северных широтах может быть полярный день/ночь; в этом случае оставим решение за системной темой
    if(isNaN(sunrise) || isNaN(sunset)) throw new Error('invalid sun times');

    // Если текущее время между sunset (сегодня) и sunrise (завтра) — включаем тёмную тему
    // Учтём корректно случай, когда sunrise > sunset (обычно sunrise на следующий день)
    let isNight = false;
    if(sunset < sunrise){
      // sunset сегодня, sunrise завтра
      if(now >= sunset || now <= sunrise) isNight = true;
    }else{
      // обычный случай (sunrise earlier today, sunset later today)
      if(now >= sunset || now <= sunrise) isNight = true;
    }

    if(isNight){
      document.documentElement.setAttribute('data-theme','dark');
    }else{
      document.documentElement.removeAttribute('data-theme');
    }
    return;
  }catch(e){
    // fallback: если не удалось — используем часы: 19:00—07:00
    const h = new Date().getHours();
    if(h >= 19 || h < 7){
      document.documentElement.setAttribute('data-theme','dark');
    }else{
      document.documentElement.removeAttribute('data-theme');
    }
  }
}

// Основная функция обработки клика
async function onConvert(){
  const input = document.getElementById('kzt-input');
  const errorBox = document.getElementById('error');
  const resultBox = document.getElementById('result');
  errorBox.hidden = true;
  resultBox.hidden = true;

  const rawVal = parseFloat(input.value);
  if(Number.isNaN(rawVal) || rawVal <= 0){
    errorBox.textContent = 'Введите корректную положительную сумму в тенге.';
    errorBox.hidden = false;
    return;
  }

  const btn = document.getElementById('convert-btn');
  btn.disabled = true;
  btn.textContent = 'Считаю...';

  try{
    const rate = await fetchRate();
    const rawRub = rawVal * rate;
    const withFee = rawRub * 1.08; // +8%
    const final = withFee + 100; // +100 ₽

    // Обновляем UI
    document.getElementById('rate').textContent = rate.toFixed(6);
    document.getElementById('raw-rub').textContent = fmtRub(rawRub);
    document.getElementById('with-fee').textContent = fmtRub(withFee);
    document.getElementById('final').textContent = fmtRub(final);
    resultBox.hidden = false;
  }catch(e){
    console.error(e);
    errorBox.textContent = 'Не удалось получить курс валют. Проверьте подключение к интернету.';
    errorBox.hidden = false;
  }finally{
    btn.disabled = false;
    btn.textContent = 'Конвертировать';
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', ()=>{
  // Привязки
  document.getElementById('convert-btn').addEventListener('click', onConvert);
  document.getElementById('kzt-input').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') onConvert();
  });

  // Автовключение тёмной темы по рассвет/закат + fallback
  applyAutoThemeBasedOnSun();

  // UX: если пользователь уже вводил значение — оставим его
  try{
    const prev = sessionStorage.getItem('last-kzt');
    if(prev) document.getElementById('kzt-input').value = prev;
  }catch(e){}

  // Сохраняем ввод при изменении
  document.getElementById('kzt-input').addEventListener('input', (e)=>{
    try{ sessionStorage.setItem('last-kzt', e.target.value); }catch(e){}
  });
});