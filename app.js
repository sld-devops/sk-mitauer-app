const days = [
  "Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena",
  "Piektdiena", "Sestdiena", "Svētdiena",
];

let selectedSource = "template";
let selectedTemplateId = null;
let activeRole = "athlete";
let calendarMode = "desktop";
let templateFilter = "athlete";

// check for existing session on load
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    currentUser = data.session.user;
    currentProfile = await getProfile(currentUser.id);
    if (!currentProfile) {
      await supabase.auth.signOut();
      currentUser = null;
      showAuth();
      const authErrorEl = document.getElementById("authError");
      authErrorEl.textContent = "Profils neeksistē. Sazinies ar administratoru.";
      authErrorEl.hidden = false;
      return;
    }
    await initApp();
    showApp();
  } else {
    showAuth();
  }
})();
let pendingCustomDay = null;
let pendingCustomTod = "";

let currentWeekStart = getMonday(new Date());
let viewMode = "week";
const TOD_ORDER = { morning: 0, afternoon: 1, evening: 2 };
let athletes = [];
let templates = [];
let plans = [];
let races = [];
let records = [];
let logEntries = [];
let weeklyStats = null;
let monthlyRunKm = 0;
let monthlyRunMin = 0;
let statsPeriod = "week";
let trendWeeks = 8;
let trendMonths = 6;
let weeklyTrend = [];
let monthlyTrend = [];
let dayNotes = [];
let loadGen = 0;
let weeklySummary = null;
let currentMonthDate = new Date();
let monthPlans = [];
let monthRaces = [];
let monthLogEntries = [];
let monthDayNotes = [];
let restrictions = [];
let diaryEntries = [];
let athleteNextWeeksPlans = {};
let readDiaryEntryIds = new Set();

function loadReadDiaryIds() {
  try {
    const stored = localStorage.getItem("readDiaryEntryIds");
    if (stored) readDiaryEntryIds = new Set(JSON.parse(stored));
  } catch (e) {
    readDiaryEntryIds = new Set();
  }
}

function saveReadDiaryIds() {
  localStorage.setItem("readDiaryEntryIds", JSON.stringify([...readDiaryEntryIds]));
}

function isEntryRead(athleteId, entryId) {
  return readDiaryEntryIds.has(`${athleteId}:${entryId}`);
}

function markAllEntriesRead(athleteId, entries) {
  entries.forEach(e => readDiaryEntryIds.add(`${athleteId}:${e.id}`));
  saveReadDiaryIds();
}

loadReadDiaryIds();

const athleteSelect = document.getElementById("athleteSelect");
const athleteSelectorPanel = document.getElementById("athleteSelectorPanel");
const calendarGrid = document.getElementById("calendarGrid");
const cooldownDuration = document.getElementById("cooldownDuration");
const cooldownPulse = document.getElementById("cooldownPulse");
const cooldownFields = document.getElementById("cooldownFields");
const cooldownToggleRow = document.getElementById("cooldownToggleRow");
const customBuilder = document.getElementById("customBuilder");
const customFreeText = document.getElementById("customFreeText");
const customPreview = document.getElementById("customPreview");
const customType = document.getElementById("customType");
const drillsRow = document.getElementById("drillsRow");
const editTemplateDialog = document.getElementById("editTemplateDialog");
const freeTextRow = document.getElementById("freeTextRow");
const includeCooldown = document.getElementById("includeCooldown");
const includeDrills = document.getElementById("includeDrills");
const includeWarmup = document.getElementById("includeWarmup");
const intervalFields = document.getElementById("intervalFields");
const intervalLength = document.getElementById("intervalLength");
const intervalPace = document.getElementById("intervalPace");
const mainDuration = document.getElementById("mainDuration");
const mainFields = document.getElementById("mainFields");
const mainPulse = document.getElementById("mainPulse");
const profileCard = document.getElementById("profileCard");
const repeatCount = document.getElementById("repeatCount");
const restDuration = document.getElementById("restDuration");
const saveTemplateDialog = document.getElementById("saveTemplateDialog");
const saveTemplateSummary = document.getElementById("saveTemplateSummary");
const insertOnlyButton = document.getElementById("insertOnlyButton");
const saveAndInsertButton = document.getElementById("saveAndInsertButton");
const templateList = document.getElementById("templateList");
const templatePicker = document.getElementById("templatePicker");
const trainingPickerPanel = document.getElementById("trainingPickerPanel");
const warmupDuration = document.getElementById("warmupDuration");
const warmupFields = document.getElementById("warmupFields");
const warmupPulse = document.getElementById("warmupPulse");
const warmupToggleRow = document.getElementById("warmupToggleRow");
const weekLabel = document.getElementById("weekLabel");
const weekPrev = document.getElementById("weekPrev");
const weekNext = document.getElementById("weekNext");
const statsBar = document.getElementById("statsBar");
const profileCoachSection = document.getElementById("profileCoachSection");
const recordDialog = document.getElementById("recordDialog");
const recordDistSelect = document.getElementById("recordDistSelect");
const recordTimeInput = document.getElementById("recordTimeInput");
const recordLocation = document.getElementById("recordLocation");
const recordCompetition = document.getElementById("recordCompetition");
const recordDate = document.getElementById("recordDate");
const saveRecordBtn = document.getElementById("saveRecordBtn");
const deleteRecordBtn = document.getElementById("deleteRecordBtn");

