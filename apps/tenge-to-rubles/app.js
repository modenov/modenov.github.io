document.getElementById("convertBtn").addEventListener("click", async () => {
  const kzt = parseFloat(document.getElementById("kztInput").value);
  const resultEl = document.getElementById("result");
  const errorEl = document.getElementById("error");

  resultEl.textContent = "";
  errorEl.textContent = "";

  if (isNaN(kzt) || kzt <= 0) {
    errorEl.textContent = "Введите корректное число.";
    return;
  }

  try {
    const res = await fetch("https://api.exchangerate.host/latest?base=KZT&symbols=RUB");
    if (!res.ok) throw new Error("HTTP error");

    const data = await res.json();
    const rate = data.rates.RUB;

    if (!rate) throw new Error("Rate missing");

    let rub = kzt * rate;
    rub *= 1.08;
    rub += 100;

    resultEl.textContent = "Итого: " + Math.ceil(rub) + " ₽";
  } catch (e) {
    errorEl.textContent = "Ошибка получения курса. Попробуйте позже.";
  }
});
