// Функция получения курса KZT → RUB с надежным CORS
async function fetchRate() {
    const CACHE_KEY = "kzt_rub_rate";
    const CACHE_TIME_KEY = "kzt_rub_rate_time";
    const CACHE_TTL = 60 * 60 * 1000; // 1 час

    // Проверяем кэш
    const cachedRate = sessionStorage.getItem(CACHE_KEY);
    const cachedTime = sessionStorage.getItem(CACHE_TIME_KEY);

    if (cachedRate && cachedTime && (Date.now() - cachedTime < CACHE_TTL)) {
        return parseFloat(cachedRate);
    }

    try {
        // Новый API, стабильный CORS
        const url = "https://open.er-api.com/v6/latest/KZT";
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Server error");
        }

        const data = await response.json();

        if (!data.rates || !data.rates.RUB) {
            throw new Error("Rate not found");
        }

        const rate = data.rates.RUB;

        // Кэшируем
        sessionStorage.setItem(CACHE_KEY, rate);
        sessionStorage.setItem(CACHE_TIME_KEY, Date.now());

        return rate;
    } catch (err) {
        console.error("Currency fetch error:", err);
        throw new Error("Не удалось получить курс валют.");
    }
}

// Основная логика конвертации
async function convert() {
    const input = document.getElementById("priceKZT");
    const result = document.getElementById("result");
    const value = parseFloat(input.value);

    if (isNaN(value) || value <= 0) {
        result.textContent = "Введите корректную сумму в тенге.";
        return;
    }

    result.textContent = "Загрузка…";

    try {
        const rate = await fetchRate();
        let rub = value * rate;

        // +8% посредникам
        rub *= 1.08;

        // +100 ₽ Steam
        rub += 100;

        const finalRub = Math.ceil(rub);

        result.textContent = `Примерно ${finalRub} ₽`;
    } catch (err) {
        result.textContent = "Ошибка: " + err.message + " Проверьте подключение.";
    }
}

// Тёмная тема (оставляем как есть, только выносим функцию)
function initAutoTheme() {
    const hour = new Date().getHours();
    const isNight = hour >= 19 || hour < 7;
    document.documentElement.classList.toggle("dark", isNight);
}

document.addEventListener("DOMContentLoaded", () => {
    initAutoTheme();
    document.getElementById("convertBtn").addEventListener("click", convert);
});
