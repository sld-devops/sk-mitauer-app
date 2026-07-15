let healthEntries = [];
let editingHealthId = null;
let seenHealthIds = new Set();

function loadSeenHealthIds() {
  try {
    const stored = localStorage.getItem("seenHealthIds");
    if (stored) seenHealthIds = new Set(JSON.parse(stored));
  } catch (e) {
    seenHealthIds = new Set();
  }
}

function saveSeenHealthIds() {
  localStorage.setItem("seenHealthIds", JSON.stringify([...seenHealthIds]));
}

function isHealthSeen(entryId) {
  return seenHealthIds.has(entryId);
}

function markAllHealthSeen(entries) {
  entries.forEach(e => seenHealthIds.add(e.id));
  saveSeenHealthIds();
}

loadSeenHealthIds();

function renderHealthJournal() {
  const body = document.getElementById("healthJournalBody");
  if (!body) return;
  const athleteId = getSelectedAthleteId();
  const isAthleteOwner = currentUser.id === athleteId && activeRole !== "coach";

  let html = "";

  if (!healthEntries.length) {
    html += `<p class="muted">Nav ierakstu.</p>`;
  } else {
    html += `<div class="health-list">`;
    healthEntries.forEach(e => {
      const dateLabel = e.end_date
        ? `${e.start_date} – ${e.end_date}`
        : e.start_date;
      const noTrainingBadge = e.trainings_not_done
        ? `<span class="health-no-trainings-badge">⛔ Treniņi netiek veikti</span>`
        : "";
      html += `<div class="health-entry${isAthleteOwner ? " health-clickable" : ""}" data-health-id="${e.id}">
        <div class="health-entry-header">
          <span class="health-entry-date">${dateLabel}</span>
          ${noTrainingBadge}
        </div>
        <div class="health-entry-text">${escapeHtml(e.description)}</div>
      </div>`;
    });
    html += `</div>`;
  }

  if (isAthleteOwner) {
    html += `<button id="addHealthEntryBtn" class="secondary-action panel-add-btn" type="button">Pievienot</button>`;
  }

  body.innerHTML = html;

  document.getElementById("addHealthEntryBtn")?.addEventListener("click", () => openHealthDialog(null));
  if (isAthleteOwner) {
    body.querySelectorAll("[data-health-id]").forEach(el => {
      el.addEventListener("click", () => openHealthDialog(el.dataset.healthId));
    });
  }

  const panel = document.getElementById("healthJournalPanel");
  if (panel) {
    const header = panel.querySelector(".panel-header");
    if (activeRole === "coach") {
      const unseen = healthEntries.filter(e => !isHealthSeen(e.id)).length;
      panel.classList.toggle("has-entries", unseen > 0);
      if (header) {
        header.dataset.count = unseen > 9 ? "9+" : String(unseen);
      }
    } else {
      panel.classList.toggle("has-entries", false);
      if (header) {
        header.dataset.count = "0";
      }
    }
  }
}

function openHealthDialog(entryId) {
  editingHealthId = entryId;
  const hjStartDate = document.getElementById("hjStartDate");
  const hjEndDate = document.getElementById("hjEndDate");
  const hjDescription = document.getElementById("hjDescription");
  const hjNoTrainings = document.getElementById("hjNoTrainings");
  const deleteBtn = document.getElementById("deleteHealthBtn");

  if (entryId) {
    const e = healthEntries.find(h => h.id === entryId);
    if (!e) return;
    hjStartDate.value = e.start_date;
    hjEndDate.value = e.end_date || "";
    hjDescription.value = e.description;
    hjNoTrainings.checked = e.trainings_not_done;
    deleteBtn.hidden = false;
  } else {
    hjStartDate.value = formatDateISO(new Date());
    hjEndDate.value = "";
    hjDescription.value = "";
    hjNoTrainings.checked = false;
    deleteBtn.hidden = true;
  }
  document.getElementById("hjNoTrainingsRow").hidden = activeRole !== "coach";
  document.getElementById("healthDialog").showModal();
}

document.getElementById("saveHealthBtn")?.addEventListener("click", async () => {
  const athleteId = getSelectedAthleteId();
  const startDate = document.getElementById("hjStartDate").value;
  const endDate = document.getElementById("hjEndDate").value || null;
  const description = document.getElementById("hjDescription").value.trim();
  const trainingsNotDone = document.getElementById("hjNoTrainings").checked;

  if (!startDate) return;
  if (!description) return;

  const data = {
    athlete_id: athleteId,
    start_date: startDate,
    end_date: endDate,
    description,
    trainings_not_done: trainingsNotDone,
  };

  try {
    if (editingHealthId) {
      await updateHealthEntry(editingHealthId, data);
    } else {
      await insertHealthEntry(data);
    }
    document.getElementById("healthDialog").close();
    healthEntries = await getHealthEntries(athleteId);
    await refreshAthleteHealthSet();
    render();
  } catch (e) {
    console.error(e);
  }
});

document.getElementById("deleteHealthBtn")?.addEventListener("click", async () => {
  if (!editingHealthId) return;
  if (!confirm("Dzēst šo ierakstu?")) return;
  try {
    await deleteHealthEntry(editingHealthId);
    document.getElementById("healthDialog").close();
    healthEntries = await getHealthEntries(getSelectedAthleteId());
    await refreshAthleteHealthSet();
    render();
  } catch (e) {
    console.error(e);
  }
});