function getMonday(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(d) {
  return d.toISOString().split("T")[0];
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatPulse(pulse) {
  const cleanPulse = pulse.trim();
  return cleanPulse ? `, pulss ${cleanPulse}` : "";
}

function calcPace(timeStr, distanceStr) {
  if (!timeStr || !distanceStr) return "";
  const totalSec = parseTimeToSec(timeStr);
  if (!totalSec) return "";
  let distKm = 0;
  if (distanceStr.includes("jūdze") || distanceStr.includes("mile")) distKm = 1.609;
  else distKm = parseFloat(distanceStr) || 0;
  if (!distKm) return "";
  const paceSec = totalSec / distKm;
  const min = Math.floor(paceSec / 60);
  const sec = Math.round(paceSec % 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDateLV(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
}

function parseTimeToSec(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function formatPart(label, duration, pulse) {
  const dur = duration.trim();
  if (!dur) return "";
  const durShort = dur.replace(/\s*min\s*/i, "'");
  const pulseStr = pulse.trim().replace(/\s*sr\s*$/i, "").trim();
  const pulsePart = pulseStr ? `; ${pulseStr}sr` : "";
  return `${label}: ${durShort}${pulsePart}`;
}

function getDrillsPart() {
  return includeDrills.checked ? "Drill" : "";
}

function getGeneratedTraining() {
  const type = customType.value;

  if (type === "Cits") {
    return { title: "Cits", details: customFreeText.value.trim() };
  }

  const isEasyOrLong = type === "Vieglais skrējiens" || type === "Garais skrējiens";
  const isSimple = type === "VFS" || type === "SFS";
  const isVelo = type === "Velo";

  const warmup = isEasyOrLong
    ? (includeWarmup.checked ? formatPart("Iesildīšanās", warmupDuration.value, warmupPulse.value) : "")
    : (isSimple || isVelo) ? "" : formatPart("Iesildīšanās", warmupDuration.value, warmupPulse.value);
  const drills = (isEasyOrLong || isSimple || isVelo) ? "" : getDrillsPart();
  const cooldown = isEasyOrLong
    ? (includeCooldown.checked ? formatPart("Atsildīšanās", cooldownDuration.value, cooldownPulse.value) : "")
    : (isSimple || isVelo) ? "" : formatPart("Atsildīšanās", cooldownDuration.value, cooldownPulse.value);
  const lines = [warmup, drills].filter(Boolean);

  if (type === "Intervāli") {
    const count = repeatCount.value.trim();
    const len = intervalLength.value.trim();
    const pace = intervalPace.value.trim();
    const rest = restDuration.value.trim();
    let main = "Pamatdaļa: ";
    if (count && len) main += `${count}x${len}`;
    if (pace) main += ` (${pace.replace("/km", "").trim()})`;
    if (rest) main += `; caur ${rest.replace(/\s*min\s*/i, "'")}`;
    lines.push(main);
  } else {
    const mainLabel = isVelo ? "Velo" : "Pamatdaļa";
    const main = (isSimple || isVelo)
      ? (mainDuration.value.trim() ? `${mainLabel}: ${mainDuration.value.trim().replace(/\s*min\s*/i, "'")}` : "")
      : formatPart(mainLabel, mainDuration.value, mainPulse.value);
    if (main) lines.push(main);
  }

  if (cooldown) lines.push(cooldown);

  return { title: type, details: lines.join("\n") };
}

function getEditTraining() {
  const type = document.getElementById("editTrainingType").value;

  if (type === "Cits") {
    return { title: "Cits", details: document.getElementById("editFreeText").value.trim() };
  }

  const isEasyOrLong = type === "Vieglais skrējiens" || type === "Garais skrējiens";
  const isSimple = type === "VFS" || type === "SFS";
  const isVelo = type === "Velo";

  const includeWarmup = document.getElementById("editIncludeWarmup");
  const includeCooldown = document.getElementById("editIncludeCooldown");
  const warmupPulse = document.getElementById("editWarmupPulse");
  const cooldownPulse = document.getElementById("editCooldownPulse");
  const warmupDuration = document.getElementById("editWarmupDuration");
  const cooldownDuration = document.getElementById("editCooldownDuration");

  function formatPart(label, duration, pulse) {
    const dur = duration.value.trim();
    if (!dur) return "";
    const durShort = dur.replace(/\s*min\s*/i, "'");
    const pulseStr = pulse.value.trim().replace(/\s*sr\s*$/i, "").trim();
    const pulsePart = pulseStr ? `; ${pulseStr}sr` : "";
    return `${label}: ${durShort}${pulsePart}`;
  }

  const warmup = isEasyOrLong
    ? (includeWarmup.checked ? formatPart("Iesildīšanās", warmupDuration, warmupPulse) : "")
    : (isSimple || isVelo) ? "" : formatPart("Iesildīšanās", warmupDuration, warmupPulse);
  const drills = (isEasyOrLong || isSimple || isVelo) ? "" : (document.getElementById("editIncludeDrills").checked ? "Drill" : "");
  const cooldown = isEasyOrLong
    ? (includeCooldown.checked ? formatPart("Atsildīšanās", cooldownDuration, cooldownPulse) : "")
    : (isSimple || isVelo) ? "" : formatPart("Atsildīšanās", cooldownDuration, cooldownPulse);
  const lines = [warmup, drills].filter(Boolean);

  if (type === "Intervāli") {
    const count = document.getElementById("editRepeatCount").value.trim();
    const len = document.getElementById("editIntervalLength").value.trim();
    const pace = document.getElementById("editIntervalPace").value.trim();
    const rest = document.getElementById("editRestDuration").value.trim();
    let main = "Pamatdaļa: ";
    if (count && len) main += `${count}x${len}`;
    if (pace) main += ` (${pace.replace("/km", "").trim()})`;
    if (rest) main += `; caur ${rest.replace(/\s*min\s*/i, "'")}`;
    lines.push(main);
  } else {
    const mainLabel = isVelo ? "Velo" : "Pamatdaļa";
    const mainDuration = document.getElementById("editMainDuration");
    const mainPulse = document.getElementById("editMainPulse");
    const main = (isSimple || isVelo)
      ? (mainDuration.value.trim() ? `${mainLabel}: ${mainDuration.value.trim().replace(/\s*min\s*/i, "'")}` : "")
      : formatPart(mainLabel, mainDuration, mainPulse);
    if (main) lines.push(main);
  }

  if (cooldown) lines.push(cooldown);

  return { title: type, details: lines.join("\n") };
}

function getSelectedTraining() {
  if (selectedSource === "template") {
    const t = templates.find((t) => t.id === selectedTemplateId) || templates[0];
    return t ? { title: t.name, details: t.details } : null;
  }
  return getGeneratedTraining();
}

function getSelectedAthleteId() {
  return athleteSelect.value;
}

function getWeekLabel(date) {
  const monday = getMonday(date);
  const sunday = addDays(monday, 6);
  const formatter = new Intl.DateTimeFormat("lv-LV", { day: "numeric", month: "long" });
  return `${formatter.format(monday)} - ${formatter.format(sunday)}`;
}

function getWeekEnd(weekStart) {
  return addDays(weekStart, 6);
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

const monthNamesLV = [
  "Janvāris", "Februāris", "Marts", "Aprīlis", "Maijs", "Jūnijs",
  "Jūlijs", "Augusts", "Septembris", "Oktobris", "Novembris", "Decembris",
];

function getMonthNameLV(date) {
  return monthNamesLV[date.getMonth()] + " " + date.getFullYear();
}

async function loadAllData() {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;

  try {
    templates = await getTemplates(templateFilter === "all" ? null : athleteId);
    if (templateFilter === "athlete") {
      templates = templates.filter((t) => t.athlete_id === athleteId);
    } else {
      templates = templates.filter((t) => !t.athlete_id);
    }
  } catch (e) {
    templates = [];
  }

  await loadNonTemplateData();
}

async function loadNonTemplateData() {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;

  const weekStart = currentWeekStart;
  const weekEnd = getWeekEnd(weekStart);
  const weekStartStr = formatDateISO(weekStart);
  const weekEndStr = formatDateISO(weekEnd);

  try {
    plans = await getPlans(athleteId, weekStartStr, weekEndStr);
  } catch (e) {
    plans = [];
  }

  try {
    races = await getRacesForWeek(athleteId, weekStartStr, weekEndStr);
  } catch (e) {
    races = [];
  }

  try {
    logEntries = await getLogEntries(athleteId, weekStartStr, weekEndStr);
  } catch (e) {
    logEntries = [];
  }

  try {
    records = await getRecords(athleteId);
  } catch (e) {
    records = [];
  }

  try {
    weeklyStats = await getWeeklyStats(athleteId, weekStartStr, weekEndStr);
  } catch (e) {
    weeklyStats = null;
  }

  try {
    const monthStart = formatDateISO(getMonthStart(weekStart));
    const monthEnd = formatDateISO(getMonthEnd(weekStart));
    monthlyRunKm = await getMonthlyRunKm(athleteId, monthStart, monthEnd);
  } catch (e) {
    monthlyRunKm = 0;
  }

  try {
    const monthStart = formatDateISO(getMonthStart(weekStart));
    const monthEnd = formatDateISO(getMonthEnd(weekStart));
    monthlyRunMin = await getMonthlyRunDuration(athleteId, monthStart, monthEnd);
  } catch (e) {
    monthlyRunMin = 0;
  }

  try {
    weeklyTrend = await getWeeklyTrend(athleteId, trendWeeks);
  } catch (e) {
    weeklyTrend = [];
  }

  try {
    monthlyTrend = await getMonthlyTrend(athleteId, trendMonths);
  } catch (e) {
    monthlyTrend = [];
  }

  try {
    dayNotes = await getDayNotes(athleteId, weekStartStr, weekEndStr);
  } catch (e) {
    dayNotes = [];
  }

  try {
    weeklySummary = await getWeeklySummary(athleteId, weekStartStr);
  } catch (e) {
    weeklySummary = null;
  }

  try {
    restrictions = await getRestrictions(athleteId);
  } catch (e) {
    restrictions = [];
  }

  try {
    diaryEntries = await getDiaryEntries(athleteId);
  } catch (e) {
    diaryEntries = [];
  }

  if (viewMode === "month") {
    const monthStart = getMonthStart(currentMonthDate);
    const monthEnd = getMonthEnd(currentMonthDate);
    const ms = formatDateISO(monthStart);
    const me = formatDateISO(monthEnd);
    try { monthPlans = await getPlans(athleteId, ms, me); } catch (e) { monthPlans = []; }
    try { monthRaces = await getRacesForWeek(athleteId, ms, me); } catch (e) { monthRaces = []; }
    try { monthLogEntries = await getLogEntries(athleteId, ms, me); } catch (e) { monthLogEntries = []; }
    try { monthDayNotes = await getDayNotes(athleteId, ms, me); } catch (e) { monthDayNotes = []; }
  }

  await loadWeekOverviewPlanData();
  render();
}

async function loadWeekOverviewPlanData() {
  if (activeRole !== "coach") return;
  athleteNextWeeksPlans = {};
  const monday = getMonday(new Date());
  const endDate = addDays(monday, 28);
  const startStr = formatDateISO(monday);
  const endStr = formatDateISO(endDate);
  for (const a of athletes) {
    try {
      athleteNextWeeksPlans[a.id] = await getPlans(a.id, startStr, endStr);
    } catch (e) {
      athleteNextWeeksPlans[a.id] = [];
    }
  }
}

async function initApp() {
  try {
    activeRole = currentProfile?.role === "coach" ? "coach" : "athlete";
    trainingPickerPanel.hidden = activeRole !== "coach";
    athleteSelectorPanel.hidden = activeRole !== "coach";
    athletes = activeRole === "coach" ? await getAthletes() : [currentProfile];

    if (activeRole === "coach" && athletes.length && !athleteSelect.value) {
      athleteSelect.value = athletes[0].id;
    }

    if (activeRole === "athlete") {
      athleteSelect.value = currentUser.id;
    }

    renderAthleteDropdown();

    loadAllData();
  } catch (e) {
    console.error("initApp error:", e);
  }
}

window.initApp = initApp;

function renderAthleteDropdown() {
  const trigger = document.getElementById("dropdownTrigger");
  const list = document.getElementById("dropdownList");
  const selected = document.getElementById("dropdownSelected");

  // Preserve current selection before repopulating options
  const currentValue = athleteSelect.value;

  // Populate hidden select for ALL roles so .value persists
  athleteSelect.innerHTML = athletes.map(a => `<option value="${a.id}"></option>`).join("");

  // Restore selection after repopulating
  if (currentValue) {
    athleteSelect.value = currentValue;
  }

  if (!athleteSelect.value && activeRole === "athlete" && currentUser) {
    athleteSelect.value = currentUser.id;
  }

  if (activeRole !== "coach" || !athletes.length) {
    if (trigger) trigger.hidden = true;
    if (list) list.innerHTML = "";
    return;
  }
  if (trigger) trigger.hidden = false;
  if (!trigger || !list || !selected) return;

  const monday = getMonday(new Date());

  function weekIndicators(plans) {
    return [0, 1, 2, 3]
      .map((i) => {
        const start = addDays(monday, i * 7);
        const end = addDays(start, 6);
        const hasPlan = plans.some(
          (p) => p.date >= formatDateISO(start) && p.date <= formatDateISO(end)
        );
        return `<span class="week-slot ${hasPlan ? "week-slot-done" : ""}">${hasPlan ? "✓" : ""}</span>`;
      })
      .join("");
  }

  if (athleteSelect.value) {
    const selectedAthlete = athletes.find((a) => a.id === athleteSelect.value);
    const selectedPlans = athleteNextWeeksPlans[athleteSelect.value] || [];
    selected.innerHTML = selectedAthlete
      ? `<span class="athlete-name">${selectedAthlete.full_name}</span><span class="athlete-indicators">${weekIndicators(selectedPlans)}</span>`
      : "";
  }

  list.innerHTML = athletes
    .map((a) => {
      const plans = athleteNextWeeksPlans[a.id] || [];
      const isSelected = a.id === athleteSelect.value;
      return `<div class="athlete-row ${isSelected ? "selected" : ""}" data-athlete-id="${a.id}">
        <span class="athlete-name">${a.full_name}</span>
        <span class="athlete-indicators">${weekIndicators(plans)}</span>
      </div>`;
    })
    .join("");
}

function renderTemplates() {
  const filtered = templateFilter === "all"
    ? templates.filter(t => !t.athlete_id)
    : templates.filter(t => t.athlete_id === getSelectedAthleteId());
  templateList.innerHTML = filtered
    .map(
      (t) =>
        `<div class="template-button-wrap">
          <button class="template-button ${t.id === selectedTemplateId ? "active" : ""}" data-template="${t.id}" type="button">
            <strong>${t.name}</strong>
            <span>${(t.details || "").replace(/\n/g, " · ")}${t.athlete_id ? " (tikai sportistam)" : ""}</span>
          </button>
          ${activeRole === "coach" ? `<button class="edit-template-btn" data-edit-template="${t.id}" type="button">✏️</button>` : ""}
          <button class="delete-template-btn" data-delete-template="${t.id}" type="button">×</button>
        </div>`
    )
    .join("");

  if (filtered.length && !selectedTemplateId) {
    selectedTemplateId = filtered[0].id;
  }
}

function renderCustomPreview() {
  const training = getGeneratedTraining();
  customPreview.innerHTML = `<strong>${training.title}</strong><span>${training.details.replace(/\n/g, "<br>")}</span>`;
}

function renderSourcePicker() {
  templatePicker.hidden = selectedSource !== "template";
  customBuilder.hidden = selectedSource !== "custom";
  renderCustomBuilder();
  document.querySelectorAll("[data-source]").forEach((button) => {
    button.classList.toggle("active", button.dataset.source === selectedSource);
  });
  renderCustomPreview();
}

function renderCustomBuilder() {
  const type = customType.value;
  const isEasyOrLong = type === "Vieglais skrējiens" || type === "Garais skrējiens";
  const isSimple = type === "VFS" || type === "SFS";
  const isVelo = type === "Velo";
  const isCits = type === "Cits";
  const isInterval = type === "Intervāli";

  intervalFields.hidden = !isInterval;
  mainFields.hidden = isInterval || isCits;
  freeTextRow.hidden = !isCits;
  drillsRow.hidden = isEasyOrLong || isSimple || isVelo || isCits;

  warmupToggleRow.hidden = !isEasyOrLong;
  cooldownToggleRow.hidden = !isEasyOrLong;

  if (isEasyOrLong) {
    document.getElementById("warmupSection").hidden = false;
    document.getElementById("cooldownSection").hidden = false;
    warmupFields.hidden = !includeWarmup.checked;
    cooldownFields.hidden = !includeCooldown.checked;
  } else if (isSimple || isVelo || isCits) {
    document.getElementById("warmupSection").hidden = true;
    document.getElementById("cooldownSection").hidden = true;
    warmupFields.hidden = true;
    cooldownFields.hidden = true;
  } else {
    document.getElementById("warmupSection").hidden = false;
    document.getElementById("cooldownSection").hidden = false;
    warmupFields.hidden = false;
    cooldownFields.hidden = false;
  }

  const mainPulseLabel = document.getElementById("mainPulseLabel");
  const mainDurationLabel = document.getElementById("mainDurationLabel");

  if (isSimple || isVelo || isCits) {
    if (mainPulseLabel) mainPulseLabel.hidden = true;
  } else {
    if (mainPulseLabel) mainPulseLabel.hidden = false;
  }

  const mainSectionLabel = document.getElementById("mainSectionLabel");
  if (isVelo && mainSectionLabel) {
    mainSectionLabel.textContent = "Velo";
  } else if (mainSectionLabel) {
    mainSectionLabel.textContent = "Pamatdaļa";
  }
}

function renderEditCustomBuilder() {
  const type = document.getElementById("editTrainingType").value;
  const isEasyOrLong = type === "Vieglais skrējiens" || type === "Garais skrējiens";
  const isSimple = type === "VFS" || type === "SFS";
  const isVelo = type === "Velo";
  const isCits = type === "Cits";
  const isInterval = type === "Intervāli";

  document.getElementById("editIntervalFields").hidden = !isInterval;
  document.getElementById("editMainFields").hidden = isInterval || isCits;
  document.getElementById("editFreeTextRow").hidden = !isCits;
  document.getElementById("editDrillsRow").hidden = isEasyOrLong || isSimple || isVelo || isCits;

  document.getElementById("editWarmupToggleRow").hidden = !isEasyOrLong;
  document.getElementById("editCooldownToggleRow").hidden = !isEasyOrLong;

  if (isEasyOrLong) {
    document.getElementById("editWarmupSection").hidden = false;
    document.getElementById("editCooldownSection").hidden = false;
    document.getElementById("editWarmupFields").hidden = !document.getElementById("editIncludeWarmup").checked;
    document.getElementById("editCooldownFields").hidden = !document.getElementById("editIncludeCooldown").checked;
  } else if (isSimple || isVelo || isCits) {
    document.getElementById("editWarmupSection").hidden = true;
    document.getElementById("editCooldownSection").hidden = true;
    document.getElementById("editWarmupFields").hidden = true;
    document.getElementById("editCooldownFields").hidden = true;
  } else {
    document.getElementById("editWarmupSection").hidden = false;
    document.getElementById("editCooldownSection").hidden = false;
    document.getElementById("editWarmupFields").hidden = false;
    document.getElementById("editCooldownFields").hidden = false;
  }

  const mainPulseLabel = document.getElementById("editMainPulseLabel");
  const mainDurationLabel = document.getElementById("editMainDurationLabel");

  if (isSimple || isVelo || isCits) {
    if (mainPulseLabel) mainPulseLabel.hidden = true;
  } else {
    if (mainPulseLabel) mainPulseLabel.hidden = false;
  }

  const mainSectionLabel = document.getElementById("editMainSectionLabel");
  if (isVelo && mainSectionLabel) {
    mainSectionLabel.textContent = "Velo";
  } else if (mainSectionLabel) {
    mainSectionLabel.textContent = "Pamatdaļa";
  }

  renderEditTrainingPreview();
}

function renderEditTrainingPreview() {
  const training = getEditTraining();
  const preview = document.getElementById("editTrainingPreview");
  preview.innerHTML = `<strong>${training.title}</strong><span>${training.details.replace(/\n/g, "<br>")}</span>`;
}

function parseTrainingToForm(template) {
  const name = template.name || "";
  const details = template.details || "";

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  function setChecked(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  }

  document.getElementById("editTrainingName").value = name;

  let type = name;
  if (name === "Intervālu treniņš") type = "Intervāli";
  else if (name === "Cits") type = "Cits";
  setVal("editTrainingType", type);

  const lines = details.split("\n").map(l => l.trim()).filter(Boolean);

  function parseLine(line) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return { label: line, rest: line };
    return { label: line.slice(0, colonIdx).trim(), rest: line.slice(colonIdx + 1).trim() };
  }

  // Default values
  setChecked("editIncludeWarmup", true);
  setChecked("editIncludeCooldown", true);
  setChecked("editIncludeDrills", true);
  setVal("editWarmupDuration", "15 min");
  setVal("editWarmupPulse", "130-145");
  setVal("editCooldownDuration", "15 min");
  setVal("editCooldownPulse", "120-135");
  setVal("editMainDuration", "45 min");
  setVal("editMainPulse", "145-155");
  setVal("editIntervalLength", "600 m");
  setVal("editRepeatCount", "6");
  setVal("editIntervalPace", "3:45/km");
  setVal("editRestDuration", "2 min");
  setVal("editFreeText", "");

  let hasDrills = false;
  let hasWarmup = false;
  let hasCooldown = false;
  let hasIntervals = false;

  for (const line of lines) {
    const parsed = parseLine(line);
    const label = parsed.label;
    const rest = parsed.rest;

    if (label === "Iesildīšanās") {
      hasWarmup = true;
      const durMatch = rest.match(/^(\d+)['′]/);
      if (durMatch) setVal("editWarmupDuration", durMatch[1] + " min");
      const pulseMatch = rest.match(/(\d+-\d+)sr/);
      if (pulseMatch) setVal("editWarmupPulse", pulseMatch[1]);
    } else if (label === "Atsildīšanās") {
      hasCooldown = true;
      const durMatch = rest.match(/^(\d+)['′]/);
      if (durMatch) setVal("editCooldownDuration", durMatch[1] + " min");
      const pulseMatch = rest.match(/(\d+-\d+)sr/);
      if (pulseMatch) setVal("editCooldownPulse", pulseMatch[1]);
    } else if (line === "Drill") {
      hasDrills = true;
    } else if (label === "Pamatdaļa" || label === "Velo") {
      const intervalMatch = rest.match(/(\d+)x(\S+)/);
      if (intervalMatch) {
        hasIntervals = true;
        setVal("editRepeatCount", intervalMatch[1]);
        setVal("editIntervalLength", intervalMatch[2]);
        const paceMatch = rest.match(/\(([^)]+)\)/);
        if (paceMatch) setVal("editIntervalPace", paceMatch[1].replace(/\/km\s*$/i, "") + "/km");
        const restMatch = rest.match(/caur\s+(\S+)/);
        if (restMatch) {
          const r = restMatch[1].replace(/'$/, "");
          if (!r.includes("min")) setVal("editRestDuration", r + " min"); else setVal("editRestDuration", r);
        }
      } else {
        const durMatch = rest.match(/^(\d+)['′]/);
        if (durMatch) setVal("editMainDuration", durMatch[1] + " min");
        const pulseMatch = rest.match(/(\d+-\d+)sr/);
        if (pulseMatch) setVal("editMainPulse", pulseMatch[1]);
      }
    }
  }

  if (type === "Cits") {
    setVal("editFreeText", details);
  }

  setChecked("editIncludeDrills", hasDrills);
  if (type !== "Vieglais skrējiens" && type !== "Garais skrējiens") {
    setChecked("editIncludeWarmup", hasWarmup);
    setChecked("editIncludeCooldown", hasCooldown);
  }

  renderEditCustomBuilder();
}

function todLabel(tod) {
  return { morning: "Rīts", afternoon: "Pusdiena", evening: "Vakars" }[tod] || tod;
}

function extractMainPart(details) {
  if (!details) return "";
  const lines = details.split("\n").map(l => l.trim()).filter(Boolean);
  const main = lines.filter(l => l.includes("Pamatdaļa"));
  return main.length ? main[0] : lines[0] || "";
}

function renderPlanCard(plan) {
  const isCoach = activeRole === "coach";
  const coachDisabled = !isCoach ? "disabled" : "";
  const notCompleted = plan.completed === false;
  const todBadge = plan.time_of_day ? `<span class="tod-badge tod-${plan.time_of_day}">${todLabel(plan.time_of_day)}</span>` : "";
  const planLog = logEntries.find(l => l.plan_id === plan.id);
  const planLogData = planLog?.log_data || [];

  if (isCoach) {
    return `
      <article class="session-card${notCompleted ? " not-completed" : ""}" data-plan-id="${plan.id}">
        <h3>${plan.title}</h3>
        ${todBadge}
        ${notCompleted ? '<span class="not-completed-icon-abs">!</span>' : ""}
        <p>${(plan.details || "").replace(/\n/g, "<br>")}</p>
        <div class="comment-label">Trenera komentārs</div>
        <textarea class="inline-comment" data-comment-plan="${plan.id}" data-comment-type="coach">${plan.coach_comment || ""}</textarea>
        ${notCompleted ? `<div class="not-completed-badge"><span class="not-completed-icon">!</span> Sportists atzīmēja kā neizpildītu</div>${plan.athlete_comment ? `<div class="comment-label">Sportista komentārs</div><div class="log-notes not-completed-comment">${plan.athlete_comment}</div>` : ""}` : ""}
        <div class="card-actions"><button class="delete-action" data-delete-plan="${plan.id}" type="button">×</button></div>
      </article>
    `;
  }

  function renderInlineLog(data, paceBoundsMap) {
    return data.map(entry => {
      let line = `<div class="log-line">`;
      if (entry.intervals && entry.intervals.length) {
        const done = entry.intervals.filter(Boolean);
        const bounds = paceBoundsMap?.[entry.section];
        if (bounds) {
          const colored = done.map(v => {
            const p = parseAthleteInput(v);
            const c = p ? getPaceColor(p, bounds) : "";
            return c ? `<span class="pace-text-${c}">${v}</span>` : v;
          });
          line += `<strong>${entry.section}:</strong> ${colored.join(", ")}`;
        } else {
          line += `<strong>${entry.section}:</strong> ${done.join(", ")}`;
        }
      } else {
        const dur = entry.duration ? entry.duration + (entry.duration.includes("'") ? "" : "'") : "";
        const pulse = entry.pulse ? entry.pulse + (entry.pulse.includes("vid.") ? "" : "vid.") : "";
        const bounds = paceBoundsMap?.[entry.section];
        let paceHtml = "";
        if (entry.pace) {
          const p = parseAthleteInput(entry.pace);
          const c = p && bounds ? getPaceColor(p, bounds) : "";
          paceHtml = c ? `<span class="pace-text-${c}">${entry.pace}</span>` : entry.pace;
        }
        line += `<strong>${entry.section}:</strong> ${dur}${pulse ? "; " + pulse : ""}${paceHtml ? "; " + paceHtml : ""}`;
      }
      line += `</div>`;
      return line;
    }).join("");
  }

  const logActions = planLog ? `<div class="log-actions"><button class="edit-log-btn" data-log-plan="${plan.id}" type="button">✏️</button><button class="delete-action log-delete-btn" data-delete-log="${planLog.id}" type="button">×</button></div>` : "";

  const feelingBadge = planLog?.feeling ? feelingBadgeHtml(planLog.feeling) : "";
  const planLogNotes = planLog?.notes ? `<div class="comment-label">Sportista komentārs</div><div class="log-notes">${planLog.notes}</div>` : "";

  const paceBoundsMap = buildPaceBoundsMap(plan.details);
  const logBlock = planLogData.length
    ? `<div class="log-card log-inline"><div class="log-header"><h3>Izpildīts</h3>${logActions}</div>${renderInlineLog(planLogData, paceBoundsMap)}${feelingBadge}${planLogNotes}</div>`
    : `<button class="add-day-button log-plan-button" data-log-plan="${plan.id}" type="button">Ierakstīt izpildi</button>`;

  return `
    <article class="session-card${notCompleted ? " not-completed" : ""}" data-plan-id="${plan.id}">
      <h3>${plan.title}</h3>
      ${todBadge}
      ${notCompleted ? '<span class="not-completed-icon-abs">!</span>' : ""}
      <p>${(plan.details || "").replace(/\n/g, "<br>")}</p>
      <div class="comment-label">Trenera komentārs</div>
      <textarea class="inline-comment" data-comment-plan="${plan.id}" data-comment-type="coach" disabled>${plan.coach_comment || ""}</textarea>
      <label class="checkbox-row"><input type="checkbox" data-cb-plan="${plan.id}" ${notCompleted ? "checked" : ""} /> Treniņš nav izpildīts</label>
      ${notCompleted ? `<div class="comment-label">Sportista komentārs</div><textarea class="inline-comment not-completed-comment" data-comment-plan="${plan.id}" data-comment-type="athlete">${plan.athlete_comment || ""}</textarea>` : ""}
      ${logBlock}
    </article>
  `;
}

function renderLogCard(log) {
  const data = log.log_data || [];
  if (!data.length) return "";
  const plan = log.plan_id ? plans.find(p => p.id === log.plan_id) : null;
  const paceBoundsMap = buildPaceBoundsMap(plan?.details);
  const items = data.map((entry) => {
    let line = `<div class="log-line">`;
    if (entry.intervals && entry.intervals.length) {
      const done = entry.intervals.filter(Boolean);
      const bounds = paceBoundsMap[entry.section];
      if (bounds) {
        const colored = done.map(v => {
          const p = parseAthleteInput(v);
          const c = p ? getPaceColor(p, bounds) : "";
          return c ? `<span class="pace-text-${c}">${v}</span>` : v;
        });
        line += `<strong>${entry.section}:</strong> ${colored.join(", ")}`;
      } else {
        line += `<strong>${entry.section}:</strong> ${done.join(", ")}`;
      }
    } else {
      const dur = entry.duration ? entry.duration + (entry.duration.includes("'") ? "" : "'") : "";
      const pulse = entry.pulse ? entry.pulse + (entry.pulse.includes("vid.") ? "" : "vid.") : "";
      const bounds = paceBoundsMap[entry.section];
      let paceHtml = "";
      if (entry.pace) {
        const p = parseAthleteInput(entry.pace);
        const c = p && bounds ? getPaceColor(p, bounds) : "";
        paceHtml = c ? `<span class="pace-text-${c}">${entry.pace}</span>` : entry.pace;
      }
      line += `<strong>${entry.section}:</strong> ${dur}${pulse ? "; " + pulse : ""}${paceHtml ? "; " + paceHtml : ""}`;
    }
    line += `</div>`;
    return line;
  }).join("");
  const feelingBadge = log?.feeling ? feelingBadgeHtml(log.feeling) : "";
  const logNotes = log?.notes ? `<div class="comment-label">Sportista komentārs</div><div class="log-notes">${log.notes}</div>` : "";
  const athleteIsOwner = activeRole === "athlete" && currentUser.id === getSelectedAthleteId();
  const logActions = athleteIsOwner ? `<div class="log-actions"><button class="edit-log-btn" data-log-day="${log.date}" type="button">✏️</button><button class="delete-action log-delete-btn" data-delete-log="${log.id}" type="button">×</button></div>` : "";
  return `<div class="session-card log-card"><div class="log-header"><h3>Izpildīts</h3>${logActions}</div>${items}${feelingBadge}${logNotes}</div>`;
}

function minToHours(m) {
  return ((m || 0) / 60).toFixed(1);
}

function renderStats() {
  const data = statsPeriod === "week" ? weeklyTrend : monthlyTrend;

  const tabsHtml = `
    <div class="stats-tabs">
      <button class="${statsPeriod === "week" ? "active" : ""}" data-stat-period="week">Nedēļa</button>
      <button class="${statsPeriod === "month" ? "active" : ""}" data-stat-period="month">Mēnesis</button>
    </div>
  `;

  if (!data || !data.length) {
    statsBar.innerHTML = tabsHtml + '<p class="muted" style="padding:12px 18px">Nav datu</p>';
    attachStatsTabHandlers();
    return;
  }

  const metrics = [
    { key: "run_km", label: "Kilometrāža", color: "run_km" },
    { key: "run_min", label: "Laiks", color: "run_min" },
    { key: "vfs_sfs_min", label: "VFS/SFS", color: "vfs_sfs_min" },
    { key: "velo_min", label: "Velo", color: "velo_min" },
  ];

  const maxValues = {};
  for (const m of metrics) {
    maxValues[m.key] = Math.max(...data.map((d) => d[m.key] || 0), 1);
  }

  function chartDateLabel(d) {
    if (statsPeriod === "week") {
      const parts = (d.week_start || "").split("-");
      if (parts.length !== 3) return "";
      const start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const end = addDays(start, 6);
      return `${String(start.getDate()).padStart(2, "0")}.${String(start.getMonth() + 1).padStart(2, "0")}.–${String(end.getDate()).padStart(2, "0")}.${String(end.getMonth() + 1).padStart(2, "0")}.`;
    }
    const parts = (d.month_start || "").split("-");
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}.` : "";
  }

  function displayValue(m, val) {
    if (m.key === "run_km") return val.toFixed(1) + " km";
    return val.toFixed(1) + " h";
  }

  const legendHtml = `
    <div class="chart-legend">
      ${metrics.map((m) => `
        <span class="chart-legend-item">
          <span class="chart-legend-swatch ${m.color}"></span>
          ${m.label}
        </span>
      `).join("")}
    </div>
  `;

  const rowsHtml = data
    .map((d) => {
      const segmentsHtml = metrics
        .map((m) => {
          const val = d[m.key] || 0;
          const pct = (val / maxValues[m.key]) * 100;
          if (pct < 0.5) return "";
          return `
            <div class="chart-stacked-segment ${m.color}" style="width:${pct}%">
              <span class="chart-value">${displayValue(m, val)}</span>
            </div>
          `;
        })
        .join("");
      const totalWidth = metrics.reduce((sum, m) => {
        const val = d[m.key] || 0;
        return sum + (val / maxValues[m.key]) * 100;
      }, 0);
      return `
        <div class="chart-row">
          <div class="chart-label">${chartDateLabel(d)}</div>
          <div class="chart-bars">
            <div class="chart-stacked-bar" style="${totalWidth === 0 ? "opacity:0.3" : ""}">
              ${segmentsHtml || '<span class="chart-value muted" style="padding:0 4px">0</span>'}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const isWeek = statsPeriod === "week";
  const ranges = isWeek
    ? [{ val: 4, label: "4 ned." }, { val: 8, label: "8 ned." }, { val: 12, label: "12 ned." }]
    : [{ val: 3, label: "3 mēn." }, { val: 6, label: "6 mēn." }, { val: 12, label: "12 mēn." }];
  const currentRange = isWeek ? trendWeeks : trendMonths;

  const rangeHtml = `
    <div class="stats-range">
      ${ranges.map((r) => `
        <button class="${r.val === currentRange ? "active" : ""}" data-stat-range="${r.val}" type="button">${r.label}</button>
      `).join("")}
    </div>
  `;

  statsBar.innerHTML = `
    <div class="stats-chart">
      ${tabsHtml}
      ${rangeHtml}
      ${legendHtml}
      <div class="chart-metrics">${rowsHtml}</div>
    </div>
  `;

  attachStatsTabHandlers();
  attachStatsRangeHandlers();
}

function attachStatsTabHandlers() {
  statsBar.querySelectorAll("[data-stat-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      statsPeriod = btn.dataset.statPeriod;
      renderStats();
    });
  });
}

async function attachStatsRangeHandlers() {
  const athleteId = getSelectedAthleteId();
  statsBar.querySelectorAll("[data-stat-range]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const val = parseInt(btn.dataset.statRange);
      if (statsPeriod === "week") {
        trendWeeks = val;
        try {
          weeklyTrend = await getWeeklyTrend(athleteId, trendWeeks);
        } catch (e) {
          weeklyTrend = [];
        }
      } else {
        trendMonths = val;
        try {
          monthlyTrend = await getMonthlyTrend(athleteId, trendMonths);
        } catch (e) {
          monthlyTrend = [];
        }
      }
      renderStats();
    });
  });
}

function renderCalendar() {
  const athleteId = getSelectedAthleteId();
  const weekStart = currentWeekStart;

  calendarGrid.classList.toggle("calendar-mobile", calendarMode === "mobile");

  calendarGrid.innerHTML = days
    .map((dayName, i) => {
      const date = addDays(weekStart, i);
      const dateStr = formatDateISO(date);
    let dayPlans = plans.filter((p) => p.date === dateStr);
    dayPlans.sort((a, b) => (TOD_ORDER[a.time_of_day] ?? 3) - (TOD_ORDER[b.time_of_day] ?? 3));
    const dayLog = logEntries.filter((l) => l.date === dateStr);
    const dayRaces = races.filter((r) => r.date === dateStr);
    const dayNote = dayNotes.find((n) => n.date === dateStr);

      const todayStr = formatDateISO(new Date());
      const dayRestriction = restrictions.find(r => dateStr >= r.start_date && (!r.end_date || dateStr <= r.end_date));
      const restrictionBadge = dayRestriction ? `<div class="day-restriction-badge">🚫</div>` : "";
      const restrictedClass = dayRestriction ? " restricted-day" : "";
      const raceHtml = dayRaces.length
        ? `<div class="race-list">
            <div class="race-section-header">🏁 ${dateStr >= todayStr ? "Gaidāmās sacensības" : "Aizvadītās sacensības"}</div>
            ${dayRaces.map((r) => {
              const isUpcoming = dateStr >= todayStr;
              const hasResult = !!r.result_time;
              const isAthleteOwner = activeRole === "athlete" && currentUser.id === athleteId;
              return `
              <div class="race-chip${isUpcoming && !hasResult ? " upcoming" : ""}" data-race-id="${r.id}">
                <div class="race-label">${r.name}</div>
                <div class="race-meta">
                  ${r.distance ? `<span class="race-dist-line"><strong class="race-distance">${r.distance}</strong>${r.terrain ? ` · ${capitalize(r.terrain)}` : ""}</span>` : r.terrain ? `<span class="race-dist-line"><span class="race-distance">${capitalize(r.terrain)}</span></span>` : ""}
                  ${r.target_time ? `<span>Mērķis: ${r.target_time}${r.target_pace ? " (" + r.target_pace.replace(/\/km\s*$/i, "") + "/km)" : ""}</span>` : ""}
                </div>
                ${!hasResult && isAthleteOwner ? `<button class="add-day-button" data-log-race="${r.id}" type="button">Pievienot rezultātu</button>` : ""}
                ${hasResult ? `<div class="race-result">✅ ${r.result_time}${r.result_pace ? " (" + r.result_pace.replace(/\/km\s*$/i, "") + "/km)" : ""}</div>` : ""}
                ${isAthleteOwner ? `<textarea class="race-inline-comment" data-comment-race="${r.id}" placeholder="Komentārs..." rows="1">${r.result_comment || ""}</textarea>` : ""}
                ${activeRole !== "coach" ? `<div class="race-actions"><button class="edit-race-btn" data-edit-race="${r.id}" type="button" title="Rediģēt">✏️</button><button class="delete-race-btn" data-race="${r.id}" type="button" title="Dzēst">×</button></div>` : ""}
              </div>
            `}).join("")}
          </div>`
        : "";

      return `
        <section class="day-column${restrictedClass}">
          <div class="day-name">
            <div class="day-name-row">
              <span>${dayName}</span>
            </div>
            <span class="day-date">${date.getDate()}.${date.getMonth() + 1}.</span>
            ${restrictionBadge}
          </div>
          ${raceHtml}
          ${activeRole === "coach" && !dayRestriction ? `<div class="time-of-day-buttons"><button class="add-day-button" data-day="${dateStr}" data-tod="morning" type="button">Pievienot no rīta</button><button class="add-day-button" data-day="${dateStr}" data-tod="afternoon" type="button">Pievienot pusdienā</button><button class="add-day-button" data-day="${dateStr}" data-tod="evening" type="button">Pievienot vakarā</button></div>` : ""}
          ${dayPlans.length ? dayPlans.map(renderPlanCard).join("") : dayRaces.length ? activeRole === "coach" ? `<textarea class="inline-comment" data-comment-day="${dateStr}">${dayNote?.coach_comment || ""}</textarea>` : "" : `<div class="empty-day">${dayRestriction ? "Aktīvs ierobežojums" : "Brīvdiena"}</div>${dayRestriction ? `<div class="restriction-reason">${escapeHtml(dayRestriction.reason)}</div>` : ""}${activeRole === "coach" ? `<textarea class="inline-comment" data-comment-day="${dateStr}">${dayNote?.coach_comment || ""}</textarea>` : ""}`}
          ${dayLog.filter(l => !l.plan_id).map(renderLogCard).join("")}
        </section>
      `;
    })
    .join("");

  renderWeeklySummary();
}

function renderWeeklySummary() {
  const ws = document.getElementById("weeklySummary");
  if (!ws) return;
  const athleteId = getSelectedAthleteId();
  const isAthleteView = activeRole === "athlete" && currentUser.id === athleteId;

  const s = weeklySummary || {};
  const runKm = s.run_km ?? "";
  const runMin = s.run_min ?? "";
  const vfsSfs = s.vfs_sfs_min ?? "";
  const velo = s.velo_min ?? "";
  const coachComment = s.coach_comment ?? "";
  const athleteComment = s.athlete_comment ?? "";

  ws.innerHTML = `
    <div class="ws-header">Nedēļas kopsavilkums</div>
    <div class="ws-fields">
      <label>Kilometrāža <input id="wsRunKm" type="number" step="0.1" value="${runKm}" ${isAthleteView ? "" : "disabled"} /></label>
      <label>Laiks (h) <input id="wsRunMin" class="ws-time" type="text" value="${runMin}" ${isAthleteView ? "" : "disabled"} placeholder="piem. 10h45m" /></label>
      <label>VFS/SFS (h) <input id="wsVfsSfs" class="ws-time" type="text" value="${vfsSfs}" ${isAthleteView ? "" : "disabled"} placeholder="piem. 1h30m" /></label>
      <label>Velo (h) <input id="wsVelo" class="ws-time" type="text" value="${velo}" ${isAthleteView ? "" : "disabled"} placeholder="piem. 0h45m" /></label>
    </div>
    <div class="ws-comments">
      <label>Trenera komentārs <textarea id="wsCoachComment" rows="3" ${activeRole === "coach" ? "" : "disabled"}>${coachComment}</textarea></label>
      <label>Sportista komentārs <textarea id="wsAthleteComment" rows="3" ${isAthleteView ? "" : "disabled"}>${athleteComment}</textarea></label>
    </div>
    <button id="wsSaveBtn" class="primary-action" type="button">Saglabāt</button>
  `;

  if (isAthleteView) {
    document.querySelectorAll(".ws-time").forEach((inp) => {
      inp.addEventListener("input", function () {
        const v = this.value.trim();
        const m = v.match(/^(\d+)(?:h|:)(\d+)(?:m)?$/);
        if (m) {
          const h = parseInt(m[1]) + parseInt(m[2]) / 60;
          this.value = h.toFixed(2);
        }
      });
    });
  }

  document.getElementById("wsSaveBtn")?.addEventListener("click", async () => {
    const weekStart = formatDateISO(currentWeekStart);
    const updates = {
      athlete_id: athleteId,
      week_start: weekStart,
    };
    if (activeRole === "coach") {
      updates.coach_comment = document.getElementById("wsCoachComment").value.trim();
    }
    if (isAthleteView) {
      updates.run_km = parseFloat(document.getElementById("wsRunKm").value) || 0;
      updates.run_min = parseFloat(document.getElementById("wsRunMin").value) || 0;
      updates.vfs_sfs_min = parseFloat(document.getElementById("wsVfsSfs").value) || 0;
      updates.velo_min = parseFloat(document.getElementById("wsVelo").value) || 0;
      updates.athlete_comment = document.getElementById("wsAthleteComment").value.trim();
    }
    try {
      await upsertWeeklySummary(updates);
      weeklySummary = await getWeeklySummary(athleteId, weekStart);
      render();
    } catch (e) {
      console.error(e);
    }
  });
}

function renderRecords() {
  const list = document.getElementById("recordsList");
  if (!list) return;
  const athleteId = getSelectedAthleteId();

  if (!records.length) {
    list.innerHTML = "<p class='empty-day'>Nav rekordu</p>";
    return;
  }

  list.innerHTML = records
    .map(
      (r) =>
        `<div class="record-row">
          <span class="record-dist">${r.distance}</span>
          <span class="record-time">${r.time}</span>
          <span class="record-date">${r.date || ""}</span>
          ${isCoach() || currentUser.id === athleteId ? `<button class="delete-record-btn" data-record="${r.id}">×</button>` : ""}
        </div>`
    )
    .join("");
}

async function loadProfileData() {
  const athleteId = getSelectedAthleteId();
  try {
    records = await getRecords(athleteId);
  } catch (e) {
    records = [];
  }
}

function renderProfile() {
  const athleteId = getSelectedAthleteId();
  const profile = isCoach()
    ? athletes.find((a) => a.id === athleteId) || currentProfile
    : currentProfile;
  const canEdit = currentUser.id === athleteId;
  const canEditUrls = canEdit || isCoach();

  profileCard.innerHTML = `
    <div class="profile-header">
      <div class="profile-name">${profile.full_name}</div>
    </div>
    <section class="profile-section">
      <label>Garmin
        ${canEditUrls
          ? `<input id="editGarminUrl" value="${profile.garmin_url || ""}" placeholder="https://connect.garmin.com/..." />`
          : profile.garmin_url
            ? `<div class="profile-url-row"><a href="${profile.garmin_url}" target="_blank" rel="noopener">${profile.garmin_url}</a></div>`
            : `<span class="muted">— Nav norādīts</span>`
        }
      </label>
      <label>Strava
        ${canEditUrls
          ? `<input id="editStravaUrl" value="${profile.strava_url || ""}" placeholder="https://strava.com/..." />`
          : profile.strava_url
            ? `<div class="profile-url-row"><a href="${profile.strava_url}" target="_blank" rel="noopener">${profile.strava_url}</a></div>`
            : `<span class="muted">— Nav norādīts</span>`
        }
      </label>
      <label>Kalendāra arhīvs
        ${canEditUrls
          ? `<input id="editSpreadsheetUrl" value="${profile.spreadsheet_url || ""}" placeholder="https://docs.google.com/spreadsheets/..." />`
          : profile.spreadsheet_url
            ? `<div class="profile-url-row"><a href="${profile.spreadsheet_url}" target="_blank" rel="noopener">${profile.spreadsheet_url}</a></div>`
            : `<span class="muted">— Nav norādīts</span>`
        }
      </label>
    </section>
    ${canEditUrls ? '<button id="saveProfileBtn" class="primary-action" type="button">Saglabāt profilu</button>' : ""}
  `;
  document.getElementById("saveProfileBtn")?.addEventListener("click", saveProfileUrls);
}

function renderHrZones() {
  const athleteId = getSelectedAthleteId();
  const profile = isCoach()
    ? athletes.find((a) => a.id === athleteId) || currentProfile
    : currentProfile;
  const hrZones = profile.hr_zones || {};
  const canEdit = isCoach();

  const zoneRowsHtml = ["1", "2", "3", "4", "5"]
    .map((z) => {
      const zone = hrZones[z] || {};
      const disabled = canEdit ? "" : "disabled";
      return `
        <div class="zone-row">
          <span class="zone-num">${z}.</span>
          <input class="zone-no" value="${zone.no || ""}" placeholder="no" ${disabled} />
          <input class="zone-lidz" value="${zone.lidz || ""}" placeholder="līdz" ${disabled} />
        </div>
      `;
    })
    .join("");

  document.getElementById("hrZonesBody").innerHTML = `
    <div class="profile-section" id="hrZoneFields">${zoneRowsHtml}</div>
    ${canEdit ? '<button id="saveHrZonesBtn" class="primary-action" type="button">Saglabāt zonas</button>' : ""}
  `;

  document.getElementById("saveHrZonesBtn")?.addEventListener("click", saveHrZones);
}

function renderThresholds() {
  const athleteId = getSelectedAthleteId();
  const profile = isCoach()
    ? athletes.find((a) => a.id === athleteId) || currentProfile
    : currentProfile;
  const thresholds = profile.thresholds || {};
  const canEdit = isCoach();
  const disabled = canEdit ? "" : "disabled";

  document.getElementById("thresholdsBody").innerHTML = `
    <div class="profile-section">
      <div class="field-grid">
        <label>Laktāta temps (min/km) <input id="editLtPace" value="${thresholds.lt_pace || ""}" ${disabled} /></label>
        <label>Laktāta pulss <input id="editLtHr" value="${thresholds.lt_hr || ""}" ${disabled} /></label>
      </div>
      <div class="field-grid">
        <label>Aerobais temps (min/km) <input id="editAerobicPace" value="${thresholds.aerobic_pace || ""}" ${disabled} /></label>
        <label>Aerobais pulss <input id="editAerobicHr" value="${thresholds.aerobic_hr || ""}" ${disabled} /></label>
      </div>
      <div class="field-grid">
        <label>Anaerobais temps (min/km) <input id="editAnaerobicPace" value="${thresholds.anaerobic_pace || ""}" ${disabled} /></label>
        <label>Anaerobais pulss <input id="editAnaerobicHr" value="${thresholds.anaerobic_hr || ""}" ${disabled} /></label>
      </div>
    </div>
    ${canEdit ? '<button id="saveThresholdsBtn" class="primary-action" type="button">Saglabāt sliekšņvērtības</button>' : ""}
  `;

  document.getElementById("saveThresholdsBtn")?.addEventListener("click", saveThresholds);
}

function renderRecords() {
  const athleteId = getSelectedAthleteId();
  const canEditRecords = currentUser.id === athleteId && activeRole !== "coach";

  const recordDistances = [
    { value: "1 jūdze", label: "1 jūdze" },
    { value: "5 km", label: "5 km" },
    { value: "10 km", label: "10 km" },
    { value: "21 km", label: "Pusmaratons" },
    { value: "42 km", label: "Maratons" },
  ];

  const standardDists = new Set(recordDistances.map((d) => d.value));
  const customRecords = records.filter((r) => !standardDists.has(r.distance));

  const recordsHtml = recordDistances
    .map((rd) => {
      const r = records.find((rec) => rec.distance === rd.value);
      if (!r) return "";
      const pace = calcPace(r.time, r.distance);
      return `
        <div class="profile-record-row ${canEditRecords ? "record-clickable" : ""}" ${canEditRecords ? `data-edit-record="${r.id}"` : ""}>
          <div class="profile-record-meta">
            <strong class="record-dist">${rd.label}</strong>
            <span class="record-time">${r.time}</span>
            ${pace ? `<span class="chip-pace">${pace}</span>` : ""}
          </div>
          <div class="profile-record-details">
            ${r.competition_name ? `<span>${r.competition_name}</span>` : ""}
            ${r.location ? `<span class="muted">${r.location}</span>` : ""}
            ${r.date ? `<span class="record-chip-date">${formatDateLV(r.date)}</span>` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  document.getElementById("recordsBody").innerHTML = `
    <div class="profile-section">
      <div class="profile-records" id="profileRecords">
        ${recordsHtml}
        ${canEditRecords
          ? '<div class="profile-record-row record-clickable" data-add-custom-record><div class="profile-record-meta"><strong class="record-dist">+ Pievienot rekordu</strong></div></div>'
          : activeRole === "coach" && !records.length ? '<div class="profile-record-row"><div class="profile-record-meta"><span class="muted">— Nav pievienotu rekordu</span></div></div>' : ""}
        ${customRecords.map((r) => {
          const pace = calcPace(r.time, r.distance);
          return `
            <div class="profile-record-row ${canEditRecords ? "record-clickable" : ""}" ${canEditRecords ? `data-edit-record="${r.id}"` : ""}>
              <div class="profile-record-meta">
                <strong class="record-dist">${r.distance}</strong>
                <span class="record-time">${r.time}</span>
                ${pace ? `<span class="chip-pace">${pace}</span>` : ""}
              </div>
              <div class="profile-record-details">
                ${r.competition_name ? `<span>${r.competition_name}</span>` : ""}
                ${r.location ? `<span class="muted">${r.location}</span>` : ""}
                ${r.date ? `<span class="record-chip-date">${formatDateLV(r.date)}</span>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  document.querySelectorAll("[data-edit-record]").forEach((btn) => {
    btn.addEventListener("click", () => openRecordDialog(btn.dataset.editRecord));
  });

  document.querySelectorAll("[data-add-record]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openRecordDialog(null);
      const distSelect = document.getElementById("recordDistSelect");
      if (distSelect) distSelect.value = btn.dataset.addRecord;
    });
  });

  document.querySelector("[data-add-custom-record]")?.addEventListener("click", () => {
    openRecordDialog(null);
  });
}

function renderRestrictions() {
  const body = document.getElementById("restrictionsBody");
  if (!body) return;
  const canEdit = currentUser.id === getSelectedAthleteId() && activeRole !== "coach";
  const athleteId = getSelectedAthleteId();

  const todayStr = formatDateISO(new Date());
  const activeRestrictions = restrictions.filter(r =>
    !r.end_date
      ? r.start_date >= todayStr
      : r.end_date >= todayStr
  );

  const panel = document.getElementById("restrictionsPanel");
  if (panel) {
    const toggle = panel.querySelector(".collapse-toggle");
    panel.classList.toggle("has-restrictions", activeRestrictions.length > 0);
    if (toggle) {
      toggle.dataset.count = activeRestrictions.length > 9 ? "9+" : String(activeRestrictions.length);
    }
  }

  const list = restrictions.length
    ? restrictions.map(r => {
        const period = r.end_date
          ? `${formatDateLV(r.start_date)} — ${formatDateLV(r.end_date)}`
          : formatDateLV(r.start_date);
        return `
          <div class="restriction-card">
            <div class="restriction-card-header">
              <span class="restriction-dates">${period}</span>
              ${canEdit ? `<button class="delete-restriction-btn" data-restriction="${r.id}" type="button">×</button>` : ""}
            </div>
            <div class="restriction-card-reason">${escapeHtml(r.reason)}</div>
          </div>
        `;
      }).join("")
    : '<div class="muted">— Nav ierobežojumu</div>';

  const form = canEdit ? `
    <div class="restriction-form">
      <div class="field-grid">
        <label>No datuma <input id="newRestrictionStart" type="date" class="restriction-input" /></label>
        <label>Līdz datumam <input id="newRestrictionEnd" type="date" class="restriction-input" /></label>
      </div>
      <label>Iemesls <textarea id="newRestrictionReason" class="restriction-input" rows="2"></textarea></label>
      <button id="addRestrictionBtn" class="primary-action" type="button">Pievienot</button>
    </div>
  ` : "";

  body.innerHTML = `
    <div class="restriction-list">${list}</div>
    ${form}
  `;

  document.getElementById("addRestrictionBtn")?.addEventListener("click", async () => {
    const start = document.getElementById("newRestrictionStart")?.value;
    const end = document.getElementById("newRestrictionEnd")?.value || null;
    const reason = document.getElementById("newRestrictionReason")?.value.trim();
    if (!start) { alert("Lūdzu, izvēlieties datumu!"); return; }
    if (!reason) { alert("Lūdzu, uzrakstiet iemeslu!"); return; }
    try {
      await insertRestriction({ athlete_id: athleteId, start_date: start, end_date: end, reason });
      document.getElementById("newRestrictionStart").value = "";
      document.getElementById("newRestrictionEnd").value = "";
      document.getElementById("newRestrictionReason").value = "";
      await loadNonTemplateData();
    } catch (e) {
      alert("Neizdevās saglabāt: " + (e.message || e));
    }
  });

  document.querySelectorAll(".delete-restriction-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await deleteRestriction(btn.dataset.restriction);
        await loadNonTemplateData();
      } catch (e) {
        console.error(e);
      }
    });
  });
}

function renderDiary() {
  const body = document.getElementById("diaryBody");
  if (!body) return;
  const athleteId = getSelectedAthleteId();
  const isAthleteOwner = currentUser.id === athleteId && activeRole !== "coach";
  const canEdit = isAthleteOwner;

  const panel = document.getElementById("diaryPanel");
  if (panel) {
    const toggle = panel.querySelector(".collapse-toggle");
    if (isAthleteOwner) {
      panel.classList.toggle("has-entries", diaryEntries.length > 0);
      if (toggle) {
        toggle.dataset.count = diaryEntries.length > 9 ? "9+" : String(diaryEntries.length);
      }
    } else {
      const unread = diaryEntries.filter(e => !isEntryRead(athleteId, e.id)).length;
      panel.classList.toggle("has-entries", unread > 0);
      if (toggle) {
        toggle.dataset.count = unread > 9 ? "9+" : String(unread);
      }
    }
  }

  if (!isAthleteOwner) {
    body.innerHTML = '<div class="muted" style="padding:12px 0">— Pieejams tikai sportistam</div>';
    return;
  }

  const list = diaryEntries.length
    ? diaryEntries.map(e => `
        <div class="diary-entry" data-entry-id="${e.id}">
          <div class="diary-entry-header">
            <span class="diary-entry-date">${formatDateLV(e.date)}</span>
            ${canEdit ? `<div class="diary-entry-actions">
              <button class="diary-edit-btn" data-edit-diary="${e.id}" type="button">✏️</button>
              <button class="diary-delete-btn" data-delete-diary="${e.id}" type="button">×</button>
            </div>` : ""}
          </div>
          <div class="diary-entry-content">
            <p>${escapeHtml(e.content)}</p>
          </div>
        </div>
      `).join("")
    : '<div class="muted">— Nav ierakstu</div>';

  const form = canEdit ? `
    <div class="diary-form">
      <div class="diary-form-row">
        <label>Datums <input id="newDiaryDate" type="date" class="diary-input" value="${formatDateISO(new Date())}" /></label>
      </div>
      <textarea id="newDiaryContent" class="diary-input" rows="3" placeholder="Raksti šeit..."></textarea>
      <button id="addDiaryBtn" class="primary-action" type="button">Pievienot</button>
    </div>
  ` : "";

  body.innerHTML = `
    <div class="diary-list">${list}</div>
    ${form}
  `;

  body.querySelector("#addDiaryBtn")?.addEventListener("click", async () => {
    const date = document.getElementById("newDiaryDate")?.value;
    const content = document.getElementById("newDiaryContent")?.value.trim();
    if (!date || !content) { alert("Lūdzu, aizpildiet datumu un saturu!"); return; }
    try {
      await insertDiaryEntry({ athlete_id: athleteId, date, content });
      document.getElementById("newDiaryDate").value = formatDateISO(new Date());
      document.getElementById("newDiaryContent").value = "";
      diaryEntries = await getDiaryEntries(athleteId);
      renderDiary();
    } catch (e) {
      alert("Neizdevās saglabāt: " + (e.message || e));
    }
  });

}

// Diary body delegated click handler — added once, not per render
document.getElementById("diaryBody")?.addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".diary-edit-btn");
  if (editBtn) {
    e.preventDefault();
    const id = editBtn.dataset.editDiary;
    const entry = diaryEntries.find(en => en.id === id);
    if (!entry) return;
    const entryEl = editBtn.closest(".diary-entry");
    const contentDiv = entryEl?.querySelector(".diary-entry-content");
    if (!contentDiv) return;
    contentDiv.innerHTML = `
      <textarea class="diary-edit-textarea" rows="3">${escapeHtml(entry.content)}</textarea>
      <button class="primary-action diary-save-edit-btn" type="button">Saglabāt</button>
    `;
    return;
  }

  const saveBtn = e.target.closest(".diary-save-edit-btn");
  if (saveBtn) {
    e.preventDefault();
    const entryEl = saveBtn.closest(".diary-entry");
    const id = entryEl?.dataset.entryId;
    const textarea = entryEl?.querySelector("textarea");
    if (!id || !textarea) return;
    const content = textarea.value.trim();
    if (!content) return;
    try {
      await updateDiaryEntry(id, { content });
      diaryEntries = await getDiaryEntries(getSelectedAthleteId());
      renderDiary();
    } catch (e) {
      console.error(e);
    }
    return;
  }

  const deleteBtn = e.target.closest(".diary-delete-btn");
  if (deleteBtn) {
    e.preventDefault();
    const id = deleteBtn.dataset.deleteDiary;
    if (!confirm("Dzēst šo ierakstu?")) return;
    try {
      await deleteDiaryEntry(id);
      diaryEntries = diaryEntries.filter(en => en.id !== id);
      renderDiary();
    } catch (e) {
      console.error(e);
    }
    return;
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function setupRecordHandlers() {
  const addBtn = document.getElementById("addRecordBtn");
  const distInput = document.getElementById("recordDistance");
  const timeInput = document.getElementById("recordTime");
  if (!addBtn || !distInput || !timeInput) return;

  addBtn.addEventListener("click", async () => {
    const distance = distInput.value.trim();
    const time = timeInput.value.trim();
    if (!distance || !time) return;
    try {
      await insertRecord({
        athlete_id: getSelectedAthleteId(),
        distance,
        time,
        date: formatDateISO(new Date()),
      });
      distInput.value = "";
      timeInput.value = "";
      records = await getRecords(getSelectedAthleteId());
      renderRecords();
    } catch (e) {
      console.error(e);
    }
  });

  document.querySelectorAll(".delete-record-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await deleteRecord(btn.dataset.record);
        records = await getRecords(getSelectedAthleteId());
        renderRecords();
      } catch (e) {
        console.error(e);
      }
    });
  });
}

