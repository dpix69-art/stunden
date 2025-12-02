// ВСТАВЬ сюда URL своего веб-приложения Apps Script:
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyrgynAxOGdKxGnQl0YwDp4wn4c8lIt_rTte1JVvSkFqMPm0IVRgjDxmYPVOdBuzsPH/exec";

// И тот же самый секрет, что и в Apps Script:
const TOKEN = "1OQWK7qQKxJt5yM3Uabx44HPyMplnNqCzZ9Rq";

const statusEl = document.getElementById("status");
const shiftSelect = document.getElementById("shift-type");
const startBtn = document.getElementById("start-btn");
const endBtn = document.getElementById("end-btn");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#fca5a5" : "#a3a3a3";
}

async function sendEvent(type) {
  const shiftType = shiftSelect.value;
  const ts = new Date().toISOString();

  setStatus("Отправляю...");

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: TOKEN,
        ts,
        type,      // 'start' | 'end'
        shiftType  // 'morning' | 'evening'
      })
    });

    const data = await res.json().catch(() => ({}));

    if (data.status === "ok") {
      const label = type === "start" ? "начало" : "конец";
      setStatus(`Записано: ${label} смены (${shiftType})`);
    } else {
      setStatus("Ошибка при записи. Попробуй ещё раз.", true);
      console.error("Error response:", data);
    }
  } catch (err) {
    setStatus("Не удалось связаться с Google. Проверь интернет.", true);
    console.error(err);
  }
}

startBtn.addEventListener("click", () => sendEvent("start"));
endBtn.addEventListener("click", () => sendEvent("end"));
