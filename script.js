// ==== НАСТРОЙКИ ====

// URL твоего Apps Script веб-приложения (должен заканчиваться на /exec)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyTuDd_A9US0E44eAbTSgZQ62mDUi-QmN62-AOZYIvKyNWiSTqkx_MVwvQ6scZ7Mzfh/exec"; // вставь свой полный URL

// Тот же секретный токен, что и в Apps Script (const TOKEN = '...';)
const TOKEN = "1OQWK7qQKxJt5yM3Uabx44HPyMplnNqCzZ9Rq"; // замени на тот, что в Code.gs


// ==== РАБОЧИЙ КОД ====

// Находим элементы на странице
const statusEl = document.getElementById("status");
const shiftSelect = document.getElementById("shift-type");
const startBtn = document.getElementById("start-btn");
const endBtn = document.getElementById("end-btn");

/**
 * Обновление строки статуса под кнопками
 */
function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text || "";
  statusEl.style.color = isError ? "#fca5a5" : "#a3a3a3";
}

/**
 * Отправка события (начало/конец смены) в Apps Script
 * @param {"start"|"end"} type
 */
async function sendEvent(type) {
  if (!shiftSelect) {
    console.error("Нет select#shift-type в разметке");
    setStatus("Ошибка: не найден селектор смены.", true);
    return;
  }

  const shiftType = shiftSelect.value;   // 'morning' или 'evening'
  const ts = new Date().toISOString();  // текущее время в ISO

  setStatus("Отправляю...");

  try {
    // ВАЖНО:
    // - mode: "no-cors" → браузер не будет делать preflight OPTIONS
    // - без headers → Content-Type не указываем, чтобы не усложнять запрос
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        token: TOKEN,
        ts,         // отметка времени
        type,       // 'start' или 'end'
        shiftType   // 'morning' или 'evening'
      })
    });

    const label = type === "start" ? "начало" : "конец";
    const shiftLabel = shiftType === "morning" ? "утренняя" : "вечерняя";
    setStatus(`Запрос отправлен: ${label} (${shiftLabel}). Проверь таблицу.`);

  } catch (err) {
    console.error("Ошибка сети:", err);
    setStatus("Не удалось связаться с Google. Проверь SCRIPT_URL.", true);
  }
}

// Вешаем обработчики на кнопки
if (startBtn) {
  startBtn.addEventListener("click", () => sendEvent("start"));
} else {
  console.error("Нет кнопки #start-btn в разметке");
}

if (endBtn) {
  endBtn.addEventListener("click", () => sendEvent("end"));
} else {
  console.error("Нет кнопки #end-btn в разметке");
}

// На старте
setStatus("Готово. Выбери смену и нажми кнопку.");