async function openMonthView() {
  currentMonthDate = new Date(currentWeekStart);
  const dialog = document.getElementById("monthViewDialog");
  await loadMonthData();
  dialog.showModal();
}

async function loadMonthData() {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;
  const monthStart = getMonthStart(currentMonthDate);
  const monthEnd = getMonthEnd(currentMonthDate);
  const ms = formatDateISO(monthStart);
  const me = formatDateISO(monthEnd);
  try {
    monthPlans = await getPlans(athleteId, ms, me);
  } catch (e) { monthPlans = []; }
  try {
    monthRaces = await getRacesForWeek(athleteId, ms, me);
  } catch (e) { monthRaces = []; }
  try {
    monthLogEntries = await getLogEntries(athleteId, ms, me);
  } catch (e) { monthLogEntries = []; }
  try {
    monthDayNotes = await getDayNotes(athleteId, ms, me);
  } catch (e) { monthDayNotes = []; }
  renderMonthView();
}

function renderMonthView() {
  const grid = document.getElementById("monthGrid");
  const label = document.getElementById("monthLabel");
  if (!grid) return;
  label.textContent = getMonthNameLV(currentMonthDate);

  const monthStart = getMonthStart(currentMonthDate);
  const monthEnd = getMonthEnd(currentMonthDate);
  const today = new Date();
  const todayStr = formatDateISO(today);

  const dayHeaders = ["P", "O", "T", "C", "Pk", "S", "Sv"];
  const cells = [];

  const startDay = monthStart.getDay();
  const padStart = (startDay + 6) % 7;

  const firstCell = new Date(monthStart);
  firstCell.setDate(firstCell.getDate() - padStart);

  const totalCells = padStart + monthEnd.getDate();
  const rows = Math.ceil(totalCells / 7);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 7; col++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + row * 7 + col);
      const dateStr = formatDateISO(d);
      const isOtherMonth = d.getMonth() !== currentMonthDate.getMonth();
      const isToday = dateStr === todayStr;

      const dayPlans = monthPlans.filter((p) => p.date === dateStr);
      dayPlans.sort((a, b) => (TOD_ORDER[a.time_of_day] ?? 3) - (TOD_ORDER[b.time_of_day] ?? 3));
      const dayRaces = monthRaces.filter((r) => r.date === dateStr);
      const dayLog = monthLogEntries.filter((l) => l.date === dateStr);
      const dayNote = monthDayNotes.find((n) => n.date === dateStr);

      const hasLog = dayLog.length > 0;
      const hasNote = !!dayNote;
      const dayRestriction = restrictions.find(r => dateStr >= r.start_date && (!r.end_date || dateStr <= r.end_date));

      const plansHtml = dayPlans.map((p) => `
        <div class="month-plan${dayRaces.length ? " month-plan-race" : ""}${p.completed === false ? " not-completed" : ""}">
          <strong>${p.completed === false ? '<span class="not-completed-icon">!</span> ' : ""}${p.title}</strong>
          <span>${(p.details || "").replace(/\n/g, " · ")}</span>
        </div>
      `).join("");

      const racesHtml = dayRaces.map((r) => `
        <div class="month-race">
          <span>🏁</span>
          <span class="month-race-name">${r.name}</span>
          ${r.location ? `<span class="month-race-location">${r.location}</span>` : ""}
          ${r.distance ? `<strong class="month-race-dist">${r.distance}</strong>` : ""}
        </div>
      `).join("");

      cells.push(`
        <div class="month-day-cell ${isOtherMonth ? "other-month" : ""}${isToday ? " today" : ""}${dayRestriction ? " restricted-day" : ""}" data-date="${dateStr}">
          <div class="month-day-num">
            ${d.getDate()}.
            ${hasLog ? '<span class="month-dot done" title="Izpilde ierakstīta">✓</span>' : ""}
            ${hasNote ? '<span class="month-dot note" title="Piezīme">💬</span>' : ""}
            ${dayRestriction ? '<span class="month-dot restriction" title="Ierobežojums">🚫</span>' : ""}
          </div>
          ${dayRestriction ? `<div class="month-restriction-text">🚫 ${escapeHtml(dayRestriction.reason)}</div>` : ""}
          ${racesHtml}
          ${plansHtml}
        </div>
      `);
    }
  }

  grid.innerHTML = `
    <div class="month-grid">
      ${dayHeaders.map((h) => `<div class="month-day-header">${h}</div>`).join("")}
      ${cells.join("")}
    </div>
  `;
}

