let races = [];
let monthRaces = [];
let seenRaceIds = new Set();

function loadSeenRaceIds() {
  try {
    const stored = localStorage.getItem("seenRaceIds");
    if (stored) seenRaceIds = new Set(JSON.parse(stored));
  } catch (e) {
    seenRaceIds = new Set();
  }
}

function saveSeenRaceIds() {
  localStorage.setItem("seenRaceIds", JSON.stringify([...seenRaceIds]));
}

function isRaceSeen(athleteId, raceId) {
  return seenRaceIds.has(`${athleteId}:${raceId}`);
}

function markAllRacesSeen(athleteId, races) {
  races.forEach(r => seenRaceIds.add(`${athleteId}:${r.id}`));
  saveSeenRaceIds();
}

loadSeenRaceIds();

// Race dialog
const raceDialog = document.getElementById("raceDialog");
const raceDate = document.getElementById("raceDate");
const raceName = document.getElementById("raceName");
const raceLocation = document.getElementById("raceLocation");
const raceNotes = document.getElementById("raceNotes");
const saveRaceBtn = document.getElementById("saveRaceBtn");
const deleteRaceBtn = document.getElementById("deleteRaceBtn");
let editingRaceId = null;

// Race result dialog
const raceResultDialog = document.getElementById("raceResultDialog");
const raceResultInfo = document.getElementById("raceResultInfo");
const raceResultTime = document.getElementById("raceResultTime");
const raceResultPace = document.getElementById("raceResultPace");
const raceResultComment = document.getElementById("raceResultComment");
const saveRaceResultBtn = document.getElementById("saveRaceResultBtn");
let editingRaceResultId = null;
let editingRaceDistance = "";

function openRaceDialog(raceId) {
  editingRaceId = raceId;
  if (raceId) {
    const r = races.find((x) => x.id === raceId);
    if (!r) return;
    raceDate.value = r.date;
    raceName.value = r.name;
    raceLocation.value = r.location || "";
    document.getElementById("raceDistance").value = r.distance || "";
    document.getElementById("raceTerrain").value = r.terrain || "";
    document.getElementById("raceTargetTime").value = r.target_time || "";
    raceNotes.value = r.notes || "";
    if (deleteRaceBtn) deleteRaceBtn.hidden = false;
  } else {
    raceDate.value = formatDateISO(new Date());
    raceName.value = "";
    raceLocation.value = "";
    document.getElementById("raceDistance").value = "";
    document.getElementById("raceTerrain").value = "";
    document.getElementById("raceTargetTime").value = "";
    raceNotes.value = "";
    if (deleteRaceBtn) deleteRaceBtn.hidden = true;
  }
  raceDialog.showModal();
}

document.getElementById("openRaceBtn")?.addEventListener("click", () => openRaceDialog(null));

saveRaceBtn.addEventListener("click", async () => {
  const athleteId = getSelectedAthleteId();
  const data = {
    name: raceName.value.trim(),
    date: raceDate.value,
    location: raceLocation.value.trim(),
    distance: document.getElementById("raceDistance").value.trim(),
    terrain: document.getElementById("raceTerrain").value,
    target_time: document.getElementById("raceTargetTime").value.trim(),
    notes: raceNotes.value.trim(),
  };
  try {
    if (editingRaceId) {
      await updateRace(editingRaceId, data);
    } else {
      data.athlete_id = athleteId;
      await insertRace(data);
    }
    raceDialog.close();
    await loadNonTemplateData();
  } catch (e) {
    console.error(e);
  }
});


if (deleteRaceBtn) {
  deleteRaceBtn.addEventListener("click", async () => {
    if (!editingRaceId) return;
    try {
      await deleteRace(editingRaceId);
      raceDialog.close();
      await loadNonTemplateData();
    } catch (e) {
      console.error(e);
    }
  });
}

// Race result dialog
function openRaceResultDialog(raceId) {
  editingRaceResultId = raceId;
  const r = races.find((x) => x.id === raceId);
  if (!r) return;
  raceResultInfo.innerHTML = `<strong>${escapeHtml(r.name)}</strong><span>${r.date}${r.distance ? " · " + escapeHtml(r.distance) : ""}${r.location ? " · " + escapeHtml(r.location) : ""}${r.target_time ? " · Mērķis: " + escapeHtml(r.target_time) : ""}</span>`;
  editingRaceDistance = r.distance || "";
  raceResultTime.value = r.result_time || "";
  raceResultPace.value = r.result_pace || "";
  raceResultComment.value = r.result_comment || "";
  raceResultDialog.showModal();
}

saveRaceResultBtn.addEventListener("click", async () => {
  if (!editingRaceResultId) return;
  try {
    await updateRace(editingRaceResultId, {
      result_time: raceResultTime.value.trim(),
      result_pace: raceResultPace.value.trim(),
      result_comment: raceResultComment.value.trim(),
    });
    raceResultDialog.close();
    await loadNonTemplateData();
  } catch (e) {
    console.error(e);
  }
});

raceResultTime.addEventListener("input", () => {
  if (editingRaceDistance) {
    raceResultPace.value = calcPace(raceResultTime.value.trim(), editingRaceDistance);
  }
});

