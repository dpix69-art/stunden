(() => {
  "use strict";

  const DIVISION_480003 = "480003";
  const DIVISION_480001 = "480001";

  const TEMPLATE_7_12 = "480003_7_12";
  const TEMPLATE_7_16 = "480003_7_16";

  const STORAGE_KEYS = {
    ACTIVE_SHIFT: "shift_recorder_active_shift",
    COMPLETED: "shift_recorder_completed_v1",
  };

  const API_URL = "https://script.google.com/macros/s/AKfycbzxokr0UgE8jVNq2kFGLqtARXfdRQvKWbgU4w9bYrVhERLO7dPvMAaLk3kmpH0KqiRa/exec";

  let currentState = "IDLE";
  let activeShift = null;
  let completedShifts = [];
  let reviewSummary = null;
  let isSyncing = false;

  let screens = {};
  let statusIndicatorEl,
    statusTextEl,
    pendingBannerEl,
    historyButtonEl,
    historyBackButtonEl;

  let startButtonEl;

  let confirmTimeEl,
    confirmDateEl,
    confirmDivisionEl,
    confirmStartButtonEl,
    cancelStartButtonEl,
    templateSelectorEl,
    template712ButtonEl,
    template716ButtonEl;

  let activeStartTimeEl,
    activeDateEl,
    activeDivisionEl,
    activeTemplateRowEl,
    activeTemplateEl,
    activeChangeDivisionButtonEl,
    endButtonEl;

  let reviewDateEl,
    reviewDivisionEl,
    reviewStartEl,
    reviewEndEl,
    reviewPauseEl,
    reviewTotalEl,
    saveShiftButtonEl,
    editShiftButtonEl;

  let editFormEl,
    editDateEl,
    editStartEl,
    editEndEl,
    editDivisionEl,
    applyEditButtonEl,
    cancelEditButtonEl;

  let historyListEl;

  const ONE_CLICK_GUARD_MS = 600;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    loadFromStorage();
    bindEvents();
    switchInitialScreen();
    updateStatusIndicator();
    registerServiceWorker();
    setInterval(checkPlannedAutoComplete, 30000);
  }

  function cacheElements() {
    screens = {
      IDLE: document.getElementById("screen-idle"),
      START_CONFIRM: document.getElementById("screen-start-confirm"),
      ACTIVE: document.getElementById("screen-active"),
      END_REVIEW: document.getElementById("screen-end-review"),
      END_EDIT: document.getElementById("screen-end-edit"),
      SAVED: document.getElementById("screen-saved"),
      HISTORY: document.getElementById("screen-history"),
    };

    statusIndicatorEl = document.getElementById("status-indicator");
    statusTextEl = document.getElementById("status-text");
    pendingBannerEl = document.getElementById("pending-sync-banner");
    historyButtonEl = document.getElementById("history-button");
    historyBackButtonEl = document.getElementById("history-back-button");

    startButtonEl = document.getElementById("start-button");

    confirmTimeEl = document.getElementById("confirm-time");
    confirmDateEl = document.getElementById("confirm-date");
    confirmDivisionEl = document.getElementById("confirm-division");
    confirmStartButtonEl = document.getElementById("confirm-start-button");
    cancelStartButtonEl = document.getElementById("cancel-start-button");
    templateSelectorEl = document.getElementById("template-selector");
    template712ButtonEl = document.getElementById("template-7-12");
    template716ButtonEl = document.getElementById("template-7-16");

    activeStartTimeEl = document.getElementById("active-start-time");
    activeDateEl = document.getElementById("active-date");
    activeDivisionEl = document.getElementById("active-division");
    activeTemplateRowEl = document.getElementById("active-template-row");
    activeTemplateEl = document.getElementById("active-template");
    activeChangeDivisionButtonEl = document.getElementById(
      "active-change-division-button"
    );
    endButtonEl = document.getElementById("end-button");

    reviewDateEl = document.getElementById("review-date");
    reviewDivisionEl = document.getElementById("review-division");
    reviewStartEl = document.getElementById("review-start");
    reviewEndEl = document.getElementById("review-end");
    reviewPauseEl = document.getElementById("review-pause");
    reviewTotalEl = document.getElementById("review-total");
    saveShiftButtonEl = document.getElementById("save-shift-button");
    editShiftButtonEl = document.getElementById("edit-shift-button");

    editFormEl = document.getElementById("edit-form");
    editDateEl = document.getElementById("edit-date");
    editStartEl = document.getElementById("edit-start");
    editEndEl = document.getElementById("edit-end");
    editDivisionEl = document.getElementById("edit-division");
    applyEditButtonEl = document.getElementById("apply-edit-button");
    cancelEditButtonEl = document.getElementById("cancel-edit-button");

    historyListEl = document.getElementById("history-list");
  }

  function loadFromStorage() {
    try {
      const rawActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT);
      if (rawActive) {
        activeShift = JSON.parse(rawActive);
      }
    } catch (e) {
      console.error("Failed to parse active shift", e);
      activeShift = null;
    }

    try {
      const rawCompleted = localStorage.getItem(STORAGE_KEYS.COMPLETED);
      if (rawCompleted) {
        const arr = JSON.parse(rawCompleted);
        if (Array.isArray(arr)) {
          completedShifts = arr;
        } else {
          completedShifts = [];
        }
      }
    } catch (e) {
      console.error("Failed to parse completed shifts", e);
      completedShifts = [];
    }
  }

  function saveActiveShift() {
    if (!activeShift) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(activeShift));
  }

  function saveCompletedShifts() {
    localStorage.setItem(STORAGE_KEYS.COMPLETED, JSON.stringify(completedShifts));
  }

  function bindEvents() {
    window.addEventListener("online", () => {
      updateStatusIndicator();
      syncPendingShifts();
    });

    window.addEventListener("offline", () => {
      updateStatusIndicator();
    });

    historyButtonEl.addEventListener("click", () => {
      goToHistory();
    });

    historyBackButtonEl.addEventListener("click", () => {
      if (activeShift) {
        switchState("ACTIVE");
      } else {
        switchState("IDLE");
      }
    });

    startButtonEl.addEventListener(
      "click",
      withOneClickGuard(startButtonEl, handleStartPress)
    );

    confirmDivisionEl.addEventListener("change", handleConfirmDivisionChange);

    confirmStartButtonEl.addEventListener(
      "click",
      withOneClickGuard(confirmStartButtonEl, handleConfirmStart)
    );

    cancelStartButtonEl.addEventListener("click", () => {
      switchState("IDLE");
    });

    template712ButtonEl.addEventListener("click", () => {
      selectTemplate(TEMPLATE_7_12);
    });
    template716ButtonEl.addEventListener("click", () => {
      selectTemplate(TEMPLATE_7_16);
    });

    activeChangeDivisionButtonEl.addEventListener("click", () => {
      toggleActiveDivision();
    });

    endButtonEl.addEventListener(
      "click",
      withOneClickGuard(endButtonEl, handleEndPress)
    );

    saveShiftButtonEl.addEventListener(
      "click",
      withOneClickGuard(saveShiftButtonEl, handleSaveShift)
    );
    editShiftButtonEl.addEventListener("click", () => {
      goToEndEdit();
    });

    editFormEl.addEventListener("submit", (e) => {
      e.preventDefault();
      applyEdit();
    });

    applyEditButtonEl.addEventListener(
      "click",
      withOneClickGuard(applyEditButtonEl, () => {
        editFormEl.requestSubmit();
      })
    );

    cancelEditButtonEl.addEventListener("click", () => {
      if (reviewSummary) {
        renderEndReview();
        switchState("END_REVIEW");
      } else if (activeShift) {
        switchState("ACTIVE");
      } else {
        switchState("IDLE");
      }
    });
  }

  function withOneClickGuard(button, handler) {
    return function (event) {
      if (button.dataset.busy === "1") return;
      button.dataset.busy = "1";
      setTimeout(() => {
        button.dataset.busy = "";
      }, ONE_CLICK_GUARD_MS);
      handler(event);
    };
  }

  function switchInitialScreen() {
    if (activeShift) {
      renderActive();
      switchState("ACTIVE");
    } else {
      switchState("IDLE");
    }
    syncPendingShifts();
  }

  function switchState(newState) {
    currentState = newState;
    Object.keys(screens).forEach((key) => {
      const el = screens[key];
      if (!el) return;
      if (key === newState) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });
  }

  function handleStartPress() {
    const now = new Date();
    const timeStr = formatTimeHHMM(now);
    const dateStr = formatDateDDMMYYYY(now);
    confirmTimeEl.textContent = timeStr;
    confirmDateEl.textContent = dateStr;

    const hour = now.getHours();
    const inMorningWindow = hour >= 6 && hour < 9;
    const suggestedDivision = inMorningWindow ? DIVISION_480003 : DIVISION_480001;

    confirmDivisionEl.value = suggestedDivision;
    updateTemplateVisibilityForDivision(suggestedDivision);

    if (suggestedDivision === DIVISION_480003) {
      selectTemplate(TEMPLATE_7_12);
    } else {
      clearTemplateSelection();
    }

    switchState("START_CONFIRM");
  }

  function handleConfirmDivisionChange() {
    const division = confirmDivisionEl.value;
    updateTemplateVisibilityForDivision(division);
    if (division !== DIVISION_480003) {
      clearTemplateSelection();
    } else if (!getSelectedTemplate()) {
      selectTemplate(TEMPLATE_7_12);
    }
  }

  function updateTemplateVisibilityForDivision(division) {
    if (division === DIVISION_480003) {
      templateSelectorEl.classList.remove("hidden");
    } else {
      templateSelectorEl.classList.add("hidden");
    }
  }

  function selectTemplate(templateId) {
    template712ButtonEl.classList.toggle(
      "selected",
      templateId === TEMPLATE_7_12
    );
    template716ButtonEl.classList.toggle(
      "selected",
      templateId === TEMPLATE_7_16
    );
  }

  function clearTemplateSelection() {
    template712ButtonEl.classList.remove("selected");
    template716ButtonEl.classList.remove("selected");
  }

  function getSelectedTemplate() {
    if (template712ButtonEl.classList.contains("selected")) return TEMPLATE_7_12;
    if (template716ButtonEl.classList.contains("selected")) return TEMPLATE_7_16;
    return null;
  }

  function handleConfirmStart() {
    const now = new Date();
    const division = confirmDivisionEl.value;
    const template = division === DIVISION_480003 ? getSelectedTemplate() : null;

    const dateStr = formatDateDDMMYYYY(now);

    let plannedStartISO = null;
    let plannedEndISO = null;
    let mode = "manual";

    if (division === DIVISION_480003 && template) {
      mode = "planned";
      const start = new Date(now.getTime());
      start.setHours(7, 0, 0, 0);
      const end = new Date(now.getTime());
      if (template === TEMPLATE_7_12) {
        end.setHours(12, 0, 0, 0);
      } else if (template === TEMPLATE_7_16) {
        end.setHours(16, 0, 0, 0);
      }
      plannedStartISO = start.toISOString();
      plannedEndISO = end.toISOString();
    }

    activeShift = {
      id: "shift_" + now.getTime().toString(36),
      division,
      mode,
      startISO: now.toISOString(),
      template,
      plannedStartISO,
      plannedEndISO,
      date: dateStr,
    };

    saveActiveShift();
    renderActive();
    switchState("ACTIVE");
  }

  function renderActive() {
    if (!activeShift) return;

    const startDate = new Date(activeShift.startISO);
    const displayDate = formatDateDDMMYYYY(startDate);
    const displayTime = formatTimeHHMM(startDate);

    activeStartTimeEl.textContent = displayTime;
    activeDateEl.textContent = displayDate;
    activeDivisionEl.textContent = activeShift.division;

    if (activeShift.mode === "planned" && activeShift.template) {
      activeTemplateRowEl.classList.remove("hidden");
      activeTemplateEl.textContent =
        activeShift.template === TEMPLATE_7_12 ? "7:00–12:00" : "7:00–16:00";
    } else {
      activeTemplateRowEl.classList.add("hidden");
      activeTemplateEl.textContent = "";
    }
  }

  function toggleActiveDivision() {
    if (!activeShift) return;
    const newDivision =
      activeShift.division === DIVISION_480003 ? DIVISION_480001 : DIVISION_480003;

    activeShift.division = newDivision;

    if (newDivision === DIVISION_480001) {
      activeShift.mode = "manual";
      activeShift.template = null;
      activeShift.plannedStartISO = null;
      activeShift.plannedEndISO = null;
    } else {
      activeShift.mode = "manual";
      activeShift.template = null;
    }

    saveActiveShift();
    renderActive();
  }

  function handleEndPress() {
    if (!activeShift) return;

    const summary = buildSummaryForActiveShift(
      activeShift.mode === "planned" && !!activeShift.template
    );
    if (!summary) return;
    reviewSummary = summary;

    renderEndReview();
    switchState("END_REVIEW");
  }

  function buildSummaryForActiveShift(useTemplateTimes) {
    if (!activeShift) return null;

    let startISO = activeShift.startISO;
    let endISO = new Date().toISOString();
    let effectiveStartISO = startISO;
    let effectiveEndISO = endISO;

    if (
      useTemplateTimes &&
      activeShift.mode === "planned" &&
      activeShift.plannedStartISO &&
      activeShift.plannedEndISO
    ) {
      effectiveStartISO = activeShift.plannedStartISO;
      effectiveEndISO = activeShift.plannedEndISO;
      endISO = activeShift.plannedEndISO;
    }

    const startDate = new Date(effectiveStartISO);
    const endDate = new Date(effectiveEndISO);

    if (endDate <= startDate) {
      alert("End time is before start time.");
      return null;
    }

    const dateStr = activeShift.date || formatDateDDMMYYYY(startDate);
    const monthLabel = makeMonthLabel(startDate);

    const durationHours = (endDate - startDate) / (1000 * 60 * 60);
    let pauseHours = 0;

    if (
      activeShift.division === DIVISION_480003 &&
      activeShift.template === TEMPLATE_7_12
    ) {
      pauseHours = 0;
    } else if (durationHours >= 9) {
      pauseHours = 1;
    } else {
      pauseHours = 0;
    }

    const workedHours = Math.max(durationHours - pauseHours, 0);
    const roundedTotal = roundUpToHalf(workedHours);

    return {
      id: activeShift.id,
      date: dateStr,
      monthLabel,
      division: activeShift.division,
      start: formatTimeHHMM(startDate),
      end: formatTimeHHMM(endDate),
      pause: formatPauseLabel(pauseHours),
      totalHours: roundedTotal,
      rawStartISO: activeShift.startISO,
      rawEndISO: endISO,
      synced: false,
    };
  }

  function renderEndReview() {
    if (!reviewSummary) return;

    reviewDateEl.textContent = reviewSummary.date;
    reviewDivisionEl.textContent = reviewSummary.division;
    reviewStartEl.textContent = reviewSummary.start;
    reviewEndEl.textContent = reviewSummary.end;
    reviewPauseEl.textContent = reviewSummary.pause;
    reviewTotalEl.textContent = reviewSummary.totalHours.toFixed(1) + " h";
  }

  function goToEndEdit() {
    if (!reviewSummary) return;

    const [day, month, year] = reviewSummary.date.split(".");
    const dateISO = `${year}-${month}-${day}`;
    editDateEl.value = dateISO;
    editStartEl.value = toTimeInputValue(reviewSummary.start);
    editEndEl.value = toTimeInputValue(reviewSummary.end);
    editDivisionEl.value = reviewSummary.division;

    switchState("END_EDIT");
  }

  function applyEdit() {
    if (!reviewSummary) return;

    const dateValue = editDateEl.value;
    const startValue = editStartEl.value;
    const endValue = editEndEl.value;
    const divisionValue = editDivisionEl.value;

    if (!dateValue || !startValue || !endValue) {
      alert("Please fill date, start, and end.");
      return;
    }

    const [year, month, day] = dateValue.split("-");
    const dateStr = `${day}.${month}.${year}`;

    const startDate = new Date(dateValue + "T" + startValue + ":00");
    const endDate = new Date(dateValue + "T" + endValue + ":00");

    if (endDate <= startDate) {
      alert("End time must be after start time.");
      return;
    }

    const durationHours = (endDate - startDate) / (1000 * 60 * 60);
    let pauseHours = 0;

    if (
      divisionValue === DIVISION_480003 &&
      activeShift &&
      activeShift.template === TEMPLATE_7_12
    ) {
      pauseHours = 0;
    } else if (durationHours >= 9) {
      pauseHours = 1;
    } else {
      pauseHours = 0;
    }

    const workedHours = Math.max(durationHours - pauseHours, 0);
    const roundedTotal = roundUpToHalf(workedHours);

    reviewSummary = {
      ...reviewSummary,
      date: dateStr,
      monthLabel: makeMonthLabel(startDate),
      division: divisionValue,
      start: formatTimeHHMM(startDate),
      end: formatTimeHHMM(endDate),
      pause: formatPauseLabel(pauseHours),
      totalHours: roundedTotal,
      rawStartISO: startDate.toISOString(),
      rawEndISO: endDate.toISOString(),
    };

    renderEndReview();
    switchState("END_REVIEW");
  }

  function handleSaveShift() {
    if (!reviewSummary) return;

    completedShifts.push({ ...reviewSummary });
    saveCompletedShifts();

    activeShift = null;
    saveActiveShift();

    updateStatusIndicator();
    syncPendingShifts();

    switchState("SAVED");
    setTimeout(() => {
      if (!activeShift) switchState("IDLE");
      else switchState("ACTIVE");
    }, 1200);
  }

  function goToHistory() {
    renderHistory();
    switchState("HISTORY");
  }

  function renderHistory() {
    historyListEl.innerHTML = "";
    if (!completedShifts.length) {
      const p = document.createElement("p");
      p.textContent = "No shifts recorded yet.";
      p.className = "history-empty";
      historyListEl.appendChild(p);
      return;
    }

    const sorted = [...completedShifts].sort((a, b) => {
      if (!a.rawStartISO || !b.rawStartISO) return 0;
      return a.rawStartISO < b.rawStartISO ? 1 : -1;
    });

    let currentMonth = null;

    sorted.forEach((shift) => {
      if (shift.monthLabel !== currentMonth) {
        currentMonth = shift.monthLabel;
        const monthEl = document.createElement("div");
        monthEl.textContent = currentMonth;
        monthEl.className = "history-month";
        historyListEl.appendChild(monthEl);
      }

      const entryEl = document.createElement("div");
      entryEl.className = "history-entry";

      const leftEl = document.createElement("div");
      leftEl.className = "history-entry-left";

      const dateEl = document.createElement("span");
      dateEl.className = "history-entry-date";
      dateEl.textContent = shift.date;

      const divEl = document.createElement("span");
      divEl.className = "history-entry-division";
      divEl.textContent = shift.division;

      leftEl.appendChild(dateEl);
      leftEl.appendChild(divEl);

      const hoursEl = document.createElement("span");
      hoursEl.className = "history-entry-hours";
      hoursEl.textContent = shift.totalHours.toFixed(1) + " h";

      entryEl.appendChild(leftEl);
      entryEl.appendChild(hoursEl);

      historyListEl.appendChild(entryEl);
    });
  }

  function checkPlannedAutoComplete() {
    if (!activeShift) return;
    if (currentState !== "ACTIVE") return;
    if (activeShift.mode !== "planned") return;
    if (!activeShift.plannedEndISO) return;

    const now = new Date();
    const plannedEnd = new Date(activeShift.plannedEndISO);
    if (now >= plannedEnd) {
      const summary = buildSummaryForActiveShift(true);
      if (!summary) return;
      reviewSummary = summary;
      renderEndReview();
      switchState("END_REVIEW");
    }
  }

  function getApiToken() {
    if (typeof window !== "undefined" && window.SHIFT_API_TOKEN) {
      return String(window.SHIFT_API_TOKEN);
    }
    return "";
  }

  async function syncPendingShifts() {
    if (!navigator.onLine) {
      updateStatusIndicator();
      return;
    }
    if (isSyncing) return;

    const token = getApiToken();
    if (!token) {
      updateStatusIndicator();
      return;
    }

    const unsynced = completedShifts.filter((s) => !s.synced);
    if (!unsynced.length) {
      updateStatusIndicator();
      return;
    }

    isSyncing = true;
    updateStatusIndicator();

    try {
      for (const shift of completedShifts) {
        if (shift.synced) continue;

        const payload = {
          token,
          division: shift.division,
          date: shift.date,
          monthLabel: shift.monthLabel,
          start: shift.start,
          end: shift.end,
          pause: shift.pause,
          hours: shift.totalHours.toFixed(1),
          rawStartISO: shift.rawStartISO,
          rawEndISO: shift.rawEndISO,
        };

        let ok = false;
        try {
          const resp = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (resp.ok) {
            let data = null;
            try {
              data = await resp.json();
            } catch {
              data = null;
            }
            ok = data && data.ok === true;
          }
        } catch (err) {
          console.error("Sync error", err);
          ok = false;
        }

        if (ok) {
          shift.synced = true;
          saveCompletedShifts();
          updateStatusIndicator();
        } else {
          break;
        }
      }
    } finally {
      isSyncing = false;
      updateStatusIndicator();
    }
  }

  function updateStatusIndicator() {
    const offline = !navigator.onLine;
    const unsynced = completedShifts.filter((s) => !s.synced).length;

    statusIndicatorEl.classList.remove("online", "offline", "pending");

    if (offline) {
      statusIndicatorEl.classList.add("offline");
      statusTextEl.textContent = "Offline · saved locally";
    } else if (unsynced > 0 || isSyncing) {
      statusIndicatorEl.classList.add("pending");
      statusTextEl.textContent = isSyncing
        ? "Online · syncing…"
        : `Online · pending sync (${unsynced})`;
    } else {
      statusIndicatorEl.classList.add("online");
      statusTextEl.textContent = "Online · all synced";
    }

    if (unsynced > 0) {
      pendingBannerEl.classList.remove("hidden");
    } else {
      pendingBannerEl.classList.add("hidden");
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("sw.js")
      .catch((err) => console.error("SW registration failed", err));
  }

  // Utils

  function formatDateDDMMYYYY(d) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function formatTimeHHMM(d) {
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${mins}`;
  }

  function makeMonthLabel(d) {
    return new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
    }).format(d);
  }

  function roundUpToHalf(hours) {
    return Math.ceil(hours * 2 - 1e-9) / 2;
  }

  function formatPauseLabel(hours) {
    const h = Math.round(hours);
    const m = 0;
    return `${h}:${String(m).padStart(2, "0")}`;
  }

  function toTimeInputValue(hhmm) {
    const parts = hhmm.split(":");
    if (parts.length !== 2) return "";
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
})();