function renderMonthViewInline() {
  const grid = document.getElementById("monthGridInline");
  const label = document.getElementById("monthViewTitleInline");
  if (!grid) return;
  label.textContent = getMonthNameLV(currentMonthDate);

  const monthStart = getMonthStart(currentMonthDate);
  const monthEnd = getMonthEnd(currentMonthDate);
  const today = new Date();
  const todayStr = formatDateISO(today);

  const dayHeaders = ["P", "O", "T", "C", "Pk", "S", "Sv"];
  const cells = [];

  const startDay = monthStart.getDay();
  const padStart = (startDay + 6) % 7;

  const firstCell = new Date(monthStart);
  firstCell.setDate(firstCell.getDate() - padStart);

  const totalCells = padStart + monthEnd.getDate();
  const rows = Math.ceil(totalCells / 7);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 7; col++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + row * 7 + col);
      const dateStr = formatDateISO(d);
      const isOtherMonth = d.getMonth() !== currentMonthDate.getMonth();
      const isToday = dateStr === todayStr;

      const dayPlans = monthPlans.filter((p) => p.date === dateStr);
      dayPlans.sort((a, b) => (TOD_ORDER[a.time_of_day] ?? 3) - (TOD_ORDER[b.time_of_day] ?? 3));
      const dayRaces = monthRaces.filter((r) => r.date === dateStr);
      const dayLog = monthLogEntries.filter((l) => l.date === dateStr);
      const dayNote = monthDayNotes.find((n) => n.date === dateStr);

      const hasLog = dayLog.length > 0;
      const hasNote = !!dayNote;
      const dayRestriction = restrictions.find(r => dateStr >= r.start_date && (!r.end_date || dateStr <= r.end_date));

      const plansHtml = dayPlans.map((p) => `
        <div class="month-plan${dayRaces.length ? " month-plan-race" : ""}${p.completed === false ? " not-completed" : ""}">
          <strong>${p.completed === false ? '<span class="not-completed-icon">!</span> ' : ""}${p.title}</strong>
          <span>${extractMainPart(p.details)}</span>
        </div>
      `).join("");

      const racesHtml = dayRaces.map((r) => `
        <div class="month-race">
          <span>🏁</span>
          <span class="month-race-name">${r.name}</span>
          ${r.location ? `<span class="month-race-location">${r.location}</span>` : ""}
          ${r.distance ? `<strong class="month-race-dist">${r.distance}</strong>` : ""}
        </div>
      `).join("");

      cells.push(`
        <div class="month-day-cell ${isOtherMonth ? "other-month" : ""}${isToday ? " today" : ""}${dayRestriction ? " restricted-day" : ""}" data-date="${dateStr}">
          <div class="month-day-num">
            ${d.getDate()}.
            ${hasLog ? '<span class="month-dot done" title="Izpilde ierakstīta">✓</span>' : ""}
            ${hasNote ? '<span class="month-dot note" title="Piezīme">💬</span>' : ""}
            ${dayRestriction ? '<span class="month-dot restriction" title="Ierobežojums">🚫</span>' : ""}
          </div>
          ${dayRestriction ? `<div class="month-restriction-text">🚫 ${escapeHtml(dayRestriction.reason)}</div>` : ""}
          ${racesHtml}
          ${plansHtml}
        </div>
      `);
    }
  }

  grid.innerHTML = `
    <div class="month-grid">
      ${dayHeaders.map((h) => `<div class="month-day-header">${h}</div>`).join("")}
      ${cells.join("")}
    </div>
  `;
}

