// Автоматическая тёмная тема по системному времени (ночь/день)
(function applyThemeByTime() {
    const hour = new Date().getHours();
    // простая логика: ночь c 20:00 до 6:00
    if (hour < 6 || hour >= 20) {
        document.body.classList.add('dark');
    }
})();

const kztInput = document.getElementById('kzt');
const btn = document.getElementById('convertBtn');
const resultDiv = document.getElementById('result');

btn.addEventListener('click', async () => {
    const kzt = parseFloat(kztInput.value);
    if (isNaN(kzt) || kzt <= 0) {
        resultDiv.textContent = 'Введите корректную сумму в тенге.';
        return;
    }

    resultDiv.textContent = 'Загрузка курса…';

    try {
        // Используем бесплатный API для курса
        const resp = await fetch('https://api.exchangerate.host/convert?from=KZT&to=RUB&amount=' + kzt);
        const data = await resp.json();
        if (!data.success) {
            throw new Error('Ошибка получения курса');
        }
        let rub = data.result;

        // Добавляем 8% комиссию посредников
        rub *= 1.08;

        // Дополнительно +100 рублей на комиссии Steam
        rub += 100;

        resultDiv.textContent = 'Нужно положить на Steam ≈ ' + rub.toFixed(0) + ' RUB';
    } catch (e) {
        console.error(e);
        resultDiv.textContent = 'Ошибка при получении курса. Попробуйте позже.';
    }
});