function getUpcomingRaces(allRaces) {
  return allRaces.filter((r) => !r.result_time);
}

function renderRaceTabFromRaces(allRaces, tab) {
  const athleteId = getSelectedAthleteId();
  const upcoming = getUpcomingRaces(allRaces).sort((a, b) => a.date < b.date ? -1 : 1);
  const past = allRaces.filter((r) => !!r.result_time).sort((a, b) => a.date < b.date ? 1 : -1);
  const races = tab === "upcoming" ? upcoming : past;
  const content = document.getElementById("raceCalendarContent");
  if (!races.length) {
    content.innerHTML = '<p class="muted">Nav sacensību.</p>';
    return;
  }
  const isAthleteOwner = (activeRole === "athlete") && currentUser.id === athleteId;
  content.innerHTML = races.map((r) => {
    const hasResult = !!r.result_time;
    return `
      <div class="race-list-item">
        <div class="race-list-main">
          <strong>${escapeHtml(r.name)}</strong>
          <span class="muted">${formatDateLV(r.date)}${r.location ? " · " + escapeHtml(r.location) : ""}</span>
          ${r.distance ? `<span class="race-dist-line"><strong class="race-distance">${escapeHtml(r.distance)}</strong>${r.terrain ? ` · ${escapeHtml(capitalize(r.terrain))}` : ""}</span>` : r.terrain ? `<span class="race-dist-line"><span class="race-distance">${escapeHtml(capitalize(r.terrain))}</span></span>` : ""}
        </div>
        <div class="race-list-details">
          ${tab === "upcoming"
            ? (r.target_time
              ? `<span class="chip-target">Mērķis: ${escapeHtml(r.target_time)}${r.target_pace ? " (" + escapeHtml(r.target_pace.replace(/\/km\s*$/i, "")) + "/km)" : ""}</span>`
              : `<span class="muted">— Nav mērķa</span>`)
            : (hasResult
              ? `<span class="chip-result">✅ ${escapeHtml(r.result_time)}${r.result_pace ? " (" + escapeHtml(r.result_pace.replace(/\/km\s*$/i, "")) + "/km)" : ""}</span>`
              : `<span class="muted">— Nav rezultāta</span>`)
          }
        </div>
        ${tab === "past" && r.result_comment ? `<div class="race-comment-block"><div class="race-comment-label">Komentārs pēc sacensībām</div><p class="race-notes">${escapeHtml(r.result_comment)}</p></div>` : ""}
        ${r.notes ? `<div class="race-comment-block"><div class="race-comment-label">Komentārs pirms sacensībām</div><p class="race-notes">${escapeHtml(r.notes)}</p></div>` : ""}
        ${isAthleteOwner ? `<div class="race-list-actions">
          <button class="secondary-action-sm" data-race-edit="${r.id}" type="button">✏️ Rediģēt</button>
          ${tab === "upcoming" && !hasResult
            ? `<button class="secondary-action-sm" data-race-log="${r.id}" type="button">📝 Pievienot rezultātu</button>`
            : ""}
        </div>` : ""}
      </div>
    `;
  }).join("");

  if (isAthleteOwner) {
    content.querySelectorAll("[data-race-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openRaceDialog(btn.dataset.raceEdit));
    });
    content.querySelectorAll("[data-race-log]").forEach((btn) => {
      btn.addEventListener("click", () => openRaceResultDialog(btn.dataset.raceLog));
    });
  }
}

function renderRaceTab(tab) {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;
  getRaces(athleteId).then((allRaces) => renderRaceTabFromRaces(allRaces, tab));
}

function updateRaceCalendarBadge(allRaces) {
  const panel = document.getElementById("raceCalendarPanel");
  if (!panel) return;
  const header = panel.querySelector(".panel-header");
  const athleteId = getSelectedAthleteId();
  if (activeRole === "coach" && athleteId) {
    const upcoming = getUpcomingRaces(allRaces);
    const unseen = upcoming.filter(r => !isRaceSeen(athleteId, r.id)).length;
    panel.classList.toggle("has-entries", unseen > 0);
    header.dataset.count = unseen > 9 ? "9+" : String(unseen);
  } else {
    panel.classList.toggle("has-entries", false);
  }
}

function refreshRaceCalendar() {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;
  getRaces(athleteId).then((allRaces) => {
    updateRaceCalendarBadge(allRaces);
    const activeTab = document.querySelector("#raceCalendarPanel [data-race-tab].active");
    renderRaceTabFromRaces(allRaces, activeTab ? activeTab.dataset.raceTab : "upcoming");
  });
}

function onRaceCalendarExpand() {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) {
    refreshRaceCalendar();
    return;
  }
  getRaces(athleteId).then((allRaces) => {
    if (activeRole === "coach") {
      markAllRacesSeen(athleteId, getUpcomingRaces(allRaces));
    }
    updateRaceCalendarBadge(allRaces);
    const activeTab = document.querySelector("#raceCalendarPanel [data-race-tab].active");
    renderRaceTabFromRaces(allRaces, activeTab ? activeTab.dataset.raceTab : "upcoming");
  });
}

document.querySelectorAll("#raceCalendarPanel [data-race-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#raceCalendarPanel [data-race-tab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderRaceTab(btn.dataset.raceTab);
  });
});