function renderViewTabs() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewMode);
  });
}

function render() {
  weekLabel.textContent = getWeekLabel(currentWeekStart);
  const hasAthletes = athletes.length > 0;
  trainingPickerPanel.hidden = activeRole !== "coach" || !hasAthletes;
  athleteSelectorPanel.hidden = activeRole !== "coach" || !hasAthletes;
  document.getElementById("restrictionsPanel").hidden = !hasAthletes;
  document.getElementById("openRaceBtn").hidden = activeRole === "coach" || !hasAthletes;
  document.getElementById("raceCalendarBtn").hidden = !hasAthletes;

  renderAthleteDropdown();
  renderTemplates();
  renderSourcePicker();
  renderViewTabs();
  if (hasAthletes) {
    renderStats();
    document.getElementById("weekView").hidden = viewMode !== "week";
    document.getElementById("monthView").hidden = viewMode !== "month";
    document.getElementById("weeklySummary").hidden = viewMode !== "week";
    if (viewMode === "week") {
      renderCalendar();
    } else {
      renderMonthViewInline();
    }
    renderProfile();
    renderHrZones();
    renderThresholds();
    renderRecords();
    renderRestrictions();
    renderDiary();
  } else {
    calendarGrid.innerHTML = '<p class="empty-state">Nav sportistu. Pievienojiet lietotājus.</p>';
    document.getElementById("monthGridInline").innerHTML = '<p class="empty-state">Nav sportistu. Pievienojiet lietotājus.</p>';
    statsBar.innerHTML = "";
    profileCard.innerHTML = "";
    document.getElementById("hrZonesBody").innerHTML = "";
    document.getElementById("thresholdsBody").innerHTML = "";
    document.getElementById("recordsBody").innerHTML = "";
    document.getElementById("diaryBody").innerHTML = "";
  }
  document.getElementById("hrZonesPanel").hidden = !hasAthletes;
  document.getElementById("thresholdsPanel").hidden = !hasAthletes;
  document.getElementById("recordsPanel").hidden = !hasAthletes;
  document.getElementById("diaryPanel").hidden = !hasAthletes;
}

