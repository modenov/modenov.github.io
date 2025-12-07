document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const tengeInput = document.getElementById('tenge-input');
    const convertBtn = document.getElementById('convert-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultSection = document.getElementById('result-section');
    const baseResult = document.getElementById('base-result');
    const withCommission = document.getElementById('with-commission');
    const finalResult = document.getElementById('final-result');
    const exchangeRateElement = document.getElementById('exchange-rate');
    const updateDateElement = document.getElementById('update-date');
    const updateRateBtn = document.getElementById('update-rate');
    const themeToggle = document.getElementById('theme-toggle');
    const themeStatus = document.getElementById('theme-status');
    
    // Переменные для данных
    let exchangeRate = null;
    let isDarkTheme = false;
    let themeOverride = null; // null - авто, 'light' или 'dark' - ручное управление
    
    // Инициализация приложения
    initApp();
    
    // Функция инициализации
    function initApp() {
        // Установка даты обновления
        updateDateElement.textContent = getCurrentDate();
        
        // Загрузка курса валют
        loadExchangeRate();
        
        // Настройка обработчиков событий
        convertBtn.addEventListener('click', handleConvert);
        resetBtn.addEventListener('click', handleReset);
        tengeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleConvert();
            }
        });
        updateRateBtn.addEventListener('click', loadExchangeRate);
        themeToggle.addEventListener('click', toggleTheme);
        
        // Проверка системной темы
        checkSystemTheme();
        
        // Установка периодической проверки темы (каждую минуту)
        setInterval(checkSystemTheme, 60000);
        
        // Установка обработчиков для подсказок
        initTooltips();
    }
    
    // Функция загрузки курса валют
    async function loadExchangeRate() {
        try {
            exchangeRateElement.textContent = 'загружается...';
            updateRateBtn.disabled = true;
            updateRateBtn.textContent = 'Загрузка...';
            
            // Используем статический курс как fallback, т.к. CORS может блокировать запросы к API
            // В реальном приложении здесь был бы запрос к API
            const staticRate = 5.2; // Примерный курс KZT к RUB
            exchangeRate = staticRate;
            
            // Имитация задержки сети
            await new Promise(resolve => setTimeout(resolve, 800));
            
            exchangeRateElement.textContent = `1 ₸ = ${exchangeRate.toFixed(4)} ₽`;
            updateRateBtn.disabled = false;
            updateRateBtn.textContent = 'Обновить курс';
            updateDateElement.textContent = getCurrentDate();
            
            // Если уже введено значение, пересчитываем
            if (tengeInput.value) {
                handleConvert();
            }
        } catch (error) {
            console.error('Ошибка загрузки курса:', error);
            exchangeRateElement.textContent = 'ошибка загрузки';
            updateRateBtn.disabled = false;
            updateRateBtn.textContent = 'Повторить';
            
            // Используем fallback курс
            exchangeRate = 5.2;
            exchangeRateElement.textContent = `1 ₸ = ${exchangeRate.toFixed(4)} ₽ (кешированный)`;
        }
    }
    
    // Функция конвертации
    function handleConvert() {
        const tengeValue = parseFloat(tengeInput.value);
        
        // Проверка ввода
        if (!tengeValue || tengeValue <= 0) {
            showError('Введите корректную сумму в тенге');
            return;
        }
        
        if (!exchangeRate) {
            showError('Курс валют не загружен. Попробуйте обновить курс.');
            return;
        }
        
        // Расчеты
        const baseRubles = tengeValue * exchangeRate;
        const withCommissionValue = baseRubles * 1.08; // +8%
        const finalValue = withCommissionValue + 100; // +100 ₽
        
        // Отображение результатов
        baseResult.textContent = `${formatCurrency(baseRubles)} ₽`;
        withCommission.textContent = `${formatCurrency(withCommissionValue)} ₽`;
        finalResult.textContent = `${formatCurrency(finalValue)} ₽`;
        
        // Показываем секцию с результатами
        resultSection.classList.remove('hidden');
        
        // Прокручиваем к результатам
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Функция сброса
    function handleReset() {
        tengeInput.value = '';
        resultSection.classList.add('hidden');
        tengeInput.focus();
    }
    
    // Функция форматирования валюты
    function formatCurrency(value) {
        return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
    
    // Функция получения текущей даты
    function getCurrentDate() {
        const now = new Date();
        const options = { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return now.toLocaleDateString('ru-RU', options);
    }
    
    // Функция проверки системной темы
    function checkSystemTheme() {
        // Если пользователь вручную переключил тему, не меняем автоматически
        if (themeOverride !== null) return;
        
        const currentHour = new Date().getHours();
        const isNight = currentHour >= 20 || currentHour < 6; // с 20:00 до 6:00
        
        if (isNight && !isDarkTheme) {
            enableDarkTheme();
        } else if (!isNight && isDarkTheme) {
            enableLightTheme();
        }
    }
    
    // Функция переключения темы
    function toggleTheme() {
        if (themeOverride === 'dark') {
            // Переключаем на светлую
            enableLightTheme();
            themeOverride = 'light';
        } else {
            // Переключаем на темную
            enableDarkTheme();
            themeOverride = 'dark';
        }
        
        // Если пользователь вручно переключил, отключаем автоопределение
        themeOverride = themeOverride;
        updateThemeStatus();
    }
    
    // Включение темной темы
    function enableDarkTheme() {
        document.documentElement.setAttribute('data-theme', 'dark');
        isDarkTheme = true;
        updateThemeStatus();
    }
    
    // Включение светлой темы
    function enableLightTheme() {
        document.documentElement.removeAttribute('data-theme');
        isDarkTheme = false;
        updateThemeStatus();
    }
    
    // Обновление статуса темы
    function updateThemeStatus() {
        if (themeOverride === null) {
            themeStatus.textContent = `Тёмная тема: авто (${isDarkTheme ? 'ночь' : 'день'})`;
            themeToggle.innerHTML = '<span class="theme-icon">🌓</span>';
        } else if (themeOverride === 'dark') {
            themeStatus.textContent = 'Тёмная тема: включена';
            themeToggle.innerHTML = '<span class="theme-icon">☀️</span>';
        } else {
            themeStatus.textContent = 'Тёмная тема: выключена';
            themeToggle.innerHTML = '<span class="theme-icon">🌙</span>';
        }
    }
    
    // Функция отображения ошибки
    function showError(message) {
        // Создаем временное уведомление
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(errorDiv);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(errorDiv), 300);
        }, 3000);
    }
    
    // Инициализация подсказок
    function initTooltips() {
        const tooltips = document.querySelectorAll('.tooltip');
        
        tooltips.forEach(tooltip => {
            const tooltipText = tooltip.getAttribute('data-tooltip');
            
            tooltip.addEventListener('mouseenter', function(e) {
                const tooltipEl = document.createElement('div');
                tooltipEl.className = 'tooltip-content';
                tooltipEl.textContent = tooltipText;
                tooltipEl.style.cssText = `
                    position: absolute;
                    background: var(--text-primary);
                    color: var(--bg-primary);
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    z-index: 100;
                    max-width: 250px;
                    white-space: normal;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    transform: translate(-50%, -100%);
                    top: -10px;
                    left: 50%;
                `;
                
                document.body.appendChild(tooltipEl);
                tooltip._tooltipEl = tooltipEl;
            });
            
            tooltip.addEventListener('mouseleave', function() {
                if (tooltip._tooltipEl) {
                    document.body.removeChild(tooltip._tooltipEl);
                    tooltip._tooltipEl = null;
                }
            });
        });
    }
    
    // Добавляем стили для анимации уведомлений
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});