athleteSelect.addEventListener("change", async () => {
  const gen = ++loadGen;
  selectedTemplateId = templates[0]?.id || null;
  await loadAllData();
  await loadProfileData();
  if (gen !== loadGen) return;
  render();
});

document.getElementById("dropdownTrigger").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("athleteDropdown").classList.toggle("open");
});

document.getElementById("dropdownList").addEventListener("click", (e) => {
  e.stopPropagation();
  const row = e.target.closest(".athlete-row");
  if (!row || row.classList.contains("selected")) {
    document.getElementById("athleteDropdown").classList.remove("open");
    return;
  }
  athleteSelect.value = row.dataset.athleteId;
  document.getElementById("athleteDropdown").classList.remove("open");
  athleteSelect.dispatchEvent(new Event("change"));
});

document.addEventListener("click", () => {
  document.getElementById("athleteDropdown").classList.remove("open");
});

weekPrev.addEventListener("click", async () => {
  currentWeekStart = addDays(currentWeekStart, -7);
  await loadNonTemplateData();
});

weekNext.addEventListener("click", async () => {
  currentWeekStart = addDays(currentWeekStart, 7);
  await loadNonTemplateData();
});

document.getElementById("calendarModeToggle").addEventListener("click", () => {
  calendarMode = calendarMode === "desktop" ? "mobile" : "desktop";
  document.getElementById("calendarModeToggle").textContent = calendarMode === "mobile" ? "🖥️ Datora izskats" : "📱 Mobilais izskats";
  renderCalendar();
});

document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    viewMode = btn.dataset.view;
    if (viewMode === "month") {
      currentMonthDate = new Date(currentWeekStart);
      const athleteId = getSelectedAthleteId();
      if (athleteId) {
        const monthStart = getMonthStart(currentMonthDate);
        const monthEnd = getMonthEnd(currentMonthDate);
        const ms = formatDateISO(monthStart);
        const me = formatDateISO(monthEnd);
        try { monthPlans = await getPlans(athleteId, ms, me); } catch (e) { monthPlans = []; }
        try { monthRaces = await getRacesForWeek(athleteId, ms, me); } catch (e) { monthRaces = []; }
        try { monthLogEntries = await getLogEntries(athleteId, ms, me); } catch (e) { monthLogEntries = []; }
        try { monthDayNotes = await getDayNotes(athleteId, ms, me); } catch (e) { monthDayNotes = []; }
      }
    }
    render();
  });
});

document.getElementById("monthPrevInline")?.addEventListener("click", async () => {
  currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
  const athleteId = getSelectedAthleteId();
  if (athleteId) {
    const monthStart = getMonthStart(currentMonthDate);
    const monthEnd = getMonthEnd(currentMonthDate);
    const ms = formatDateISO(monthStart);
    const me = formatDateISO(monthEnd);
    try { monthPlans = await getPlans(athleteId, ms, me); } catch (e) { monthPlans = []; }
    try { monthRaces = await getRacesForWeek(athleteId, ms, me); } catch (e) { monthRaces = []; }
    try { monthLogEntries = await getLogEntries(athleteId, ms, me); } catch (e) { monthLogEntries = []; }
    try { monthDayNotes = await getDayNotes(athleteId, ms, me); } catch (e) { monthDayNotes = []; }
  }
  renderMonthViewInline();
});

document.getElementById("monthNextInline")?.addEventListener("click", async () => {
  currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
  const athleteId = getSelectedAthleteId();
  if (athleteId) {
    const monthStart = getMonthStart(currentMonthDate);
    const monthEnd = getMonthEnd(currentMonthDate);
    const ms = formatDateISO(monthStart);
    const me = formatDateISO(monthEnd);
    try { monthPlans = await getPlans(athleteId, ms, me); } catch (e) { monthPlans = []; }
    try { monthRaces = await getRacesForWeek(athleteId, ms, me); } catch (e) { monthRaces = []; }
    try { monthLogEntries = await getLogEntries(athleteId, ms, me); } catch (e) { monthLogEntries = []; }
    try { monthDayNotes = await getDayNotes(athleteId, ms, me); } catch (e) { monthDayNotes = []; }
  }
  renderMonthViewInline();
});

document.querySelectorAll(".collapse-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = btn.closest(".collapsible");
    const wasCollapsed = panel.classList.contains("collapsed");
    panel.classList.toggle("collapsed");
    btn.textContent = panel.classList.contains("collapsed") ? "▶" : "▼";

    if (panel.id === "diaryPanel" && wasCollapsed && !panel.classList.contains("collapsed")) {
      if (activeRole === "coach") {
        const athleteId = getSelectedAthleteId();
        if (athleteId && diaryEntries.length) {
          markAllEntriesRead(athleteId, diaryEntries);
          panel.classList.toggle("has-entries", false);
          btn.dataset.count = "0";
        }
      }
    }
  });
});

// Hamburger menu (mobile)
function togglePlannerMenu(open) {
  const panel = document.querySelector(".planner-panel");
  const backdrop = document.getElementById("plannerBackdrop");
  if (!panel || !backdrop) return;
  panel.classList.toggle("open", open);
  backdrop.classList.toggle("open", open);
}

document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
  const panel = document.querySelector(".planner-panel");
  togglePlannerMenu(!panel?.classList.contains("open"));
});

document.getElementById("plannerBackdrop")?.addEventListener("click", () => {
  togglePlannerMenu(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const panel = document.querySelector(".planner-panel");
    if (panel?.classList.contains("open")) togglePlannerMenu(false);
  }
});

document.getElementById("templatePicker").addEventListener("click", async (e) => {
  const btn = e.target.closest(".template-filter-btn");
  if (!btn) return;
  document.querySelectorAll(".template-filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  templateFilter = btn.dataset.tfilter;
  selectedTemplateId = null;
  await loadAllData();
});

templateList.addEventListener("click", (event) => {
  const editBtn = event.target.closest("[data-edit-template]");
  if (editBtn) {
    event.stopPropagation();
    const id = editBtn.dataset.editTemplate;
    const t = templates.find((t) => t.id === id);
    if (t) {
      editTemplateDialog.dataset.editId = id;
      parseTrainingToForm(t);
      editTemplateDialog.showModal();
    }
    return;
  }
  const deleteBtn = event.target.closest("[data-delete-template]");
  if (deleteBtn) {
    event.stopPropagation();
    const id = deleteBtn.dataset.deleteTemplate;
    if (confirm("Dzēst šo sagatavi?")) {
      deleteTemplate(id).then(() => {
        templates = templates.filter((t) => t.id !== id);
        if (selectedTemplateId === id) selectedTemplateId = templates[0]?.id || null;
        render();
      }).catch(console.error);
    }
    return;
  }
  const button = event.target.closest("[data-template]");
  if (!button) return;
  selectedTemplateId = button.dataset.template;
  render();
});

document.querySelectorAll("[data-source]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedSource = button.dataset.source;
    render();
  });
});

[customType, warmupDuration, warmupPulse, includeWarmup, includeCooldown, includeDrills, repeatCount, intervalLength, intervalPace, restDuration, mainDuration, mainPulse, cooldownDuration, cooldownPulse].forEach((input) => {
  input.addEventListener("input", renderSourcePicker);
  input.addEventListener("change", renderSourcePicker);
});

["editTrainingType", "editWarmupDuration", "editWarmupPulse", "editIncludeWarmup", "editIncludeCooldown", "editIncludeDrills", "editRepeatCount", "editIntervalLength", "editIntervalPace", "editRestDuration", "editMainDuration", "editMainPulse", "editCooldownDuration", "editCooldownPulse"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", renderEditCustomBuilder);
    el.addEventListener("change", renderEditCustomBuilder);
  }
});
document.getElementById("editFreeText")?.addEventListener("input", renderEditTrainingPreview);
document.getElementById("editFreeText")?.addEventListener("change", renderEditTrainingPreview);
document.getElementById("editTrainingName")?.addEventListener("input", renderEditTrainingPreview);

calendarGrid.addEventListener("click", async (event) => {
  const dayButton = event.target.closest("[data-day]");
  const logDayButton = event.target.closest("[data-log-day]");
  const logPlanButton = event.target.closest("[data-log-plan]");
  const deletePlanBtn = event.target.closest("[data-delete-plan]");
  const deleteRaceBtn = event.target.closest("[data-delete-race-btn], [data-race]");

  if (logPlanButton) {
    openPlanLogDialog(logPlanButton.dataset.logPlan);
    return;
  }

  if (dayButton && activeRole === "coach") {
    const day = dayButton.dataset.day;
    const hasRestriction = restrictions.some(r => day >= r.start_date && (!r.end_date || day <= r.end_date));
    if (hasRestriction) return;
    const tod = dayButton.dataset.tod || "";
    const training = selectedSource === "custom" ? getGeneratedTraining() : getSelectedTraining();
    if (training) {
      await insertTrainingToDay(day, training, tod);
    } else {
      console.warn("Nav pieejams treniņš — pārslēdzies uz 'Jauns treniņš' vai izveido sagatavi");
    }
  }

  if (logDayButton) {
    openLogDialog(logDayButton.dataset.logDay);
  }

  const logRaceBtn = event.target.closest("[data-log-race]");
  if (logRaceBtn) {
    openRaceResultDialog(logRaceBtn.dataset.logRace);
  }

  if (deletePlanBtn) {
    try {
      await deletePlan(deletePlanBtn.dataset.deletePlan);
      await loadNonTemplateData();
    } catch (e) {
      console.error(e);
    }
  }

  const deleteLogBtn = event.target.closest("[data-delete-log]");
  if (deleteLogBtn) {
    try {
      await deleteLogEntry(deleteLogBtn.dataset.deleteLog);
      await loadNonTemplateData();
    } catch (e) {
      console.error(e);
    }
  }

  const editRaceBtn = event.target.closest("[data-edit-race]");
  if (editRaceBtn) {
    openRaceDialog(editRaceBtn.dataset.editRace);
  }

  if (deleteRaceBtn) {
    const raceId = deleteRaceBtn.dataset.race || deleteRaceBtn.dataset.deleteRaceBtn;
    try {
      await deleteRace(raceId);
      await loadNonTemplateData();
    } catch (e) {
      console.error(e);
    }
  }

});

calendarGrid.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  const textarea = event.target.closest("textarea");
  if (!textarea) return;

  const raceCommentId = textarea.dataset.commentRace;
  if (raceCommentId) {
    event.preventDefault();
    const value = textarea.value.trim();
    try {
      await updateRace(raceCommentId, { result_comment: value });
      await loadNonTemplateData();
    } catch (e) {
      console.error(e);
    }
    return;
  }

  const planId = textarea.dataset.commentPlan;
  if (planId) {
    event.preventDefault();
    const type = textarea.dataset.commentType;
    const value = textarea.value.trim();
    try {
      await updatePlan(planId, { [`${type}_comment`]: value });
      await loadNonTemplateData();
    } catch (e) {
      console.error(e);
    }
    return;
  }

  const dayDate = textarea.dataset.commentDay;
  if (dayDate) {
    event.preventDefault();
    const value = textarea.value.trim();
    try {
      await upsertDayNote({
        athlete_id: getSelectedAthleteId(),
        date: dayDate,
        coach_comment: value,
      });
      await loadNonTemplateData();
    } catch (e) {
      console.error(e);
    }
    return;
  }
});

calendarGrid.addEventListener("change", async (event) => {
  const cb = event.target.closest("[data-cb-plan]");
  if (!cb) return;
  const planId = cb.dataset.cbPlan;
  const completed = !cb.checked;
  try {
    await updatePlan(planId, { completed });
    await loadNonTemplateData();
  } catch (e) {
    console.error(e);
  }
});

document.getElementById("saveTemplateOnlyBtn")?.addEventListener("click", async () => {
  const training = getGeneratedTraining();
  const forAthlete = document.getElementById("templateForAthlete")?.checked;
  try {
    const saved = await insertTemplate({
      name: training.title,
      details: training.details,
      created_by: currentUser.id,
      athlete_id: forAthlete ? getSelectedAthleteId() : null,
    });
    templates.push(saved);
    selectedTemplateId = saved.id;
    selectedSource = "template";
    render();
  } catch (e) {
    console.error(e);
  }
});

document.getElementById("saveEditTemplateBtn")?.addEventListener("click", async () => {
  const id = editTemplateDialog.dataset.editId;
  if (!id) return;
  const training = getEditTraining();
  const nameInput = document.getElementById("editTrainingName").value.trim();
  const name = nameInput || training.title;
  const details = training.details;
  if (!name) return;
  try {
    const updated = await updateTemplate(id, { name, details });
    const idx = templates.findIndex((t) => t.id === id);
    if (idx !== -1) templates[idx] = updated;
    editTemplateDialog.close();
    render();
  } catch (e) {
    console.error(e);
  }
});

insertOnlyButton.addEventListener("click", async () => {
  if (!pendingCustomDay) return;
  const training = getGeneratedTraining();
  await insertTrainingToDay(pendingCustomDay, training, pendingCustomTod);
  pendingCustomDay = null;
  pendingCustomTod = "";
  saveTemplateDialog.close();
});

saveAndInsertButton.addEventListener("click", async () => {
  if (!pendingCustomDay) return;
  const training = getGeneratedTraining();
  const forAthlete = document.getElementById("saveDialogForAthlete")?.checked;
  try {
    const saved = await insertTemplate({
      name: training.title,
      details: training.details,
      created_by: currentUser.id,
      athlete_id: forAthlete ? getSelectedAthleteId() : null,
    });
    templates.push(saved);
    selectedTemplateId = saved.id;
    await insertTrainingToDay(pendingCustomDay, training, pendingCustomTod);
  } catch (e) {
    console.error(e);
  }
  pendingCustomDay = null;
  pendingCustomTod = "";
  saveTemplateDialog.close();
});

async function insertTrainingToDay(dateStr, training, tod = "") {
  try {
    await insertPlan({
      athlete_id: getSelectedAthleteId(),
      date: dateStr,
      title: training.title,
      details: training.details,
      coach_comment: "",
      athlete_comment: "",
      created_by: currentUser.id,
      time_of_day: tod || null,
    });
    await loadNonTemplateData();
  } catch (e) {
    console.error(e);
  }
}

function openSaveTemplateDialog(day, tod = "") {
  const training = getGeneratedTraining();
  pendingCustomDay = day;
  pendingCustomTod = tod;
  saveTemplateSummary.innerHTML = `<strong>${training.title}</strong><span>${training.details.replace(/\n/g, "<br>")}</span>`;
  const mainChecked = document.getElementById("templateForAthlete")?.checked;
  const dialogCheckbox = document.getElementById("saveDialogForAthlete");
  if (dialogCheckbox) dialogCheckbox.checked = mainChecked;
  saveTemplateDialog.showModal();
}

function getViewedProfile() {
  const athleteId = getSelectedAthleteId();
  if (isCoach()) {
    const p = athletes.find((a) => a.id === athleteId);
    if (p) return p;
  }
  return currentProfile;
}

async function saveProfileUrls() {
  const profile = getViewedProfile();
  try {
    await updateProfile(profile.id, {
      garmin_url: document.getElementById("editGarminUrl")?.value?.trim() || "",
      strava_url: document.getElementById("editStravaUrl")?.value?.trim() || "",
      spreadsheet_url: document.getElementById("editSpreadsheetUrl")?.value?.trim() || "",
    });
    if (profile.id === currentUser.id) {
      currentProfile = await getProfile(currentUser.id);
    }
    await loadNonTemplateData();
    render();
  } catch (e) {
    console.error(e);
  }
}

async function saveHrZones() {
  const profile = getViewedProfile();
  const zones = {};
  document.querySelectorAll("#hrZoneFields .zone-row").forEach((row) => {
    const num = row.querySelector(".zone-num")?.textContent?.replace(".", "").trim() || "";
    const no = row.querySelector(".zone-no")?.value?.trim() || "";
    const lidz = row.querySelector(".zone-lidz")?.value?.trim() || "";
    if (num && (no || lidz)) {
      zones[num] = { no, lidz };
    }
  });
  try {
    await updateProfile(profile.id, { hr_zones: zones });
    if (profile.id === currentUser.id) {
      currentProfile = await getProfile(currentUser.id);
    }
    const idx = athletes.findIndex((a) => a.id === profile.id);
    if (idx !== -1) athletes[idx].hr_zones = zones;
    render();
  } catch (e) {
    console.error(e);
  }
}

async function saveThresholds() {
  const profile = getViewedProfile();
  const thresholds = {
    lt_hr: document.getElementById("editLtHr").value.trim(),
    lt_pace: document.getElementById("editLtPace").value.trim(),
    aerobic_pace: document.getElementById("editAerobicPace").value.trim(),
    aerobic_hr: document.getElementById("editAerobicHr").value.trim(),
    anaerobic_pace: document.getElementById("editAnaerobicPace").value.trim(),
    anaerobic_hr: document.getElementById("editAnaerobicHr").value.trim(),
  };
  try {
    await updateProfile(profile.id, { thresholds });
    if (profile.id === currentUser.id) {
      currentProfile = await getProfile(currentUser.id);
    }
    const idx = athletes.findIndex((a) => a.id === profile.id);
    if (idx !== -1) athletes[idx].thresholds = thresholds;
    render();
  } catch (e) {
    console.error(e);
  }
}

function feelingBadgeHtml(feeling) {
  const colors = {
    "Knapi izvilku.": { bg: "#fef2f2", color: "#dc2626" },
    "Varēja labāk...": { bg: "#faf5ff", color: "#9333ea" },
    "Esmu apmierināts!": { bg: "#eff6ff", color: "#2563eb" },
    "Jaudīgi!": { bg: "#f0fdf4", color: "#16a34a" },
  };
  const c = colors[feeling] || { bg: "var(--surface-alt)", color: "var(--muted)" };
  return `<div class="feeling-badge" style="background:${c.bg};color:${c.color};border-color:${c.color}">Pašsajūta: ${feeling}</div>`;
}

const RATING_HTML = `
  <div class="rating-group">
    <div class="rating-label">Pašsajūtas novērtējums</div>
    <label class="rating-option" data-color="red">
      <input type="radio" name="trainingRating" value="Knapi izvilku." />
      <span class="radio-circle"></span>
      <span>Knapi izvilku.</span>
    </label>
    <label class="rating-option" data-color="purple">
      <input type="radio" name="trainingRating" value="Varēja labāk..." />
      <span class="radio-circle"></span>
      <span>Varēja labāk...</span>
    </label>
    <label class="rating-option" data-color="blue">
      <input type="radio" name="trainingRating" value="Esmu apmierināts!" />
      <span class="radio-circle"></span>
      <span>Esmu apmierināts!</span>
    </label>
    <label class="rating-option" data-color="green">
      <input type="radio" name="trainingRating" value="Jaudīgi!" />
      <span class="radio-circle"></span>
      <span>Jaudīgi!</span>
    </label>
  </div>
`;

// Log entry dialog
const logDialog = document.getElementById("logDialog");
const logFormContent = document.getElementById("logFormContent");
const saveLogBtn = document.getElementById("saveLogBtn");
let logDialogDate = null;
let logDialogPlanId = null;

saveLogBtn.addEventListener("click", async () => {
  const athleteId = getSelectedAthleteId();
  if (!logDialogDate) return;
  const feelingEl = document.querySelector('input[name="trainingRating"]:checked');
  if (!feelingEl) {
    alert("Lūdzu, novērtējiet treniņu!");
    return;
  }
  const feeling = feelingEl.value;
  const notes = document.getElementById("logAthleteComment")?.value.trim() || "";
  try {
    const entries = [];
    document.querySelectorAll("[data-log-section]").forEach((el) => {
      const section = el.dataset.logSection;
      const duration = el.querySelector(".log-actual-duration")?.value || "";
      const pulse = el.querySelector(".log-actual-pulse")?.value || "";
      const pace = el.querySelector(".log-actual-pace")?.value || "";
      const intervals = [];
      el.querySelectorAll("[data-log-interval]").forEach((inp) => {
        intervals.push(inp.value);
      });
      entries.push({ section, duration, pulse, intervals, pace });
    });
    if (logDialogPlanId) {
      const existing = logEntries.find((l) => l.plan_id === logDialogPlanId);
      if (existing) await deleteLogEntry(existing.id);
      await insertLogEntry({
        athlete_id: athleteId,
        date: logDialogDate,
        plan_id: logDialogPlanId,
        activity_type: "training",
        log_data: entries,
        feeling,
        notes,
      });
    } else {
      const existing = logEntries.filter((l) => l.date === logDialogDate);
      for (const e of existing) {
        await deleteLogEntry(e.id);
      }
      await insertLogEntry({
        athlete_id: athleteId,
        date: logDialogDate,
        activity_type: "training",
        log_data: entries,
        feeling,
        notes,
      });
    }
    logDialog.close();
    await loadNonTemplateData();
  } catch (e) {
    console.error(e);
  }
});
function openPlanLogDialog(planId) {
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return;
  logDialogDate = plan.date;
  logDialogPlanId = plan.id;
  const existingLog = logEntries.find((l) => l.plan_id === plan.id);
  let html = `<p class="log-date">Treniņa ieraksts — ${plan.date}</p>`;
  html += `<div class="log-plan-block"><h3>${plan.title}</h3>`;
  const lines = (plan.details || "").split("\n");
  lines.forEach((line) => {
    if (!line.trim()) return;
    const intervalMatch = line.match(/Pamatdaļa:\s*(\d+)x(\S+)/);
    if (intervalMatch) {
      const count = parseInt(intervalMatch[1]);
      html += `<div class="log-section-row" data-log-section="Pamatdaļa">
        <div class="log-target">${line}</div>
        <div class="field-grid">`;
      for (let i = 0; i < count; i++) {
        html += `<label>${i + 1}. atkārtojums <input class="log-interval-pace" data-log-interval="${i}" placeholder="${extractPace(line)}" /></label>`;
      }
      html += `</div></div>`;
    } else if (line.includes(":")) {
      const paceStr = extractPace(line);
      const paceField = paceStr ? `<label>Izp. vidējais temps <input class="log-actual-pace" placeholder="${paceStr}" /></label>` : "";
      html += `<div class="log-section-row" data-log-section="${line.split(":")[0]}">
        <div class="log-target">${line}</div>
        <div class="field-grid">
          <label>Izp. ilgums <input class="log-actual-duration" placeholder="${extractDuration(line)}" /></label>
          <label>Izp. vidējais pulss <input class="log-actual-pulse" placeholder="" /></label>
          ${paceField}
        </div>
      </div>`;
    } else if (line === "Drill") {
      html += `<div class="log-section-row" data-log-section="Drill">
        <div class="log-target">Drill</div>
        <div class="field-grid">
          <label>Izp. ilgums <input class="log-actual-duration" placeholder="15'" /></label>
        </div>
      </div>`;
    } else {
      html += `<div class="log-section-row">
        <div class="log-target">${line}</div>
      </div>`;
    }
  });
  html += `</div>`;
  html += RATING_HTML;
  html += `<div class="comment-label">Sportista komentārs</div><textarea class="inline-comment" id="logAthleteComment" rows="2" placeholder="Ieraksti komentāru..."></textarea>`;
  logFormContent.innerHTML = html;

  if (existingLog?.log_data) {
    existingLog.log_data.forEach((entry) => {
      const sectionEl = logFormContent.querySelector(`[data-log-section="${entry.section}"]`);
      if (!sectionEl) return;
      const durInput = sectionEl.querySelector(".log-actual-duration");
      if (durInput && entry.duration) durInput.value = entry.duration;
      const pulseInput = sectionEl.querySelector(".log-actual-pulse");
      if (pulseInput && entry.pulse) pulseInput.value = entry.pulse;
      const paceInput = sectionEl.querySelector(".log-actual-pace");
      if (paceInput && entry.pace) paceInput.value = entry.pace;
      if (entry.intervals) {
        sectionEl.querySelectorAll("[data-log-interval]").forEach((inp, i) => {
          if (entry.intervals[i]) inp.value = entry.intervals[i];
        });
      }
    });
  }

  if (existingLog?.feeling) {
    const radio = logFormContent.querySelector(`input[name="trainingRating"][value="${existingLog.feeling}"]`);
    if (radio) radio.checked = true;
  }

  if (existingLog?.notes) {
    const ta = document.getElementById("logAthleteComment");
    if (ta) ta.value = existingLog.notes;
  }

  attachIntervalPaceValidation();
  logDialog.showModal();
}

function openLogDialog(dateStr) {
  logDialogDate = dateStr;
  logDialogPlanId = null;
  const existingLog = logEntries.find((l) => l.date === dateStr && !l.plan_id);
  const dayPlans = plans.filter((p) => p.date === dateStr);
  dayPlans.sort((a, b) => (TOD_ORDER[a.time_of_day] ?? 3) - (TOD_ORDER[b.time_of_day] ?? 3));
  if (!dayPlans.length) {
    logFormContent.innerHTML = '<p class="muted">Šajā dienā nav plānotu treniņu.</p>';
    logDialog.showModal();
    return;
  }
  let html = `<p class="log-date">Treniņa ieraksts — ${dateStr}</p>`;
  dayPlans.forEach((plan) => {
    html += `<div class="log-plan-block"><h3>${plan.title}</h3>`;
    const lines = (plan.details || "").split("\n");
    lines.forEach((line) => {
      if (!line.trim()) return;
      const intervalMatch = line.match(/Pamatdaļa:\s*(\d+)x(\S+)/);
      if (intervalMatch) {
        const count = parseInt(intervalMatch[1]);
        html += `<div class="log-section-row" data-log-section="Pamatdaļa">
          <div class="log-target">${line}</div>
          <div class="field-grid">`;
        for (let i = 0; i < count; i++) {
          html += `<label>${i + 1}. atkārtojums <input class="log-interval-pace" data-log-interval="${i}" placeholder="${extractPace(line)}" /></label>`;
        }
        html += `</div></div>`;
      } else if (line.includes(":")) {
        const paceStr = extractPace(line);
        const paceField = paceStr ? `<label>Izp. vidējais temps <input class="log-actual-pace" placeholder="${paceStr}" /></label>` : "";
        html += `<div class="log-section-row" data-log-section="${line.split(":")[0]}">
          <div class="log-target">${line}</div>
          <div class="field-grid">
            <label>Izp. ilgums <input class="log-actual-duration" placeholder="${extractDuration(line)}" /></label>
            <label>Izp. vidējais pulss <input class="log-actual-pulse" placeholder="" /></label>
            ${paceField}
          </div>
        </div>`;
      } else if (line === "Drill") {
        html += `<div class="log-section-row" data-log-section="Drill">
          <div class="log-target">Drill</div>
          <div class="field-grid">
            <label>Izp. ilgums <input class="log-actual-duration" placeholder="15'" /></label>
          </div>
        </div>`;
      } else {
        html += `<div class="log-section-row">
          <div class="log-target">${line}</div>
        </div>`;
      }
    });
    html += `</div>`;
  });
  html += RATING_HTML;
  html += `<div class="comment-label">Sportista komentārs</div><textarea class="inline-comment" id="logAthleteComment" rows="2" placeholder="Ieraksti komentāru..."></textarea>`;
  logFormContent.innerHTML = html;

  if (existingLog?.log_data) {
    existingLog.log_data.forEach((entry) => {
      const sectionEl = logFormContent.querySelector(`[data-log-section="${entry.section}"]`);
      if (!sectionEl) return;
      const durInput = sectionEl.querySelector(".log-actual-duration");
      if (durInput && entry.duration) durInput.value = entry.duration;
      const pulseInput = sectionEl.querySelector(".log-actual-pulse");
      if (pulseInput && entry.pulse) pulseInput.value = entry.pulse;
      const paceInput = sectionEl.querySelector(".log-actual-pace");
      if (paceInput && entry.pace) paceInput.value = entry.pace;
      if (entry.intervals) {
        sectionEl.querySelectorAll("[data-log-interval]").forEach((inp, i) => {
          if (entry.intervals[i]) inp.value = entry.intervals[i];
        });
      }
    });
  }

  if (existingLog?.feeling) {
    const radio = logFormContent.querySelector(`input[name="trainingRating"][value="${existingLog.feeling}"]`);
    if (radio) radio.checked = true;
  }

  if (existingLog?.notes) {
    const ta = document.getElementById("logAthleteComment");
    if (ta) ta.value = existingLog.notes;
  }

  attachIntervalPaceValidation();
  logDialog.showModal();
}

function extractDuration(line) {
  const m = line.match(/(\d+)'/);
  return m ? m[0] : "";
}

function extractPulse(line) {
  const m = line.match(/([\d\-]+)sr/);
  return m ? m[1] + "sr" : "";
}

function extractPace(line) {
  if (!line) return "";
  let s = line.trim();
  const parenMatch = s.match(/\(([^)]+)\)/);
  if (parenMatch) return parenMatch[1].trim();
  const paceMatch = s.match(/(\d+:\d+(?:-\d+:\d+)?)\s*\/?\s*km/);
  if (paceMatch) return paceMatch[1];
  const secMatch = s.match(/(\d+(?:-\d+)?)\s*(?:sek|sec|s)\b/);
  if (secMatch) return secMatch[1] + "sec";
  const rangeMatch = s.match(/(\d+:\d+-\d+:\d+)/);
  if (rangeMatch) return rangeMatch[1];
  const singleMatch = s.match(/(\d+:\d{2})\b/);
  if (singleMatch) return singleMatch[1];
  return "";
}

function parsePaceBounds(paceStr) {
  if (!paceStr) return null;
  let s = paceStr.trim().replace(/\s*\/\s*km\s*$/i, "").replace(/\s*(sek|sec|s)\s*$/i, "").trim();
  if (s.includes(":")) {
    const range = s.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
    if (range) {
      const min = { m: +range[1], s: +range[2] };
      const max = { m: +range[3], s: +range[4] };
      return {
        min, max,
        warnBelow: addSecOffset(min, -4),
        warnAbove: addSecOffset(max, 4),
        isRange: true
      };
    }
    const single = s.match(/^(\d+):(\d+)$/);
    if (single) {
      const v = { m: +single[1], s: +single[2] };
      return {
        min: addSecOffset(v, -3), max: addSecOffset(v, 3),
        warnBelow: addSecOffset(v, -7),
        warnAbove: addSecOffset(v, 7),
        isRange: false
      };
    }
  } else {
    const range = s.match(/^(\d+)-(\d+)$/);
    if (range) {
      const min = { m: 0, s: +range[1] };
      const max = { m: 0, s: +range[2] };
      return {
        min, max,
        warnBelow: addSecOffset(min, -4),
        warnAbove: addSecOffset(max, 4),
        isRange: true
      };
    }
    const single = s.match(/^(\d+)$/);
    if (single) {
      const v = { m: 0, s: +single[1] };
      return {
        min: addSecOffset(v, -3), max: addSecOffset(v, 3),
        warnBelow: addSecOffset(v, -7),
        warnAbove: addSecOffset(v, 7),
        isRange: false
      };
    }
  }
  return null;
}
function addSecOffset(pace, offset) {
  let totalSec = pace.m * 60 + pace.s + offset;
  if (totalSec < 0) totalSec = 0;
  return { m: Math.floor(totalSec / 60), s: totalSec % 60 };
}
function paceLt(a, b) {
  return a.m < b.m || (a.m === b.m && a.s < b.s);
}
function parseAthleteInput(str) {
  if (!str) return null;
  let s = str.trim().replace(/\s*\/\s*km\s*$/i, "").replace(/\s*(sek|sec|s)\s*$/i, "").trim();
  const mmss = s.match(/^(\d+):(\d+)$/);
  if (mmss) return { m: +mmss[1], s: +mmss[2] };
  const num = s.match(/^(\d+)$/);
  if (num) return { m: 0, s: +num[1] };
  return null;
}
function getPaceColor(athlete, bounds) {
  if (!athlete || !bounds) return "";
  if (paceLt(athlete, bounds.warnBelow)) return "fast";
  if (paceLt(bounds.warnAbove, athlete)) return "slow";
  if (!paceLt(athlete, bounds.min) && !paceLt(bounds.max, athlete)) return "good";
  return "warn";
}
function buildPaceBoundsMap(planDetails) {
  const map = {};
  if (!planDetails) return map;
  planDetails.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const section = line.slice(0, idx).trim();
    const paceStr = extractPace(line);
    if (paceStr) {
      const bounds = parsePaceBounds(paceStr);
      if (bounds) map[section] = bounds;
    }
  });
  return map;
}

function attachIntervalPaceValidation() {
  document.querySelectorAll("[data-log-section]").forEach((sectionEl) => {
    const targetLine = sectionEl.querySelector(".log-target")?.textContent || "";
    const paceStr = extractPace(targetLine);
    if (!paceStr) return;
    const bounds = parsePaceBounds(paceStr);
    if (!bounds) return;
    const ins = sectionEl.querySelectorAll("[data-log-interval]");
    ins.forEach((inp) => {
      function validate() {
        const v = parseAthleteInput(inp.value);
        inp.classList.remove("pace-fast", "pace-good", "pace-slow", "pace-warn");
        if (!v) return;
        const c = getPaceColor(v, bounds);
        if (c) inp.classList.add("pace-" + c);
      }
      inp.addEventListener("input", validate);
      validate();
    });
    const paceInp = sectionEl.querySelector(".log-actual-pace");
    if (paceInp) {
      function validatePace() {
        const v = parseAthleteInput(paceInp.value);
        paceInp.classList.remove("pace-fast", "pace-good", "pace-slow", "pace-warn");
        if (!v) return;
        const c = getPaceColor(v, bounds);
        if (c) paceInp.classList.add("pace-" + c);
      }
      paceInp.addEventListener("input", validatePace);
      validatePace();
    }
  });
}

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
    document.getElementById("raceTargetPace").value = r.target_pace || "";
    raceNotes.value = r.notes || "";
    if (deleteRaceBtn) deleteRaceBtn.hidden = false;
  } else {
    raceDate.value = formatDateISO(new Date());
    raceName.value = "";
    raceLocation.value = "";
    document.getElementById("raceDistance").value = "";
    document.getElementById("raceTerrain").value = "";
    document.getElementById("raceTargetTime").value = "";
    document.getElementById("raceTargetPace").value = "";
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
    target_pace: document.getElementById("raceTargetPace").value.trim().replace(/\/km\s*$/i, ""),
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
    refreshRaceCalendar();
  } catch (e) {
    console.error(e);
  }
});

function autoCalcTargetPace() {
  const dist = document.getElementById("raceDistance").value.trim();
  const time = document.getElementById("raceTargetTime").value.trim();
  document.getElementById("raceTargetPace").value = calcPace(time, dist);
}
document.getElementById("raceDistance").addEventListener("input", autoCalcTargetPace);
document.getElementById("raceTargetTime").addEventListener("input", autoCalcTargetPace);

if (deleteRaceBtn) {
  deleteRaceBtn.addEventListener("click", async () => {
    if (!editingRaceId) return;
    try {
      await deleteRace(editingRaceId);
      raceDialog.close();
      await loadNonTemplateData();
      refreshRaceCalendar();
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
  raceResultInfo.innerHTML = `<strong>${r.name}</strong><span>${r.date}${r.distance ? " · " + r.distance : ""}${r.location ? " · " + r.location : ""}${r.target_time ? " · Mērķis: " + r.target_time : ""}</span>`;
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
    refreshRaceCalendar();
  } catch (e) {
    console.error(e);
  }
});

raceResultTime.addEventListener("input", () => {
  if (editingRaceDistance) {
    raceResultPace.value = calcPace(raceResultTime.value.trim(), editingRaceDistance);
  }
});

function renderRaceTab(tab) {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;
  getRaces(athleteId).then((allRaces) => {
    const today = formatDateISO(new Date());
    const upcoming = allRaces.filter((r) => r.date >= today).sort((a, b) => a.date < b.date ? -1 : 1);
    const past = allRaces.filter((r) => r.date < today).sort((a, b) => a.date < b.date ? 1 : -1);
    const races = tab === "upcoming" ? upcoming : past;
    const content = document.getElementById("raceCalendarContent");
    if (!races.length) {
      content.innerHTML = '<p class="muted">Nav sacensību.</p>';
      return;
    }
    const isAthleteOwner = activeRole === "athlete" && currentUser.id === athleteId;
    content.innerHTML = races.map((r) => {
      const hasResult = !!r.result_time;
      return `
        <div class="race-list-item">
          <div class="race-list-main">
            <strong>${r.name}</strong>
            <span class="muted">${formatDateLV(r.date)}${r.location ? " · " + r.location : ""}</span>
            ${r.distance ? `<span class="race-dist-line"><strong class="race-distance">${r.distance}</strong>${r.terrain ? ` · ${capitalize(r.terrain)}` : ""}</span>` : r.terrain ? `<span class="race-dist-line"><span class="race-distance">${capitalize(r.terrain)}</span></span>` : ""}
          </div>
          <div class="race-list-details">
            ${tab === "upcoming"
              ? (r.target_time
                ? `<span class="chip-target">Mērķis: ${r.target_time}${r.target_pace ? " (" + r.target_pace.replace(/\/km\s*$/i, "") + "/km)" : ""}</span>`
                : `<span class="muted">— Nav mērķa</span>`)
              : (hasResult
                ? `<span class="chip-result">✅ ${r.result_time}${r.result_pace ? " (" + r.result_pace.replace(/\/km\s*$/i, "") + "/km)" : ""}</span>${r.result_comment ? `<span class="muted">${r.result_comment}</span>` : ""}`
                : `<span class="muted">— Nav rezultāta</span>`)
            }
          </div>
          ${r.notes ? `<p class="race-notes">${r.notes}</p>` : ""}
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
  });
}

function refreshRaceCalendar() {
  const dialog = document.getElementById("raceListDialog");
  if (!dialog.open) return;
  const activeTab = dialog.querySelector("[data-race-tab].active");
  if (activeTab) renderRaceTab(activeTab.dataset.raceTab);
}

function openRaceCalendarDialog() {
  const tabs = document.querySelectorAll("#raceListDialog [data-race-tab]");
  tabs.forEach((b) => b.classList.remove("active"));
  const upcomingTab = document.querySelector("#raceListDialog [data-race-tab='upcoming']");
  if (upcomingTab) upcomingTab.classList.add("active");
  renderRaceTab("upcoming");
  document.getElementById("raceListDialog").showModal();
}

document.getElementById("raceCalendarBtn")?.addEventListener("click", openRaceCalendarDialog);
document.querySelectorAll("#raceListDialog [data-race-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#raceListDialog [data-race-tab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderRaceTab(btn.dataset.raceTab);
  });
});

// Record dialog
let editingRecordId = null;
const recordCustomDistRow = document.getElementById("recordCustomDistRow");
const recordCustomDist = document.getElementById("recordCustomDist");

recordDistSelect.addEventListener("change", () => {
  recordCustomDistRow.hidden = recordDistSelect.value !== "__other__";
});

function openRecordDialog(recordId) {
  editingRecordId = recordId;
  if (recordId) {
    const r = records.find((rec) => rec.id === recordId);
    if (!r) return;
    const isOther = !["1 jūdze", "5 km", "10 km", "21 km", "42 km"].includes(r.distance);
    recordDistSelect.value = isOther ? "__other__" : r.distance;
    recordCustomDistRow.hidden = !isOther;
    recordCustomDist.value = isOther ? r.distance : "";
    recordTimeInput.value = r.time;
    recordLocation.value = r.location || "";
    recordCompetition.value = r.competition_name || "";
    recordDate.value = r.date || "";
    deleteRecordBtn.hidden = false;
  } else {
    recordDistSelect.value = "";
    recordCustomDistRow.hidden = true;
    recordCustomDist.value = "";
    recordTimeInput.value = "";
    recordLocation.value = "";
    recordCompetition.value = "";
    recordDate.value = formatDateISO(new Date());
    deleteRecordBtn.hidden = true;
  }
  recordDialog.showModal();
}

saveRecordBtn.addEventListener("click", async () => {
  const distance = recordDistSelect.value === "__other__"
    ? recordCustomDist.value.trim()
    : recordDistSelect.value;
  const data = {
    athlete_id: getSelectedAthleteId(),
    distance,
    time: recordTimeInput.value.trim(),
    location: recordLocation.value.trim(),
    competition_name: recordCompetition.value.trim(),
    date: recordDate.value,
  };
  if (!distance) return;
  try {
    if (editingRecordId) {
      await updateRecord(editingRecordId, data);
    } else {
      await insertRecord(data);
    }
    recordDialog.close();
    records = await getRecords(getSelectedAthleteId());
    render();
  } catch (e) {
    console.error(e);
  }
});

deleteRecordBtn.addEventListener("click", async () => {
  if (!editingRecordId) return;
  try {
    await deleteRecord(editingRecordId);
    recordDialog.close();
    records = await getRecords(getSelectedAthleteId());
    render();
  } catch (e) {
    console.error(e);
  }
});


