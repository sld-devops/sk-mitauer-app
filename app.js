const days = [
  "Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena",
  "Piektdiena", "Sestdiena", "Svētdiena",
];

let selectedTemplateId = null;
let activeRole = "athlete";
let calendarMode = localStorage.getItem("calendarMode") || (window.matchMedia("(max-width: 1040px)").matches ? "mobile" : "desktop");

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

const MIN_WEEK_START = new Date(2026, 5, 1);
let currentWeekStart = getMonday(new Date());
let viewMode = "week";
const TOD_ORDER = { morning: 0, afternoon: 1, evening: 2 };
let athletes = [];
let templates = [];
let plans = [];
let allPlans = [];
let logEntries = [];
let allLogEntries = [];
let dayNotes = [];
let loadGen = 0;
let weeklySummary = null;
let currentMonthDate = new Date();
let monthPlans = [];
let monthLogEntries = [];
let monthDayNotes = [];
let weekBlockTypes = [];

let athleteNextWeeksPlans = {};
let athleteHealthSet = new Set();
let athleteNotCompletedSet = new Set();

async function refreshAthleteNotCompletedSet() {
  try {
    const ids = await getNotCompletedAthleteIds();
    athleteNotCompletedSet = new Set(ids);
  } catch (e) {
    athleteNotCompletedSet = new Set();
  }
}

async function refreshAthleteHealthSet() {
  try {
    const allHealth = await getAthleteHealthCounts();
    const todayStr = formatDateISO(new Date());
    athleteHealthSet = new Set(
      allHealth
        .filter(e => e.start_date <= todayStr && todayStr <= (e.end_date || e.start_date))
        .map(e => e.athlete_id)
    );
  } catch (e) {
    athleteHealthSet = new Set();
  }
}

let weekStatuses = {};
let panelCollapsed = localStorage.getItem("panelCollapsed") === "true";

if (panelCollapsed) document.querySelector(".layout")?.classList.add("panel-collapsed");

const athleteSelect = document.getElementById("athleteSelect");
const athleteSelectorPanel = document.getElementById("athleteSelectorPanel");
const calendarGrid = document.getElementById("calendarGrid");
const cooldownDuration = document.getElementById("cooldownDuration");
const cooldownPulse = document.getElementById("cooldownPulse");
const cooldownFields = document.getElementById("cooldownFields");
const cooldownToggleRow = document.getElementById("cooldownToggleRow");
const customFreeText = document.getElementById("customFreeText");
const customPreview = document.getElementById("customPreview");
const customType = document.getElementById("customType");
const drillsRow = document.getElementById("drillsRow");
const editPlanDialog = document.getElementById("editPlanDialog");
const freeTextRow = document.getElementById("freeTextRow");
const includeCooldown = document.getElementById("includeCooldown");
const includeDrills = document.getElementById("includeDrills");
const includeWarmup = document.getElementById("includeWarmup");
const intervalFields = document.getElementById("intervalFields");
const intervalLength = document.getElementById("intervalLength");
const intervalPace = document.getElementById("intervalPace");
const mainAdditional = document.getElementById("mainAdditional");
const mainDrills = document.getElementById("mainDrills");
const mainDuration = document.getElementById("mainDuration");
const mainExtraSection = document.getElementById("mainExtraSection");
const mainFields = document.getElementById("mainFields");
const mainPulse = document.getElementById("mainPulse");
const tempoPace = document.getElementById("tempoPace");
const repeatCount = document.getElementById("repeatCount");
const restDuration = document.getElementById("restDuration");
const varIntervalFields = document.getElementById("varIntervalFields");
const varSegmentList = document.getElementById("varSegmentList");
const varLaps = document.getElementById("varLaps");
const varRestBetweenLaps = document.getElementById("varRestBetweenLaps");
const trainingBar = document.getElementById("trainingBar");
const warmupDuration = document.getElementById("warmupDuration");
const warmupFields = document.getElementById("warmupFields");
const warmupPulse = document.getElementById("warmupPulse");
const warmupAdditional = document.getElementById("warmupAdditional");
const cooldownAdditional = document.getElementById("cooldownAdditional");
const warmupToggleRow = document.getElementById("warmupToggleRow");
const weekLabel = document.getElementById("weekLabel");
const weekPrev = document.getElementById("weekPrev");
const weekNext = document.getElementById("weekNext");
const weekCurrent = document.getElementById("weekCurrent");
const profileCoachSection = document.getElementById("profileCoachSection");
const raceNutrition = document.getElementById("raceNutrition");
const raceNutritionRow = document.getElementById("raceNutritionRow");
const spikes = document.getElementById("spikes");
const spikesRow = document.getElementById("spikesRow");
const raceShoes = document.getElementById("raceShoes");
const raceShoesRow = document.getElementById("raceShoesRow");

function getMonday(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekStartFromStr(dateStr) {
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const mon = getMonday(d);
  return formatDateISO(mon);
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
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

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseTimeToSec(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function formatPart(label, duration, pulse, pace, additional) {
  const dur = duration.trim();
  if (!dur) return "";
  const pulseStr = pulse.trim();
  const paceStr = pace ? pace.trim() : "";
  const additionalStr = additional ? additional.trim() : "";
  let result = `${label}: ${dur}`;
  if (pulseStr) result += `; ${pulseStr}`;
  if (paceStr) result += `; ${paceStr}`;
  if (additionalStr) result += `; ${additionalStr}`;
  return result;
}

function getDrillsPart() {
  return includeDrills.checked ? "Drill" : "";
}

function getGeneratedTraining() {
  const type = customType.value;

  if (type === OTHER_RUN_TYPE) {
    const warmup = formatPart("Iesildīšanās", warmupDuration.value, warmupPulse.value, null, warmupAdditional.value);
    const drills = getDrillsPart();
    const cooldown = formatPart("Atsildīšanās", cooldownDuration.value, cooldownPulse.value, null, cooldownAdditional.value);
    const lines = [warmup, drills].filter(Boolean);
    const mainText = customFreeText.value.trim();
    if (mainText) lines.push(`Pamatdaļa: ${mainText}`);
    if (mainDrills.checked) lines.push("Drill");
    const mainAdditionalText = mainAdditional.value.trim();
    if (mainAdditionalText) lines.push(`Papildus uzdevums: ${mainAdditionalText}`);
    if (cooldown) lines.push(cooldown);
    if (raceNutrition.checked) lines.push("• Izmantot sacensību uzturu");
    const title = customName.value.trim() || OTHER_RUN_TYPE;
    const customIcon = getSelectedIcon("customIconPicker");
    return { title, details: lines.join("\n"), custom_icon: customIcon };
  }

  const isEasyOrLong = type === "Atjaunojošais/lēnais skrējiens" || type === "Garais skrējiens" || type === "Vidējas intensitātes skrējiens";
  const isSimple = type === "VFS" || type === "SFS";
  const isVelo = type === "Velo";

  const warmup = isEasyOrLong
    ? (includeWarmup.checked ? formatPart("Iesildīšanās", warmupDuration.value, warmupPulse.value, null, warmupAdditional.value) : "")
    : (isSimple || isVelo) ? "" : formatPart("Iesildīšanās", warmupDuration.value, warmupPulse.value, null, warmupAdditional.value);
  const drills = (isEasyOrLong || isSimple || isVelo) ? "" : getDrillsPart();
  const cooldown = isEasyOrLong
    ? (includeCooldown.checked ? formatPart("Atsildīšanās", cooldownDuration.value, cooldownPulse.value, null, cooldownAdditional.value) : "")
    : (isSimple || isVelo) ? "" : formatPart("Atsildīšanās", cooldownDuration.value, cooldownPulse.value, null, cooldownAdditional.value);
  const lines = [warmup, drills].filter(Boolean);

  if (type === VAR_INTERVAL_TYPE) {
    const main = buildVarIntervalMain(varSegmentList, varLaps, varRestBetweenLaps);
    if (main) lines.push(main);
  } else if (isIntervalType(type)) {
    const count = repeatCount.value.trim();
    const len = intervalLength.value.trim();
    const pace = intervalPace.value.trim();
    const rest = restDuration.value.trim();
    let main = "Pamatdaļa: ";
    if (count && len) main += `${count}x${len}`;
    if (pace) main += ` (${pace.trim()})`;
    if (rest) main += `; caur ${rest}`;
    lines.push(main);
  } else {
    const mainLabel = isVelo ? "Velo" : "Pamatdaļa";
    let main = "";
    if (isSimple) {
      main = mainDuration.value.trim() ? `${mainLabel}: ${mainDuration.value.trim()}` : "";
    } else if (isVelo) {
      main = formatPart(mainLabel, mainDuration.value, mainPulse.value);
    } else {
      main = formatPart(mainLabel, mainDuration.value, mainPulse.value, tempoPace.value);
    }
    if (main) lines.push(main);
  }

  const footwearParts = [];
  if (spikes.checked && isIntervalType(type)) footwearParts.push("Naglenes");
  if (raceShoes.checked && (isIntervalType(type) || type === "Tempa skrējiens")) footwearParts.push("Sacensību apavi");
  if (footwearParts.length) lines.push(`• Apavi: ${footwearParts.join(", ")}`);

  if (cooldown) lines.push(cooldown);

  if (raceNutrition.checked) lines.push("• Izmantot sacensību uzturu");

  const koptreniņš = isSimple && document.getElementById("includeKoptreniņš")?.checked;
  const title = koptreniņš ? `${type} Koptreniņš` : type;
  return { title, details: lines.join("\n") };
}

function getEditPlanTraining() {
  const type = document.getElementById("epType").value;

  if (type === OTHER_RUN_TYPE) {
    const getVal = id => document.getElementById(id).value.trim();
    const getBool = id => document.getElementById(id).checked;

    function epFormatPart(label, durId, pulseId, paceId, additionalId) {
      const dur = getVal(durId);
      if (!dur) return "";
      const pulseStr = getVal(pulseId);
      const paceStr = paceId ? getVal(paceId) : "";
      const additionalStr = additionalId ? getVal(additionalId) : "";
      let result = `${label}: ${dur}`;
      if (pulseStr) result += `; ${pulseStr}`;
      if (paceStr) result += `; ${paceStr}`;
      if (additionalStr) result += `; ${additionalStr}`;
      return result;
    }

    const warmup = epFormatPart("Iesildīšanās", "epWarmupDuration", "epWarmupPulse", null, "epWarmupAdditional");
    const drills = getBool("epIncludeDrills") ? "Drill" : "";
    const cooldown = epFormatPart("Atsildīšanās", "epCooldownDuration", "epCooldownPulse", null, "epCooldownAdditional");
    const lines = [warmup, drills].filter(Boolean);
    const mainText = getVal("epFreeText");
    if (mainText) lines.push(`Pamatdaļa: ${mainText}`);
    if (getBool("epMainDrills")) lines.push("Drill");
    const mainAdditionalText = getVal("epMainAdditional");
    if (mainAdditionalText) lines.push(`Papildus uzdevums: ${mainAdditionalText}`);
    if (cooldown) lines.push(cooldown);
    if (getBool("epRaceNutrition")) lines.push("• Izmantot sacensību uzturu");
    const title = getVal("epCustomName") || OTHER_RUN_TYPE;
    const customIcon = getSelectedIcon("epIconPicker");
    return { title, details: lines.join("\n"), custom_icon: customIcon };
  }

  const isEasyOrLong = type === "Atjaunojošais/lēnais skrējiens" || type === "Garais skrējiens" || type === "Vidējas intensitātes skrējiens";
  const isSimple = type === "VFS" || type === "SFS";
  const isVelo = type === "Velo";

  const getVal = id => document.getElementById(id).value.trim();
  const getBool = id => document.getElementById(id).checked;

  function epFormatPart(label, durId, pulseId, paceId, additionalId) {
    const dur = getVal(durId);
    if (!dur) return "";
    const pulseStr = getVal(pulseId);
    const paceStr = paceId ? getVal(paceId) : "";
    const additionalStr = additionalId ? getVal(additionalId) : "";
    let result = `${label}: ${dur}`;
    if (pulseStr) result += `; ${pulseStr}`;
    if (paceStr) result += `; ${paceStr}`;
    if (additionalStr) result += `; ${additionalStr}`;
    return result;
  }

  const warmup = isEasyOrLong
    ? (getBool("epIncludeWarmup") ? epFormatPart("Iesildīšanās", "epWarmupDuration", "epWarmupPulse", null, "epWarmupAdditional") : "")
    : (isSimple || isVelo) ? "" : epFormatPart("Iesildīšanās", "epWarmupDuration", "epWarmupPulse", null, "epWarmupAdditional");
  const drills = (isEasyOrLong || isSimple || isVelo) ? "" : (getBool("epIncludeDrills") ? "Drill" : "");
  const cooldown = isEasyOrLong
    ? (getBool("epIncludeCooldown") ? epFormatPart("Atsildīšanās", "epCooldownDuration", "epCooldownPulse", null, "epCooldownAdditional") : "")
    : (isSimple || isVelo) ? "" : epFormatPart("Atsildīšanās", "epCooldownDuration", "epCooldownPulse", null, "epCooldownAdditional");
  const lines = [warmup, drills].filter(Boolean);

  if (type === VAR_INTERVAL_TYPE) {
    const main = buildVarIntervalMain(
      document.getElementById("epVarSegmentList"),
      document.getElementById("epVarLaps"),
      document.getElementById("epVarRestBetweenLaps")
    );
    if (main) lines.push(main);
  } else if (isIntervalType(type)) {
    const count = getVal("epRepeatCount");
    const len = getVal("epIntervalLength");
    const pace = getVal("epIntervalPace");
    const rest = getVal("epRestDuration");
    let main = "Pamatdaļa: ";
    if (count && len) main += `${count}x${len}`;
    if (pace) main += ` (${pace.trim()})`;
    if (rest) main += `; caur ${rest}`;
    lines.push(main);
  } else {
    const mainLabel = isVelo ? "Velo" : "Pamatdaļa";
    let main = "";
    if (isSimple) {
      main = getVal("epMainDuration") ? `${mainLabel}: ${getVal("epMainDuration")}` : "";
    } else if (isVelo) {
      main = epFormatPart(mainLabel, "epMainDuration", "epMainPulse");
    } else {
      main = epFormatPart(mainLabel, "epMainDuration", "epMainPulse", "epTempoPace");
    }
    if (main) lines.push(main);
  }

  const footwearParts = [];
  if (getBool("epSpikes") && isIntervalType(type)) footwearParts.push("Naglenes");
  if (getBool("epRaceShoes") && (isIntervalType(type) || type === "Tempa skrējiens")) footwearParts.push("Sacensību apavi");
  if (footwearParts.length) lines.push(`• Apavi: ${footwearParts.join(", ")}`);

  if (cooldown) lines.push(cooldown);

  if (getBool("epRaceNutrition")) lines.push("• Izmantot sacensību uzturu");

  const koptreniņš = isSimple && document.getElementById("epIncludeKoptreniņš")?.checked;
  const title = koptreniņš ? `${type} Koptreniņš` : type;
  return { title, details: lines.join("\n") };
}

const VAR_INTERVAL_TYPE = "Intervāli (dažāda garuma/ilguma)";
const SAME_INTERVAL_TYPE = "Intervāli (vienāda garuma/ilguma)";
const OTHER_RUN_TYPE = "Cita veida skrējiens";

function isIntervalType(type) {
  return type === "Intervāli" || type === SAME_INTERVAL_TYPE || type === VAR_INTERVAL_TYPE;
}

function displayTitle(name) {
  return name ? name.replace(/\s*\(.*?\)\s*$/, "") : "";
}

function createVarSegmentRow(container, lengthVal, paceVal, restVal, repsVal) {
  const row = document.createElement("div");
  row.className = "var-segment-row";
  row.style.marginBottom = "6px";
  row.innerHTML = `
    <label>Garums/Ilgums <input class="var-seg-length" type="text" value="${lengthVal || ""}" /></label>
    <label>Temps <input class="var-seg-pace" type="text" value="${paceVal || ""}" /></label>
    <label>Atpūta <input class="var-seg-rest" type="text" value="${restVal || ""}" /></label>
    <label>Reizes <input class="var-seg-reps" type="number" min="1" value="${repsVal || "1"}" style="width:60px" /></label>
    <button class="var-seg-remove" type="button">×</button>`;
  row.querySelector(".var-seg-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function addVarSegmentRow(container) {
  createVarSegmentRow(container, "", "", "", "");
}

function clearVarSegments(container) {
  container.innerHTML = "";
}

function getVarSegmentData(container) {
  const rows = container.querySelectorAll(".var-segment-row");
  const segments = [];
  rows.forEach(row => {
    const length = row.querySelector(".var-seg-length")?.value.trim();
    const pace = row.querySelector(".var-seg-pace")?.value.trim();
    const rest = row.querySelector(".var-seg-rest")?.value.trim();
    const reps = parseInt(row.querySelector(".var-seg-reps")?.value) || 1;
    if (length) segments.push({ length, pace, rest, reps });
  });
  return segments;
}

function syncVarLapsState(segmentList, lapsEl) {
  const segments = getVarSegmentData(segmentList);
  const hasMultiRep = segments.some(s => s.reps > 1);
  lapsEl.disabled = hasMultiRep;
  if (hasMultiRep) lapsEl.value = "1";
}

function isVarIntervalLine(line) {
  const mainIdx = line.indexOf("Pamatdaļa:");
  if (mainIdx === -1) return false;
  const after = line.slice(mainIdx + "Pamatdaļa:".length);
  const m = after.match(/\S+\([^)]+\)/);
  return m && after.indexOf(" + ", m.index) !== -1;
}

function parseVarIntervalPaceBounds(line) {
  const bounds = {};
  const segments = line.split(" + ");
  let segIdx = 0;
  segments.forEach((seg) => {
    const m = seg.match(/(?:(\d+)x)?\S+\(([^)]+)\)/);
    if (!m) return;
    const reps = parseInt(m[1]) || 1;
    const segBounds = parsePaceBounds(m[2].trim());
    if (!segBounds) return;
    for (let r = 0; r < reps; r++) {
      segIdx++;
      bounds[`seg${segIdx}`] = segBounds;
    }
  });
  return bounds;
}

function parseSegmentsFromVarLine(line) {
  const mainIdx = line.indexOf("Pamatdaļa:");
  if (mainIdx === -1) return { segments: [], laps: 1, restBetween: "", isGrouped: false };
  let after = line.slice(mainIdx + "Pamatdaļa:".length).trim();

  let restBetween = "";
  const restMatch = after.match(/;\s*caur blokiem\s+(.+)/);
  if (restMatch) {
    restBetween = restMatch[1].trim();
    after = after.slice(0, restMatch.index).trim();
  }

  let laps = 1;
  const lapsMatch = after.match(/×\s*(\d+)\s*$/);
  if (lapsMatch) {
    laps = parseInt(lapsMatch[1]);
    after = after.replace(/×\s*\d+\s*$/, "").trim();
  }

  const parts = after.split(" + ").map(s => s.trim()).filter(Boolean);
  const isGrouped = parts.some(p => /^\d+x/i.test(p));

  const segRegex = /^(?:(\d+)x)?(\S+)\(([^)]+)\)(?:\s*caur\s+(.+))?$/;
  const segments = parts.map(p => {
    const m = p.match(segRegex);
    if (m) {
      return {
        length: m[2].trim(),
        pace: m[3].trim(),
        rest: (m[4] || "").trim(),
        reps: isGrouped ? (parseInt(m[1]) || 1) : 1
      };
    }
    return { length: p, pace: "", rest: "", reps: 1 };
  });

  if (!isGrouped) {
    segments.forEach(s => { s.reps = laps; });
  }
  return { segments, laps: isGrouped ? 1 : laps, restBetween, isGrouped };
}

function buildVarIntervalMain(segmentListEl, lapsEl, restEl) {
  const segments = getVarSegmentData(segmentListEl);
  if (!segments.length) return "";
  const isGrouped = segments.some(s => s.reps > 1);
  const parts = segments.map(s => {
    let p = isGrouped ? `${s.reps}x${s.length}` : s.length;
    if (s.pace) p += `(${s.pace})`;
    if (s.rest) p += ` caur ${s.rest}`;
    return p;
  });
  let main = "Pamatdaļa: " + parts.join(" + ");
  if (!isGrouped) {
    const laps = lapsEl.value.trim();
    if (laps) main += ` × ${laps}`;
  }
  const rest = restEl.value.trim();
  if (rest) main += `; caur blokiem ${rest}`;
  return main;
}

function parseVarIntervalMain(mainText, segmentListEl, lapsEl, restEl) {
  clearVarSegments(segmentListEl);
  const result = parseSegmentsFromVarLine(mainText);
  result.segments.forEach(s => createVarSegmentRow(segmentListEl, s.length, s.pace, s.rest, s.reps));
  if (!segmentListEl.children.length) {
    createVarSegmentRow(segmentListEl, "", "", "", "");
  }
  lapsEl.value = String(result.laps);
  if (result.restBetween) restEl.value = result.restBetween;
  syncVarLapsState(segmentListEl, lapsEl);
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
    templates = await getTemplates(null);
  } catch (e) {
    templates = [];
  }

  await loadNonTemplateData();
}

async function refreshWeekStatuses(athleteIds) {
  if (!athleteIds) {
    athleteIds = athletes.filter(a => a.role !== "coach").map(a => a.id);
  }
  if (!athleteIds.length) return;
  const nextWeekMonday = new Date(getMonday(new Date()));
  nextWeekMonday.setDate(nextWeekMonday.getDate() + 7);
  const startStr = formatDateISO(nextWeekMonday);
  weekStatuses = await getWeekStatuses(athleteIds, startStr);
  const selectedId = getSelectedAthleteId();
  if (selectedId) renderAthleteDropdown();
}

async function loadNonTemplateData() {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;

  showLoading();

  const weekStart = currentWeekStart;
  const weekEnd = getWeekEnd(weekStart);
  const weekStartStr = formatDateISO(weekStart);
  const weekEndStr = formatDateISO(weekEnd);
  async function safeGet(promise, fallback) {
    try { return await promise; } catch (e) { return fallback; }
  }

  const [
    plansRes,
    racesRes,
    logEntriesRes,
    recordsRes,
    weeklyTrendRes,
    monthlyTrendRes,
    dayNotesRes,
    weeklySummaryRes,
    restrictionsRes,
    weekBlockTypesRes,
    diaryEntriesRes,
    selfTestsRes,
    polarTestsRes,
    healthEntriesRes,
    labTestsRes,
    allPlansRes,
    allLogEntriesRes,
  ] = await Promise.all([
    safeGet(getPlans(athleteId, weekStartStr, weekEndStr), []),
    safeGet(getRacesForWeek(athleteId, weekStartStr, weekEndStr), []),
    safeGet(getLogEntries(athleteId, weekStartStr, weekEndStr), []),
    safeGet(getRecords(athleteId), []),
    safeGet(getWeeklyTrend(athleteId, trendWeeks), []),
    safeGet(getMonthlyTrend(athleteId, trendMonths), []),
    safeGet(getDayNotes(athleteId, weekStartStr, weekEndStr), []),
    safeGet(getWeeklySummary(athleteId, weekStartStr), null),
    safeGet(getRestrictions(athleteId), []),
    safeGet(getWeekBlockTypes(athleteId), []),
    safeGet(getDiaryEntries(athleteId), []),
    safeGet(getSelfTests(athleteId), []),
    safeGet(getPolarTests(athleteId), []),
    safeGet(getHealthEntries(athleteId), []),
    safeGet(getLabTests(athleteId), []),
    safeGet(getAllPlans(athleteId), []),
    safeGet(getAllLogEntries(athleteId), []),
  ]);

  plans = plansRes;
  races = racesRes;
  logEntries = logEntriesRes;
  records = recordsRes;
  weeklyTrend = weeklyTrendRes;
  monthlyTrend = monthlyTrendRes;
  dayNotes = dayNotesRes;
  weeklySummary = weeklySummaryRes;
  restrictions = restrictionsRes;
  weekBlockTypes = weekBlockTypesRes;
  diaryEntries = diaryEntriesRes;
  selfTests = selfTestsRes;
  polarTests = polarTestsRes;
  healthEntries = healthEntriesRes;
  labTests = labTestsRes;
  allPlans = allPlansRes;
  allLogEntries = allLogEntriesRes;

  await safeGet(refreshAthleteHealthSet(), undefined);
  await safeGet(acknowledgeNotCompletedPlans(athleteId), undefined);
  await safeGet(refreshAthleteNotCompletedSet(), undefined);

  if (logEntries.length && (!weeklySummary || (!weeklySummary.run_km && !weeklySummary.run_min && !weeklySummary.vfs_sfs_min && !weeklySummary.velo_min))) {
    const autoRunKm = logEntries.reduce((s, e) => s + (e.distance_km || 0), 0);
    const autoTotalMin = logEntries.reduce((s, e) => s + (e.duration_min || 0), 0);
    const autoGymMin = logEntries.filter(e => e.activity_type === "gym").reduce((s, e) => s + (e.duration_min || 0), 0);
    const autoBikeMin = logEntries.filter(e => e.activity_type === "bike").reduce((s, e) => s + (e.duration_min || 0), 0);
    try {
      await upsertWeeklySummary({
        athlete_id: athleteId,
        week_start: weekStartStr,
        run_km: autoRunKm,
        run_min: autoTotalMin / 60,
        vfs_sfs_min: autoGymMin / 60,
        velo_min: autoBikeMin / 60,
        coach_comment: weeklySummary?.coach_comment || "",
        athlete_comment: weeklySummary?.athlete_comment || "",
      });
      weeklySummary = await getWeeklySummary(athleteId, weekStartStr);
    } catch (e) {
    console.error(e);
  }
  }

  if (viewMode === "month") {
    const monthStart = getMonthStart(currentMonthDate);
    const monthEnd = getMonthEnd(currentMonthDate);
    const ms = formatDateISO(monthStart);
    const me = formatDateISO(monthEnd);
    const [mp, mr, ml, md] = await Promise.all([
      safeGet(getPlans(athleteId, ms, me), []),
      safeGet(getRacesForWeek(athleteId, ms, me), []),
      safeGet(getLogEntries(athleteId, ms, me), []),
      safeGet(getDayNotes(athleteId, ms, me), []),
    ]);
    monthPlans = mp;
    monthRaces = mr;
    monthLogEntries = ml;
    monthDayNotes = md;
  }

  await loadWeekOverviewPlanData();
  await refreshWeekStatuses([athleteId]);
  render();
  refreshRaceCalendar();
  hideLoading();
}

function showLoading() {
  document.getElementById("loadingOverlay").hidden = false;
}

function hideLoading() {
  document.getElementById("loadingOverlay").hidden = true;
}

async function loadWeekOverviewPlanData() {
  if (activeRole !== "coach") return;
  athleteNextWeeksPlans = {};
  const monday = getMonday(new Date());
  const endDate = addDays(monday, 28);
  const startStr = formatDateISO(monday);
  const endStr = formatDateISO(endDate);
  const results = await Promise.all(
    athletes.map(a =>
      getPlans(a.id, startStr, endStr).catch(() => [])
    )
  );
  athletes.forEach((a, i) => {
    athleteNextWeeksPlans[a.id] = results[i];
  });
}

async function initApp() {
  try {
    activeRole = currentProfile?.role || "athlete";
    athleteSelectorPanel.hidden = activeRole !== "coach";
    athletes = activeRole === "coach" ? await getAthletes() : [currentProfile];


    if (activeRole === "coach" && athletes.length && !athleteSelect.value) {
      athleteSelect.value = athletes[0].id;
    }

    if (activeRole === "athlete") {
      athleteSelect.value = currentUser.id;
    }

    renderAthleteDropdown();

    await loadAllData();
    if (activeRole === "coach") await refreshWeekStatuses();
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

  function weekIndicators(athleteId) {
    const statuses = weekStatuses[athleteId];
    if (!statuses) return '<span class="week-slot week-slot-no-plans"></span><span class="week-slot week-slot-no-plans"></span><span class="week-slot week-slot-no-plans"></span><span class="week-slot week-slot-no-plans"></span>';
    const anyFull = statuses.some(Boolean);
    return statuses
      .map((full) => {
        return `<span class="week-slot ${full ? "week-slot-done" : ""}${!anyFull ? " week-slot-no-plans" : ""}">${full ? "✓" : ""}</span>`;
      })
      .join("");
  }

  if (athleteSelect.value) {
    const selectedAthlete = athletes.find((a) => a.id === athleteSelect.value);
    selected.innerHTML = selectedAthlete
      ? `<span class="athlete-name">${selectedAthlete.full_name}</span><span class="athlete-indicators">${weekIndicators(selectedAthlete.id)}</span>`
      : "";
  }

  list.innerHTML = athletes
    .map((a) => {
      const isSelected = a.id === athleteSelect.value;
      const healthBadge = athleteHealthSet.has(a.id) ? '<span class="health-dropdown-badge">⚕</span> ' : "";
      const notCompletedBadge = athleteNotCompletedSet.has(a.id) ? '<span class="not-completed-icon">!</span> ' : "";
      return `<div class="athlete-row ${isSelected ? "selected" : ""}" data-athlete-id="${a.id}">
        <span class="athlete-name">${healthBadge}${notCompletedBadge}${a.full_name}</span>
        <span class="athlete-indicators">${weekIndicators(a.id)}</span>
      </div>`;
    })
    .join("");
}

const TEMPLATE_GROUPS = [
  { key: "recovery", label: "Lēnie/vidēji/garie skrējieni", types: ["Atjaunojošais/lēnais skrējiens", "Vidējas intensitātes skrējiens", "Garais skrējiens"] },
  { key: "intervals", label: "Intervāli", types: ["Intervāli (vienāda garuma/ilguma)", "Intervāli (dažāda garuma/ilguma)"] },
  { key: "tempo", label: "Tempa skrējieni", types: ["Tempa skrējiens"] },
  { key: "other", label: "Citi skrējieni", types: ["Cita veida skrējiens"] },
  { key: "vfs_sfs", label: "VFS/SFS", types: ["VFS", "SFS"] },
  { key: "velo", label: "Velo", types: ["Velo"] },
];

function renderTemplates() {
  const athleteId = getSelectedAthleteId();
  const allTemplates = templates.filter(t => !t.athlete_id);
  const athleteTemplates = templates.filter(t => t.athlete_id === athleteId);

  renderTemplateDropdown("allTemplatesDropdown", allTemplates);
  renderTemplateDropdown("athleteTemplatesDropdown", athleteTemplates);
}

function renderTemplateDropdown(containerId, templatesList) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const listEl = container.querySelector(".template-dropdown-list");
  const selectedEl = container.querySelector(".dropdown-selected");

  const groups = [];
  for (const group of TEMPLATE_GROUPS) {
    const groupTemplates = templatesList.filter(t => group.types.includes(t.name));
    if (groupTemplates.length > 0) {
      groups.push({ ...group, templates: groupTemplates });
    }
  }

  listEl.innerHTML = groups.map(group => `
    <div class="template-dropdown-group">
      <div class="template-dropdown-group-title">${group.label}</div>
      ${group.templates.map(t => {
        const details = t.details ? formatDetailsForCard(t.details).replace(/\n/g, ' | ') : '';
        const isSelected = selectedTemplateId === t.id;
        return `<div class="template-dropdown-item ${isSelected ? 'selected' : ''}" data-template-id="${t.id}">
          <div class="template-dropdown-item-name">${t.name}</div>
          ${details ? `<div class="template-dropdown-item-details">${details}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `).join('');

  const selected = templatesList.find(t => t.id === selectedTemplateId);
  if (selected) {
    selectedEl.textContent = selected.name;
  } else {
    selectedEl.textContent = "Izvēlies sagatavi...";
  }
}

function renderCustomPreview() {
  const training = getGeneratedTraining();
  customPreview.innerHTML = `<strong>${displayTitle(training.title)}</strong><span>${formatDetailsForCard(training.details).replace(/\n/g, "<br>")}</span>`;
}

function renderSourcePicker() {
  renderCustomBuilder();
  renderCustomPreview();
}

function renderCustomBuilder() {
  const type = customType.value;
  if (!type) {
    intervalFields.hidden = true;
    mainFields.hidden = true;
    freeTextRow.hidden = true;
    mainExtraSection.hidden = true;
    drillsRow.hidden = true;
    warmupToggleRow.hidden = true;
    cooldownToggleRow.hidden = true;
    document.getElementById("warmupSection").hidden = true;
    document.getElementById("cooldownSection").hidden = true;
    warmupFields.hidden = true;
    cooldownFields.hidden = true;
    document.getElementById("warmupAdditionalRow").hidden = true;
    document.getElementById("cooldownAdditionalRow").hidden = true;
    const ktr = document.getElementById("koptreniņšRow");
    if (ktr) ktr.hidden = true;
    document.getElementById("customIconPicker").hidden = true;
    setSelectedIcon("customIconPicker", "");
    raceNutritionRow.hidden = true;
    raceNutrition.checked = false;
    spikesRow.hidden = true;
    spikes.checked = false;
    raceShoesRow.hidden = true;
    raceShoes.checked = false;
    document.querySelector(".preview-compact").hidden = true;
    document.querySelector(".main-content-column").hidden = true;
    document.getElementById("saveTemplateOnlyBtn").hidden = true;
    document.getElementById("saveTemplateForAthleteBtn").hidden = true;
    document.getElementById("updateTemplateBtn").hidden = true;
    document.getElementById("deleteTemplateBtn").hidden = true;
    return;
  }
  document.querySelector(".preview-compact").hidden = false;
  document.querySelector(".main-content-column").hidden = false;
  document.getElementById("saveTemplateOnlyBtn").hidden = false;
  document.getElementById("saveTemplateForAthleteBtn").hidden = false;
  const isEasyOrLong = type === "Atjaunojošais/lēnais skrējiens" || type === "Garais skrējiens" || type === "Vidējas intensitātes skrējiens";
  const isSimple = type === "VFS" || type === "SFS";
  const isVelo = type === "Velo";
  const isOtherRun = type === OTHER_RUN_TYPE;
  const isSameInterval = type === SAME_INTERVAL_TYPE || type === "Intervāli";
  const isVarInterval = type === VAR_INTERVAL_TYPE;
  const isInterval = isSameInterval || isVarInterval;

  intervalFields.hidden = !isSameInterval;
  varIntervalFields.hidden = !isVarInterval;
  mainFields.hidden = isInterval || isOtherRun;
  freeTextRow.hidden = !isOtherRun;
  document.getElementById("customIconPicker").hidden = !isOtherRun;
  if (!isOtherRun) setSelectedIcon("customIconPicker", "");
  drillsRow.hidden = isEasyOrLong || isSimple || isVelo;
  mainExtraSection.hidden = !isOtherRun;

  const koptreniņšRow = document.getElementById("koptreniņšRow");
  if (koptreniņšRow) koptreniņšRow.hidden = !isSimple;

  raceNutritionRow.hidden = false;
  const isTempo = type === "Tempa skrējiens";
  spikesRow.hidden = !isInterval;
  if (!isInterval) spikes.checked = false;
  raceShoesRow.hidden = !(isInterval || isTempo);
  if (!(isInterval || isTempo)) raceShoes.checked = false;

  if (isVarInterval) {
    if (!varSegmentList.children.length) addVarSegmentRow(varSegmentList);
    syncVarLapsState(varSegmentList, varLaps);
  } else {
    clearVarSegments(varSegmentList);
  }

  document.getElementById("customNameRow").hidden = !isOtherRun;

  warmupToggleRow.hidden = !isEasyOrLong;
  cooldownToggleRow.hidden = !isEasyOrLong;

  if (isEasyOrLong) {
    document.getElementById("warmupSection").hidden = false;
    document.getElementById("cooldownSection").hidden = false;
    warmupFields.hidden = !includeWarmup.checked;
    cooldownFields.hidden = !includeCooldown.checked;
    document.getElementById("warmupAdditionalRow").hidden = !includeWarmup.checked;
    document.getElementById("cooldownAdditionalRow").hidden = !includeCooldown.checked;
  } else if (isSimple || isVelo) {
    document.getElementById("warmupSection").hidden = true;
    document.getElementById("cooldownSection").hidden = true;
    warmupFields.hidden = true;
    cooldownFields.hidden = true;
    document.getElementById("warmupAdditionalRow").hidden = true;
    document.getElementById("cooldownAdditionalRow").hidden = true;
  } else {
    document.getElementById("warmupSection").hidden = false;
    document.getElementById("cooldownSection").hidden = false;
    warmupFields.hidden = false;
    cooldownFields.hidden = false;
    document.getElementById("warmupAdditionalRow").hidden = false;
    document.getElementById("cooldownAdditionalRow").hidden = false;
  }

  const mainPulseLabel = document.getElementById("mainPulseLabel");
  const mainPaceLabel = document.getElementById("mainPaceLabel");

  if (isSimple) {
    if (mainPulseLabel) mainPulseLabel.hidden = true;
  } else {
    if (mainPulseLabel) mainPulseLabel.hidden = false;
  }

  if (isSimple || isVelo) {
    if (mainPaceLabel) mainPaceLabel.hidden = true;
  } else {
    if (mainPaceLabel) mainPaceLabel.hidden = false;
  }

  const mainSectionLabel = document.getElementById("mainSectionLabel");
  if (isVelo && mainSectionLabel) {
    mainSectionLabel.textContent = "Velo";
  } else if (mainSectionLabel) {
    mainSectionLabel.textContent = "Pamatdaļa";
  }
}

function renderEditPlanBuilder() {
  const type = document.getElementById("epType").value;
  const isEasyOrLong = type === "Atjaunojošais/lēnais skrējiens" || type === "Garais skrējiens" || type === "Vidējas intensitātes skrējiens";
  const isSimple = type === "VFS" || type === "SFS";
  const isVelo = type === "Velo";
  const isOtherRun = type === OTHER_RUN_TYPE;
  const isSameInterval = type === SAME_INTERVAL_TYPE || type === "Intervāli";
  const isVarInterval = type === VAR_INTERVAL_TYPE;
  const isInterval = isSameInterval || isVarInterval;

  document.getElementById("epIntervalFields").hidden = !isSameInterval;
  document.getElementById("epVarIntervalFields").hidden = !isVarInterval;
  document.getElementById("epMainFields").hidden = isInterval || isOtherRun;
  document.getElementById("epFreeTextRow").hidden = !isOtherRun;
  document.getElementById("epIconPicker").hidden = !isOtherRun;
  if (!isOtherRun) setSelectedIcon("epIconPicker", "");
  document.getElementById("epDrillsRow").hidden = isEasyOrLong || isSimple || isVelo;
  document.getElementById("epMainExtraSection").hidden = !isOtherRun;

  const epKoptreniņšRow = document.getElementById("epKoptreniņšRow");
  if (epKoptreniņšRow) epKoptreniņšRow.hidden = !isSimple;

  const epIsTempo = type === "Tempa skrējiens";
  document.getElementById("epSpikesRow").hidden = !isInterval;
  if (!isInterval) document.getElementById("epSpikes").checked = false;
  document.getElementById("epRaceShoesRow").hidden = !(isInterval || epIsTempo);
  if (!(isInterval || epIsTempo)) document.getElementById("epRaceShoes").checked = false;

  if (isVarInterval) {
    if (!document.getElementById("epVarSegmentList").children.length) addVarSegmentRow(document.getElementById("epVarSegmentList"));
    syncVarLapsState(document.getElementById("epVarSegmentList"), document.getElementById("epVarLaps"));
  } else {
    clearVarSegments(document.getElementById("epVarSegmentList"));
  }

  document.getElementById("epCustomNameRow").hidden = !isOtherRun;

  document.getElementById("epWarmupToggleRow").hidden = !isEasyOrLong;
  document.getElementById("epCooldownToggleRow").hidden = !isEasyOrLong;

  if (isEasyOrLong) {
    document.getElementById("epWarmupSection").hidden = false;
    document.getElementById("epCooldownSection").hidden = false;
    document.getElementById("epWarmupFields").hidden = !document.getElementById("epIncludeWarmup").checked;
    document.getElementById("epCooldownFields").hidden = !document.getElementById("epIncludeCooldown").checked;
    document.getElementById("epWarmupAdditionalRow").hidden = !document.getElementById("epIncludeWarmup").checked;
    document.getElementById("epCooldownAdditionalRow").hidden = !document.getElementById("epIncludeCooldown").checked;
  } else if (isSimple || isVelo) {
    document.getElementById("epWarmupSection").hidden = true;
    document.getElementById("epCooldownSection").hidden = true;
    document.getElementById("epWarmupFields").hidden = true;
    document.getElementById("epCooldownFields").hidden = true;
    document.getElementById("epWarmupAdditionalRow").hidden = true;
    document.getElementById("epCooldownAdditionalRow").hidden = true;
  } else {
    document.getElementById("epWarmupSection").hidden = false;
    document.getElementById("epCooldownSection").hidden = false;
    document.getElementById("epWarmupFields").hidden = false;
    document.getElementById("epCooldownFields").hidden = false;
    document.getElementById("epWarmupAdditionalRow").hidden = false;
    document.getElementById("epCooldownAdditionalRow").hidden = false;
  }

  const mainPulseLabel = document.getElementById("epMainPulseLabel");
  if (isSimple) {
    if (mainPulseLabel) mainPulseLabel.hidden = true;
  } else {
    if (mainPulseLabel) mainPulseLabel.hidden = false;
  }

  const mainSectionLabel = document.getElementById("epMainSectionLabel");
  if (isVelo && mainSectionLabel) {
    mainSectionLabel.textContent = "Velo";
  } else if (mainSectionLabel) {
    mainSectionLabel.textContent = "Pamatdaļa";
  }

  renderEditPlanPreview();
}

function renderEditPlanPreview() {
  const training = getEditPlanTraining();
  const preview = document.getElementById("epPreview");
  preview.innerHTML = `<strong>${displayTitle(training.title)}</strong><span>${formatDetailsForCard(training.details).replace(/\n/g, "<br>")}</span>`;
}

function parsePlanToForm(plan) {
  const knownTypes = ["Atjaunojošais/lēnais skrējiens", "Vidējas intensitātes skrējiens", "Garais skrējiens", "Intervāli", SAME_INTERVAL_TYPE, VAR_INTERVAL_TYPE, "Tempa skrējiens", OTHER_RUN_TYPE, "VFS", "SFS", "Velo", "Cits"];
  const isKnownType = knownTypes.includes(plan.title);
  const resolvedType = isKnownType ? plan.title : OTHER_RUN_TYPE;

  document.getElementById("epType").value = resolvedType;
  document.getElementById("epCustomName").value = isKnownType ? "" : plan.title;
  document.getElementById("epWarmupDuration").value = "15 min";
  document.getElementById("epWarmupPulse").value = "130-145";
  document.getElementById("epIncludeWarmup").checked = false;
  document.getElementById("epIncludeCooldown").checked = false;
  document.getElementById("epIncludeDrills").checked = false;
  document.getElementById("epMainAdditional").value = "";
  document.getElementById("epMainDrills").checked = false;
  document.getElementById("epCooldownDuration").value = "15 min";
  document.getElementById("epCooldownPulse").value = "120-135";
  document.getElementById("epIntervalLength").value = "600 m";
  document.getElementById("epRepeatCount").value = "6";
  document.getElementById("epIntervalPace").value = "3:45/km";
  document.getElementById("epRestDuration").value = "2 min";
  document.getElementById("epMainDuration").value = "45 min";
  document.getElementById("epMainPulse").value = "145-155";
  document.getElementById("epTempoPace").value = "4:15/km";
  document.getElementById("epFreeText").value = "";
  document.getElementById("epWarmupAdditional").value = "";
  document.getElementById("epCooldownAdditional").value = "";
  document.getElementById("epIncludeWarmup").checked = false;
  document.getElementById("epIncludeCooldown").checked = false;
  document.getElementById("epIncludeDrills").checked = false;
  document.getElementById("epRaceNutrition").checked = false;
  document.getElementById("epSpikes").checked = false;
  document.getElementById("epRaceShoes").checked = false;

  const details = plan.details || "";
  const lines = details.split("\n").filter(Boolean);
  let epMainSeen = false;

  for (const line of lines) {
    if (line.startsWith("Iesildīšanās:")) {
      document.getElementById("epIncludeWarmup").checked = true;
      const m = line.match(/: (.+?)(?:; (.+?)(?:; (.+))?)?$/);
      if (m) {
        if (m[1]) document.getElementById("epWarmupDuration").value = m[1];
        if (m[2]) document.getElementById("epWarmupPulse").value = m[2];
        if (m[3]) document.getElementById("epWarmupAdditional").value = m[3];
      }
    } else if (line.startsWith("Atsildīšanās:")) {
      document.getElementById("epIncludeCooldown").checked = true;
      const m = line.match(/: (.+?)(?:; (.+?)(?:; (.+))?)?$/);
      if (m) {
        if (m[1]) document.getElementById("epCooldownDuration").value = m[1];
        if (m[2]) document.getElementById("epCooldownPulse").value = m[2];
        if (m[3]) document.getElementById("epCooldownAdditional").value = m[3];
      }
    } else if (line === "Drill") {
      if (epMainSeen) {
        document.getElementById("epMainDrills").checked = true;
      } else {
        document.getElementById("epIncludeDrills").checked = true;
      }
    } else if (line === "Sacensību uzturs" || line === "• Izmantot sacensību uzturu") {
      document.getElementById("epRaceNutrition").checked = true;
    } else if (line.startsWith("Apavi:") || line.startsWith("• Apavi:")) {
      const footwearText = line.replace(/^•\s*/, "").slice("Apavi:".length);
      document.getElementById("epSpikes").checked = footwearText.includes("Naglenes");
      document.getElementById("epRaceShoes").checked = footwearText.includes("Sacensību apavi");
    } else if (line.startsWith("Papildus uzdevums:")) {
      document.getElementById("epMainAdditional").value = line.slice("Papildus uzdevums:".length).trim();
    } else if (line.startsWith("Pamatdaļa:") || line.startsWith("Velo:")) {
      epMainSeen = true;
      const isVelo = line.startsWith("Velo:");
      const mainContent = line.replace(/^(Pamatdaļa|Velo):\s*/, "");
      if (isVelo) document.getElementById("epType").value = "Velo";
      if (mainContent) {
        if (resolvedType === OTHER_RUN_TYPE) {
          document.getElementById("epFreeText").value = mainContent;
        } else {
          const isVar = plan.title === VAR_INTERVAL_TYPE && isVarIntervalLine(line);
          if (isVar) {
            parseVarIntervalMain(line,
              document.getElementById("epVarSegmentList"),
              document.getElementById("epVarLaps"),
              document.getElementById("epVarRestBetweenLaps")
            );
          } else if (mainContent.match(/^(\d+)x([\d.\s]+\s*\w+)/) && isIntervalType(plan.title)) {
            const intervalMatch = mainContent.match(/^(\d+)x([\d.\s]+\s*\w+)/);
            if (intervalMatch) {
              document.getElementById("epRepeatCount").value = intervalMatch[1];
              document.getElementById("epIntervalLength").value = intervalMatch[2];
            }
            const paceMatch = mainContent.match(/\(([^)]+)\)/);
            if (paceMatch) document.getElementById("epIntervalPace").value = paceMatch[1].trim();
            const restMatch = mainContent.match(/caur\s+(.+)/);
            if (restMatch) document.getElementById("epRestDuration").value = restMatch[1];
          } else {
            const pulseMatch = mainContent.match(/(.+?);\s*(.+?)(?:sr)?(?:;\s*(.+))?$/);
            if (pulseMatch) {
              document.getElementById("epMainDuration").value = pulseMatch[1].trim();
              document.getElementById("epMainPulse").value = pulseMatch[2].trim();
              if (pulseMatch[3]) document.getElementById("epTempoPace").value = pulseMatch[3].trim();
            } else {
              const tempoMatch = mainContent.match(/^(.+?);\s+(.+)/);
              if (tempoMatch) {
                document.getElementById("epMainDuration").value = tempoMatch[1].trim();
                document.getElementById("epTempoPace").value = tempoMatch[2].trim();
              } else {
                document.getElementById("epMainDuration").value = mainContent.trim();
              }
            }
          }
        }
      }
    }
  }
  renderEditPlanBuilder();
  setSelectedIcon("epIconPicker", plan.custom_icon || "");
}

function loadTemplateToForm(template) {
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

  const knownTypes = ["Atjaunojošais/lēnais skrējiens", "Vidējas intensitātes skrējiens", "Garais skrējiens", "Intervāli", SAME_INTERVAL_TYPE, VAR_INTERVAL_TYPE, "Tempa skrējiens", OTHER_RUN_TYPE, "VFS", "SFS", "Velo", "Cits"];
  const isKnownType = knownTypes.includes(name);
  let type = name;
  if (!isKnownType) type = OTHER_RUN_TYPE;
  if (name === "Intervālu treniņš") type = "Intervāli";
  setVal("customType", type);
  setVal("customName", isKnownType ? "" : name);

  // Reset form defaults
  clearVarSegments(varSegmentList);
  setChecked("includeWarmup", true);
  setChecked("includeCooldown", true);
  setChecked("includeDrills", false);
  setChecked("mainDrills", false);
  setChecked("includeKoptreniņš", false);
  setChecked("raceNutrition", false);
  setChecked("spikes", false);
  setChecked("raceShoes", false);
  setVal("warmupDuration", "");
  setVal("warmupPulse", "");
  setVal("warmupAdditional", "");
  setVal("cooldownDuration", "");
  setVal("cooldownPulse", "");
  setVal("cooldownAdditional", "");
  setVal("mainDuration", "");
  setVal("mainPulse", "");
  setVal("tempoPace", "");
  setVal("intervalLength", "");
  setVal("repeatCount", "");
  setVal("intervalPace", "");
  setVal("restDuration", "");
  setVal("customFreeText", "");
  setVal("mainAdditional", "");

  const lines = details.split("\n").map(l => l.trim()).filter(Boolean);

  function parseLine(line) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return { label: line, rest: line };
    return { label: line.slice(0, colonIdx).trim(), rest: line.slice(colonIdx + 1).trim() };
  }

  let hasDrills = false;
  let hasMainDrills = false;
  let hasWarmup = false;
  let hasCooldown = false;
  let mainSeen = false;

  for (const line of lines) {
    const parsed = parseLine(line);
    const label = parsed.label;
    const rest = parsed.rest;

    if (label === "Iesildīšanās") {
      hasWarmup = true;
      const parts = rest.split(";").map(s => s.trim());
      setVal("warmupDuration", parts[0] || "");
      if (parts[1]) setVal("warmupPulse", parts[1]);
      if (parts[2]) setVal("warmupAdditional", parts[2]);
    } else if (label === "Atsildīšanās") {
      hasCooldown = true;
      const parts = rest.split(";").map(s => s.trim());
      setVal("cooldownDuration", parts[0] || "");
      if (parts[1]) setVal("cooldownPulse", parts[1]);
      if (parts[2]) setVal("cooldownAdditional", parts[2]);
    } else if (line === "Drill") {
      if (mainSeen) {
        hasMainDrills = true;
      } else {
        hasDrills = true;
      }
    } else if (line === "Sacensību uzturs" || line === "• Izmantot sacensību uzturu") {
      setChecked("raceNutrition", true);
    } else if (label === "Apavi" || label === "• Apavi") {
      setChecked("spikes", rest.includes("Naglenes"));
      setChecked("raceShoes", rest.includes("Sacensību apavi"));
    } else if (label === "Papildus uzdevums") {
      setVal("mainAdditional", rest);
    } else if (label === "Pamatdaļa" || label === "Velo") {
      mainSeen = true;
      if (type === VAR_INTERVAL_TYPE && isVarIntervalLine(line)) {
        parseVarIntervalMain(line, varSegmentList, varLaps, varRestBetweenLaps);
      } else if (type === OTHER_RUN_TYPE) {
        setVal("customFreeText", rest);
      } else {
        const intervalMatch = rest.match(/(\d+)x(\S+)/);
        if (intervalMatch) {
          setVal("repeatCount", intervalMatch[1]);
          setVal("intervalLength", intervalMatch[2]);
          const paceMatch = rest.match(/\(([^)]+)\)/);
          if (paceMatch) setVal("intervalPace", paceMatch[1].trim());
          const restMatch = rest.match(/caur\s+(.+)$/);
          if (restMatch) setVal("restDuration", restMatch[1]);
        } else {
          const durMatch = rest.match(/^(\d+)\s*(?:['′]|min)/);
          if (durMatch) setVal("mainDuration", durMatch[1] + " min");
          const pulseMatch = rest.match(/(\d+-\d+)/);
          if (pulseMatch) setVal("mainPulse", pulseMatch[1]);
          const paceMatch = rest.match(/;\s*(\d+:\d+\/\w+)$/);
          if (paceMatch) setVal("tempoPace", paceMatch[1]);
        }
      }
    }
  }

  setChecked("includeDrills", hasDrills);
  setChecked("mainDrills", hasMainDrills);
  setChecked("includeWarmup", hasWarmup);
  setChecked("includeCooldown", hasCooldown);
  if (name.includes("Koptreniņš")) setChecked("includeKoptreniņš", true);

  renderCustomBuilder();
  renderCustomPreview();
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

function formatDetailsForCard(details) {
  if (!details) return "";
  const lines = details.split("\n");
  const result = [];
  for (const line of lines) {
    if (line.trim() === "Drill") {
      if (result.length > 0) {
        result[result.length - 1] += " + Drill";
      }
    } else if (line.startsWith("Pamatdaļa:")) {
      result.push(`<strong>${line}</strong>`);
    } else {
      result.push(line);
    }
  }
  return result.join("\n");
}

function badgeForTitle(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("vieglais") || t.includes("atjaunojošais") || t.includes("lēnais")) return "🐢";
  if (t.includes("vidējas intensitātes")) return "🛳️";
  if (t.includes("garais")) return "⌛";
  if (t.includes("intervāli")) return "⚡";
  if (t.includes("tempa")) return "📈";
  if (t.includes("vfs") || t.includes("sfs")) return "💪";
  if (t.includes("velo")) return "🚴";
  return "🎲";
}

function getSelectedIcon(pickerId) {
  const sel = document.querySelector(`#${pickerId} .icon-btn.selected`);
  return sel ? sel.dataset.icon : "";
}

function setSelectedIcon(pickerId, icon) {
  document.querySelectorAll(`#${pickerId} .icon-btn`).forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.icon === icon);
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".icon-btn");
  if (!btn) return;
  const picker = btn.closest(".icon-picker");
  if (!picker) return;
  picker.querySelectorAll(".icon-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
});

function renderPlanCard(plan) {
  const isCoach = activeRole === "coach";
  const coachDisabled = !isCoach ? "disabled" : "";
  const notCompleted = plan.completed === false;
  const todBadge = plan.time_of_day ? `<span class="tod-badge tod-${plan.time_of_day}">${todLabel(plan.time_of_day)}</span>` : "";
  const hasMoved = plan.original_date && plan.date !== plan.original_date;
  const movedBadge = hasMoved ? `<span class="switch-badge">⇄ no ${formatShortDate(plan.original_date)}</span>` : "";
  const planLog = logEntries.find(l => l.plan_id === plan.id);
  const planLogData = planLog?.log_data || [];
  const hasPamatdala = plan.details && plan.details.includes("Pamatdaļa:");

  function renderInlineLog(data, paceBoundsMap, plannedIntervalCount) {
    return data.map(entry => {
      let line = `<div class="log-line">`;
      if (entry.intervals && entry.intervals.length) {
        const done = entry.intervals.filter(Boolean);
        const colored = done.map((v, i) => {
          const spaceIdx = v.indexOf(' ');
          const paceStr = spaceIdx > -1 && spaceIdx < v.length - 1 ? v.substring(spaceIdx + 1).trim() : v;
          const distStr = spaceIdx > -1 && spaceIdx < v.length - 1 ? v.substring(0, spaceIdx) : '';
          const p = parseAthleteInput(paceStr);
          const segBounds = paceBoundsMap?.[`seg${i + 1}`] || paceBoundsMap?.[entry.section];
          const c = p ? getPaceColor(p, segBounds) : "";
          const coloredPace = c ? `<span class="pace-text-${c}">${paceStr}</span>` : paceStr;
          return distStr ? distStr + ' ' + coloredPace : coloredPace;
        });
        let display;
        const hasPlan = !!(paceBoundsMap && Object.keys(paceBoundsMap).length);
        if (hasPlan && plannedIntervalCount > 0 && done.length > plannedIntervalCount) {
          const planned = colored.slice(0, plannedIntervalCount);
          const extras = colored.slice(plannedIntervalCount);
          display = planned.join(", ") + " + " + extras.join(" + ");
        } else {
          display = colored.join(", ");
        }
        line += `${entry.section === "Pamatdaļa" ? `<strong>${entry.section}: ${display}</strong>` : `${entry.section}: ${display}`}`;
      } else {
        const dur = entry.duration || "";
        const rawPulse = entry.pulse ? entry.pulse + (entry.pulse.includes("vid.") ? "" : "vid.") : "";
        const bounds = paceBoundsMap?.[entry.section];
        let paceHtml = "";
        if (entry.pace) {
          const p = parseAthleteInput(entry.pace);
          const c = p && bounds ? getPaceColor(p, bounds) : "";
          paceHtml = c ? `<span class="pace-text-${c}">${entry.pace}</span>` : entry.pace;
        }
        let pulseHtml = "";
        if (rawPulse) {
          pulseHtml = "; " + entry.pulse + "vid.";
        }
        line += `${entry.section === "Pamatdaļa" ? `<strong>${entry.section}: ${dur}${pulseHtml}${paceHtml ? "; " + paceHtml : ""}</strong>` : `${entry.section}: ${dur}${pulseHtml}${paceHtml ? "; " + paceHtml : ""}`}`;
      }
      line += `</div>`;
      return line;
    }).join("");
  }

  const paceBoundsMap = buildPaceBoundsMap(plan.details);
  const plannedIntervalCount = getPlannedIntervalCount(plan.details);
  const feelingBadge = planLog?.feeling || planLog?.feeling_tags ? feelingBadgeHtml(planLog.feeling, planLog.feeling_tags) : "";
  const planLogNotes = planLog?.notes ? `<div class="log-notes">${planLog.notes}</div>` : "";

  if (isCoach) {
    const logBlock = planLog
      ? `<div class="log-card log-inline">${planLogData.length ? renderInlineLog(planLogData, paceBoundsMap, plannedIntervalCount) : ""}${feelingBadge}${planLogNotes}</div>`
      : "";

    return `
      <article class="session-card is-draggable${notCompleted ? " not-completed" : ""}" data-plan-id="${plan.id}">
        <h3>${displayTitle(plan.title)}</h3>
        ${todBadge}${movedBadge}
        <span class="plan-type-badge">${plan.custom_icon || badgeForTitle(plan.title)}</span>
        ${notCompleted ? '<span class="not-completed-icon-abs">!</span>' : ""}
        ${hasPamatdala ? `<div class="task-card">${formatDetailsForCard(plan.details).replace(/\n/g, "<br>")}<textarea class="inline-comment" data-comment-plan="${plan.id}" data-comment-type="coach" placeholder="Trenera komentārs..."></textarea></div>` : `<textarea class="inline-comment" data-comment-plan="${plan.id}" data-comment-type="coach" placeholder="Trenera komentārs..."></textarea>`}
        ${logBlock}
        ${notCompleted ? `<div class="not-completed-badge"><span class="not-completed-icon">!</span> Sportists atzīmēja kā neizpildītu</div>${plan.athlete_comment ? `<div class="log-notes not-completed-comment">${plan.athlete_comment}</div>` : ""}` : ""}
        <div class="card-actions"><button class="icon-button" data-edit-plan="${plan.id}" type="button">✏️</button><button class="delete-action" data-delete-plan="${plan.id}" type="button">×</button></div>
      </article>
    `;
  }

  const logActions = planLog ? `<div class="log-actions"><button class="edit-log-btn" data-log-plan="${plan.id}" type="button">✏️</button><button class="delete-action log-delete-btn" data-delete-log="${planLog.id}" type="button">×</button></div>` : "";

  const logBlock = planLog
    ? `<div class="log-card log-inline">${planLogData.length ? renderInlineLog(planLogData, paceBoundsMap, plannedIntervalCount) : ""}${feelingBadge}${planLogNotes}</div>`
    : `<button class="add-day-button log-plan-button" data-log-plan="${plan.id}" type="button">Ierakstīt izpildi</button>`;

  return `
    <article class="session-card${notCompleted ? " not-completed" : ""}" data-plan-id="${plan.id}">
      <h3>${displayTitle(plan.title)}</h3>
      ${todBadge}${movedBadge}
      <span class="plan-type-badge">${plan.custom_icon || badgeForTitle(plan.title)}</span>
      ${notCompleted ? '<span class="not-completed-icon-abs">!</span>' : ""}
      ${hasPamatdala ? `<div class="task-card">${formatDetailsForCard(plan.details).replace(/\n/g, "<br>")}${plan.coach_comment ? `<div class="log-notes">${escapeHtml(plan.coach_comment)}</div>` : ""}</div>` : plan.coach_comment ? `<div class="log-notes">${escapeHtml(plan.coach_comment)}</div>` : ""}
      ${!planLog ? `<label class="checkbox-row"><input type="checkbox" data-cb-plan="${plan.id}" ${notCompleted ? "checked" : ""} /> Treniņš nav izpildīts</label>` : ""}
      ${notCompleted ? `<div class="comment-label">Sportista komentārs</div><textarea class="inline-comment not-completed-comment" data-comment-plan="${plan.id}" data-comment-type="athlete">${plan.athlete_comment || ""}</textarea>` : ""}
      ${logBlock}
      ${planLog ? `<div class="card-actions">${logActions}</div>` : ""}
    </article>
  `;
}

function renderLogCard(log) {
  const data = log.log_data || [];
  if (!data.length && !log?.feeling && !log?.feeling_tags && !log?.notes) return "";
  const plan = log.plan_id ? plans.find(p => p.id === log.plan_id) : null;
  const paceBoundsMap = buildPaceBoundsMap(plan?.details);
  const plannedIntervalCount = getPlannedIntervalCount(plan?.details);
  const items = data.length
    ? data.map((entry) => {
      let line = `<div class="log-line">`;
      if (entry.intervals && entry.intervals.length) {
        const done = entry.intervals.filter(Boolean);
        const colored = done.map((v, i) => {
          const spaceIdx = v.indexOf(' ');
          const paceStr = spaceIdx > -1 && spaceIdx < v.length - 1 ? v.substring(spaceIdx + 1).trim() : v;
          const distStr = spaceIdx > -1 && spaceIdx < v.length - 1 ? v.substring(0, spaceIdx) : '';
          const p = parseAthleteInput(paceStr);
          const segBounds = paceBoundsMap?.[`seg${i + 1}`] || paceBoundsMap?.[entry.section];
          const c = p ? getPaceColor(p, segBounds) : "";
          const coloredPace = c ? `<span class="pace-text-${c}">${paceStr}</span>` : paceStr;
          return distStr ? distStr + ' ' + coloredPace : coloredPace;
        });
        let display;
        const hasPlan = !!(paceBoundsMap && Object.keys(paceBoundsMap).length);
        if (hasPlan && plannedIntervalCount > 0 && done.length > plannedIntervalCount) {
          const planned = colored.slice(0, plannedIntervalCount);
          const extras = colored.slice(plannedIntervalCount);
          display = planned.join(", ") + " + " + extras.join(" + ");
        } else {
          display = colored.join(", ");
        }
        line += `${entry.section === "Pamatdaļa" ? `<strong>${entry.section}: ${display}</strong>` : `${entry.section}: ${display}`}`;
      } else {
        const dur = entry.duration || "";
        const rawPulse = entry.pulse ? entry.pulse + (entry.pulse.includes("vid.") ? "" : "vid.") : "";
        const bounds = paceBoundsMap[entry.section];
        let paceHtml = "";
        if (entry.pace) {
          const p = parseAthleteInput(entry.pace);
          const c = p && bounds ? getPaceColor(p, bounds) : "";
          paceHtml = c ? `<span class="pace-text-${c}">${entry.pace}</span>` : entry.pace;
        }
        let pulseHtml = "";
        if (rawPulse) {
          pulseHtml = "; " + entry.pulse + "vid.";
        }
        line += `${entry.section === "Pamatdaļa" ? `<strong>${entry.section}: ${dur}${pulseHtml}${paceHtml ? "; " + paceHtml : ""}</strong>` : `${entry.section}: ${dur}${pulseHtml}${paceHtml ? "; " + paceHtml : ""}`}`;
      }
      line += `</div>`;
      return line;
    }).join("")
    : "";
  const feelingBadge = log?.feeling || log?.feeling_tags ? feelingBadgeHtml(log.feeling, log.feeling_tags) : "";
  const logNotes = log?.notes ? `<div class="log-notes">${log.notes}</div>` : "";
  const athleteIsOwner = (activeRole === "athlete") && currentUser.id === getSelectedAthleteId();
  const logActions = athleteIsOwner ? `<div class="log-actions"><button class="edit-log-btn" data-log-day="${log.date}" type="button">✏️</button><button class="delete-action log-delete-btn" data-delete-log="${log.id}" type="button">×</button></div>` : "";
  return `<div class="session-card log-card">${items}${feelingBadge}${logNotes}${athleteIsOwner ? `<div class="card-actions">${logActions}</div>` : ""}</div>`;
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
      const fullyRestricted = isDayFullyRestricted(dateStr);
      const restrictedTods = getRestrictedTods(dateStr);
      const restrictedClass = fullyRestricted ? " restricted-day" : "";
      const todayClass = dateStr === todayStr ? " today" : "";
      const dayHealth = healthEntries.find(e => dateStr >= e.start_date && dateStr <= (e.end_date || e.start_date));
      const dayRestrictionReason = restrictions.find(r => dateStr >= r.start_date && dateStr <= (r.end_date || r.start_date))?.reason;
      const raceHtml = dayRaces.length
        ? `<div class="race-list">
            <div class="race-section-header">🏁 ${dateStr >= todayStr ? "Gaidāmās sacensības" : "Aizvadītās sacensības"}</div>
            ${dayRaces.map((r) => {
              const isUpcoming = dateStr >= todayStr;
              const hasResult = !!r.result_time;
              const isAthleteOwner = (activeRole === "athlete") && currentUser.id === athleteId;
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
        <section class="day-column${restrictedClass}${todayClass}">
          <div class="day-name">
            <div class="day-name-row">
              <span>${dayName}</span>
            </div>
            <span class="day-date">${date.getDate()}.${date.getMonth() + 1}.</span>
          </div>
          ${raceHtml}
          ${activeRole === "coach" && !fullyRestricted ? `<div class="time-of-day-buttons">${["morning", "afternoon", "evening"].map(tod => restrictedTods.includes(tod) ? "" : `<button class="add-day-button" data-day="${dateStr}" data-tod="${tod}" type="button">${tod === "morning" ? "🌄 Ieplānot no rīta" : tod === "afternoon" ? "☀️ Ieplānot pusdienā" : "🌇 Ieplānot vakarā"}</button>`).join("")}</div>` : ""}
          ${dayPlans.length
            ? dayPlans.map(renderPlanCard).join("")
            : dayRaces.length
              ? activeRole === "coach"
                ? `<textarea class="inline-comment" data-comment-day="${dateStr}">${dayNote?.coach_comment || ""}</textarea>`
                : ""
              : fullyRestricted
                ? `<div class="day-restriction-text">🚫 ${escapeHtml(dayRestrictionReason)}</div>`
                : activeRole === "coach"
                  ? `${dayNote?.is_rest_day
                    ? `<div class="day-rest-text">🌴 Brīvdiena<textarea class="inline-comment" data-comment-day="${dateStr}" placeholder="Trenera komentārs...">${dayNote?.coach_comment || ""}</textarea></div>`
                    : `<button class="add-day-button rest-day-toggle-btn" data-rest-day="${dateStr}" type="button">🌴 Ieplānot brīvdienu</button>`
                  }`
                  : dayNote?.is_rest_day
                    ? `<div class="day-rest-text">🌴 Brīvdiena${dayNote?.coach_comment ? "<br>" + escapeHtml(dayNote.coach_comment) : ""}</div><textarea class="rest-day-athlete-comment" data-rest-athlete-comment="${dateStr}" placeholder="Tavs komentārs..." rows="1">${dayNote?.athlete_comment || ""}</textarea>`
                    : `<div class="empty-day">Pašlaik plāns vēl nav sastādīts</div>`
          }
          ${dayLog.filter(l => !l.plan_id).map(renderLogCard).join("")}
          ${dayHealth ? `<div class="day-health-text">⚕ ${escapeHtml(dayHealth.description)}</div>` : ""}
          ${(fullyRestricted || dayHealth) && activeRole === "coach"
            ? `<div class="comment-label">Trenera komentārs</div><textarea class="inline-comment" data-comment-day="${dateStr}" placeholder="Komentārs...">${dayNote?.coach_comment || ""}</textarea>`
            : ""}
          ${(fullyRestricted || dayHealth) && activeRole !== "coach" && dayNote?.coach_comment
            ? `<div class="day-coach-comment">${escapeHtml(dayNote.coach_comment)}</div>`
            : ""}
        </section>
      `;
    })
    .join("");

  document.querySelectorAll("[data-rest-day]").forEach(btn => {
    const toggleRestDay = async () => {
      const date = btn.dataset.restDay;
      const athleteId = getSelectedAthleteId();
      try {
        await upsertDayNote({ athlete_id: athleteId, date, is_rest_day: true });
        await loadNonTemplateData();
      } catch (e) {
        console.error(e);
      }
    };
    btn.addEventListener("click", toggleRestDay);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleRestDay();
      }
    });
  });

  renderWeeklySummary();
}

function renderWeeklySummary() {
  const ws = document.getElementById("weeklySummary");
  if (!ws) return;
  const athleteId = getSelectedAthleteId();
  const isAthleteView = (activeRole === "athlete") && currentUser.id === athleteId;

  const s = weeklySummary || {};
  const runKm = s.run_km || "";
  const runMin = s.run_min || "";
  const vfsSfs = s.vfs_sfs_min || "";
  const velo = s.velo_min || "";
  const coachComment = s.coach_comment ?? "";
  const athleteComment = s.athlete_comment ?? "";

  ws.innerHTML = `
    <div class="ws-header">Nedēļas kopsavilkums</div>
    <div class="ws-comments">
      <label>Trenera komentārs <textarea id="wsCoachComment" rows="3" ${activeRole === "coach" ? "" : "disabled"}>${coachComment}</textarea></label>
      <label>Sportista komentārs <textarea id="wsAthleteComment" rows="3" ${isAthleteView ? "" : "disabled"}>${athleteComment}</textarea></label>
    </div>
    <div class="ws-fields">
      <label>Kilometrāža <input id="wsRunKm" type="number" step="0.1" value="${runKm}" ${isAthleteView ? "" : "disabled"} /></label>
      <label>Kopējais laiks visos treniņos (h) <input id="wsRunMin" class="ws-time" type="text" value="${runMin}" ${isAthleteView ? "" : "disabled"} placeholder="piem. 10h45m" /></label>
      <label>VFS/SFS (h) <input id="wsVfsSfs" class="ws-time" type="text" value="${vfsSfs}" ${isAthleteView ? "" : "disabled"} placeholder="piem. 1h30m" /></label>
      <label>Velo (h) <input id="wsVelo" class="ws-time" type="text" value="${velo}" ${isAthleteView ? "" : "disabled"} placeholder="piem. 0h45m" /></label>
    </div>
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

  document.querySelectorAll("#weeklySummary input, #weeklySummary textarea").forEach(el => {
    el.addEventListener("change", async () => {
      const weekStart = formatDateISO(currentWeekStart);
      const updates = { athlete_id: athleteId, week_start: weekStart };
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
        if (isAthleteView) {
          weeklyTrend = await getWeeklyTrend(athleteId, trendWeeks);
          renderStats();
        }
      } catch (e) {
        console.error(e);
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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

      const isRestDay = !!dayNote?.is_rest_day;
      const fullyRestricted = isDayFullyRestricted(dateStr);
      const dayHealth = healthEntries.find(e => dateStr >= e.start_date && dateStr <= (e.end_date || e.start_date));
      const dayRestrictionReason = restrictions.find(r => dateStr >= r.start_date && dateStr <= (r.end_date || r.start_date))?.reason;
      const cellWeekStart = getWeekStartFromStr(dateStr);
      const cellBlockType = weekBlockTypes.find(b => b.week_start === cellWeekStart)?.block_type || "";

      const plansHtml = dayPlans.map((p) => {
        const titleHtml = `<strong>${p.completed === false ? '<span class="not-completed-icon">!</span> ' : ""}${displayTitle(p.title)}</strong>`;
        return `
        <div class="month-plan${p.completed === false ? " not-completed" : ""}">
          <span class="month-type-badge">${p.custom_icon || badgeForTitle(p.title)}</span>
          <div class="month-plan-summary">
            ${titleHtml}
            <span>${extractMainPart(p.details)}</span>
          </div>
          <div class="month-plan-full">
            ${titleHtml}
            ${formatDetailsForCard(p.details).replace(/\n/g, "<br>")}
          </div>
        </div>
        ${p.completed === false && p.athlete_comment ? `<div class="month-comment-text" role="button" tabindex="0">💬 ${escapeHtml(p.athlete_comment)}</div>` : ""}
      `;
      }).join("");

      const racesHtml = dayRaces.map((r) => `
        <div class="month-race">
          <span>🏁</span>
          <span class="month-race-name">${r.name}</span>
          ${r.location ? `<span class="month-race-location">${r.location}</span>` : ""}
          ${r.distance ? `<strong class="month-race-dist">${r.distance}</strong>` : ""}
        </div>
      `).join("");

      cells.push(`
        <div class="month-day-cell ${isOtherMonth ? "other-month" : ""}${isToday ? " today" : ""}${fullyRestricted ? " restricted-day" : ""}${cellBlockType ? " week-block-" + cellBlockType : ""}" data-date="${dateStr}">
          <div class="month-day-num">
            ${d.getDate()}.
          </div>
          ${fullyRestricted ? `<div class="month-restriction-text" role="button" tabindex="0">🚫 ${escapeHtml(dayRestrictionReason)}</div>` : ""}
          ${dayHealth ? `<div class="month-health-text" role="button" tabindex="0">⚕ ${escapeHtml(dayHealth.description)}</div>` : ""}
          ${isRestDay && !dayPlans.length && !dayRaces.length ? `<div class="day-rest-text">🌴 Brīvdiena</div>` : ""}
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

  const weekStartStr = formatDateISO(currentWeekStart);
  const blockTypeEntry = weekBlockTypes.find(b => b.week_start === weekStartStr);
  const currentBlockType = blockTypeEntry?.block_type || "";
  document.querySelectorAll('input[name="weekBlockType"]').forEach(r => {
    r.checked = r.value === currentBlockType;
  });
  weekLabel.className = currentBlockType ? "wbt-label-" + currentBlockType : "";

  const activeAthleteEl = document.getElementById("activeAthleteName");
  if (activeRole === "coach") {
    const selected = athletes.find((a) => a.id === athleteSelect.value);
    activeAthleteEl.textContent = selected ? selected.full_name : "";
    activeAthleteEl.style.display = "block";
  } else {
    activeAthleteEl.style.display = "none";
  }

  const hasAthletes = athletes.length > 0;
  athleteSelectorPanel.hidden = activeRole !== "coach" || !hasAthletes;
  document.getElementById("restrictionsPanel").hidden = !hasAthletes;
  document.getElementById("adminPanel").hidden = activeRole !== "coach" || !hasAthletes;
  document.getElementById("openRaceBtn").hidden = activeRole === "coach" || !hasAthletes;
  document.getElementById("raceCalendarPanel").hidden = !hasAthletes;
  document.getElementById("copyPrevWeekBtn").hidden = activeRole !== "coach";
  const isCurrentWeek = formatDateISO(currentWeekStart) === formatDateISO(getMonday(new Date()));
  trainingBar.hidden = activeRole !== "coach" || !hasAthletes;
  document.getElementById("weekBlockTypeSelect").hidden = activeRole !== "coach";

  renderAthleteDropdown();
  renderTemplates();
  renderSourcePicker();
  document.getElementById("updateTemplateBtn").hidden = !selectedTemplateId;
  document.getElementById("deleteTemplateBtn").hidden = !selectedTemplateId;
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
    renderPaceHrMap();
    renderIntervalHistory();
    renderRecords();
    renderRestrictions();
    renderDiary();
    renderSelfTests();
    renderPolarTests();
    renderHealthJournal();
    renderLabTests();
    renderAdminAthleteList();
  } else {
    calendarGrid.innerHTML = '<p class="empty-state">Nav sportistu. Pievienojiet lietotājus.</p>';
    document.getElementById("monthGridInline").innerHTML = '<p class="empty-state">Nav sportistu. Pievienojiet lietotājus.</p>';
    statsBar.innerHTML = "";
    profileCard.innerHTML = "";
    document.getElementById("hrZonesBody").innerHTML = "";
    document.getElementById("thresholdsBody").innerHTML = "";
    document.getElementById("paceHrBody").innerHTML = "";
    document.getElementById("intervalHistoryBody").innerHTML = "";
    document.getElementById("recordsBody").innerHTML = "";
    document.getElementById("diaryBody").innerHTML = "";
    document.getElementById("selfTestsBody").innerHTML = "";
    document.getElementById("polarTestsBody").innerHTML = "";
    document.getElementById("healthJournalBody").innerHTML = "";
    document.getElementById("labTestsBody").innerHTML = "";
  }
  document.getElementById("hrZonesPanel").hidden = !hasAthletes;
  document.getElementById("thresholdsPanel").hidden = !hasAthletes;
  document.getElementById("paceHrPanel").hidden = !hasAthletes;
  document.getElementById("intervalHistoryPanel").hidden = !hasAthletes;
  document.getElementById("recordsPanel").hidden = !hasAthletes;
  document.getElementById("diaryPanel").hidden = !hasAthletes;
  document.getElementById("selfTestsPanel").hidden = !hasAthletes;
  document.getElementById("polarTestsPanel").hidden = !hasAthletes;
  document.getElementById("healthJournalPanel").hidden = !hasAthletes;
  document.getElementById("labTestsPanel").hidden = !hasAthletes;
}

athleteSelect.addEventListener("change", async () => {
  const gen = ++loadGen;
  selectedTemplateId = null;
  await loadAllData();
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

document.getElementById("refreshStatusBtn")?.addEventListener("click", async () => {
  await refreshWeekStatuses();
  renderAthleteDropdown();
});

document.addEventListener("click", () => {
  document.getElementById("athleteDropdown").classList.remove("open");
});

weekPrev.addEventListener("click", async () => {
  const newStart = addDays(currentWeekStart, -7);
  if (newStart < MIN_WEEK_START) return;
  currentWeekStart = newStart;
  await loadNonTemplateData();
});

weekNext.addEventListener("click", async () => {
  currentWeekStart = addDays(currentWeekStart, 7);
  await loadNonTemplateData();
});

weekCurrent.addEventListener("click", async () => {
  currentWeekStart = getMonday(new Date());
  await loadNonTemplateData();
});

document.querySelectorAll('input[name="weekBlockType"]').forEach(radio => {
  radio.addEventListener("change", async () => {
    if (!radio.checked) return;
    const athleteId = getSelectedAthleteId();
    if (!athleteId) return;
    const weekStartStr = formatDateISO(currentWeekStart);
    await upsertWeekBlockType({
      athlete_id: athleteId,
      week_start: weekStartStr,
      block_type: radio.value,
    });
    await loadNonTemplateData();
  });
});

document.getElementById("copyPrevWeekBtn")?.addEventListener("click", async () => {
  const prevWeekStart = addDays(currentWeekStart, -7);
  if (prevWeekStart < MIN_WEEK_START) {
    alert("Nevar nokopēt — pagājušā nedēļa ir pirms sistēmas sākuma datuma.");
    return;
  }

  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;

  const prevWeekEnd = getWeekEnd(prevWeekStart);
  const prevWeekStartStr = formatDateISO(prevWeekStart);
  const prevWeekEndStr = formatDateISO(prevWeekEnd);

  try {
    showLoading();
    const prevWeekPlans = await getPlans(athleteId, prevWeekStartStr, prevWeekEndStr);

    if (!prevWeekPlans.length) {
      alert("Pagājušajā nedēļā nav ieplānotu treniņu.");
      return;
    }

    const confirmed = confirm(
      `Vai tiešām nokopēt ${prevWeekPlans.length} treniņus no iepriekšējās nedēļas?\n\n` +
      `Treniņi tiks pievienoti šīs nedēļas plānam.`
    );

    if (!confirmed) return;

    for (const plan of prevWeekPlans) {
      const newDate = formatDateISO(addDays(new Date(plan.date), 7));
      await insertPlan({
        athlete_id: plan.athlete_id,
        date: newDate,
        title: plan.title,
        details: plan.details,
        coach_comment: "",
        athlete_comment: "",
        created_by: currentUser.id,
        time_of_day: plan.time_of_day,
      });
    }

    await loadNonTemplateData();
  } catch (e) {
    console.error("Kļūda kopējot nedēļu:", e);
    alert("Neizdevās nokopēt nedēļu.");
  } finally {
    hideLoading();
  }
});

document.getElementById("exerciseLibraryBtn")?.addEventListener("click", () => {
  window.open("https://drive.google.com/drive/folders/1OcKdRXjzMxTxAfFYTJLDGfwoCYW8w9R2?usp=drive_link", "_blank");
});

document.getElementById("calendarModeToggle").addEventListener("click", () => {
  calendarMode = calendarMode === "desktop" ? "mobile" : "desktop";
  localStorage.setItem("calendarMode", calendarMode);
  document.getElementById("calendarModeToggle").textContent = calendarMode === "mobile" ? "🖥️ Datora izskats" : "📱 Mobilais izskats";
  renderCalendar();
});

document.getElementById("calendarModeToggle").textContent = calendarMode === "mobile" ? "🖥️ Datora izskats" : "📱 Mobilais izskats";

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
  const newDate = new Date(currentMonthDate);
  newDate.setMonth(newDate.getMonth() - 1);
  const monthStart = getMonthStart(newDate);
  if (monthStart < MIN_WEEK_START) return;
  currentMonthDate = newDate;
  const athleteId = getSelectedAthleteId();
  if (athleteId) {
    const monthStart2 = getMonthStart(currentMonthDate);
    const monthEnd = getMonthEnd(currentMonthDate);
    const ms = formatDateISO(monthStart2);
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

document.getElementById("monthCurrent")?.addEventListener("click", async () => {
  currentMonthDate = new Date();
  const athleteId = getSelectedAthleteId();
  if (athleteId) {
    const ms = formatDateISO(getMonthStart(currentMonthDate));
    const me = formatDateISO(getMonthEnd(currentMonthDate));
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

    if (panel.id === "recordsPanel" && wasCollapsed && !panel.classList.contains("collapsed")) {
      if (activeRole === "coach") {
        const athleteId = getSelectedAthleteId();
        if (athleteId && records.length) {
          markAllRecordsSeen(athleteId, records);
          panel.classList.toggle("has-entries", false);
          btn.dataset.count = "0";
        }
      }
    }

    if (panel.id === "healthJournalPanel" && wasCollapsed && !panel.classList.contains("collapsed")) {
      if (activeRole === "coach") {
        if (healthEntries.length) {
          markAllHealthSeen(healthEntries);
          panel.classList.toggle("has-entries", false);
          btn.dataset.count = "0";
        }
      }
    }

    if (panel.id === "selfTestsPanel" && wasCollapsed && !panel.classList.contains("collapsed")) {
      if (activeRole === "coach") {
        const athleteId = getSelectedAthleteId();
        if (athleteId && selfTests.length) {
          markAllSelfTestsSeen(athleteId, selfTests);
          panel.classList.toggle("has-entries", false);
          btn.dataset.count = "0";
        }
      }
    }

    if (panel.id === "polarTestsPanel" && wasCollapsed && !panel.classList.contains("collapsed")) {
      if (activeRole === "coach") {
        const athleteId = getSelectedAthleteId();
        if (athleteId && polarTests.length) {
          markAllPolarTestsSeen(athleteId, polarTests);
          panel.classList.toggle("has-entries", false);
          btn.dataset.count = "0";
        }
      }
    }

    if (panel.id === "labTestsPanel" && wasCollapsed && !panel.classList.contains("collapsed")) {
      const athleteId = getSelectedAthleteId();
      if (activeRole === "coach") {
        if (athleteId && labTests.length) {
          markAllLabTestsSeen(athleteId, labTests);
          panel.classList.toggle("has-entries", false);
          btn.dataset.count = "0";
        }
      } else {
        if (athleteId && labTests.length) {
          markAllIzvertetsSeen(athleteId, labTests);
          panel.classList.toggle("has-entries", false);
          btn.dataset.count = "0";
        }
      }
    }

    if (panel.id === "raceCalendarPanel" && wasCollapsed && !panel.classList.contains("collapsed")) {
      onRaceCalendarExpand();
    }
  });
});

// --- Panel header click (whole area toggles, not just arrow) ---
document.querySelectorAll(".panel .panel-header, .stats-collapsible .panel-header").forEach((header) => {
  header.addEventListener("click", (e) => {
    if (e.target.closest(".collapse-toggle")) return;
    const btn = header.querySelector(".collapse-toggle");
    if (btn) btn.click();
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

function togglePanel(collapsed) {
  panelCollapsed = collapsed;
  localStorage.setItem("panelCollapsed", String(collapsed));
  document.querySelector(".layout")?.classList.toggle("panel-collapsed", collapsed);
}

document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
  if (window.innerWidth > 1040) {
    togglePanel(!panelCollapsed);
  } else {
    const panel = document.querySelector(".planner-panel");
    togglePlannerMenu(!panel?.classList.contains("open"));
  }
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

// Eye toggle for passwords
function setupPwToggle(toggleBtnId, inputId) {
  const btn = document.getElementById(toggleBtnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    const isPw = input.type === "password";
    input.type = isPw ? "text" : "password";
    btn.textContent = isPw ? "👁️‍🗨️" : "👁️";
  });
}

setupPwToggle("toggleLoginPw", "loginPassword");
setupPwToggle("toggleResetPw", "resetPwInput");
setupPwToggle("toggleNewPw", "newPassword");
setupPwToggle("toggleConfirmPw", "confirmPassword");

// Training bar collapsible
if (trainingBar) {
  const toggleBtn = trainingBar.querySelector(".collapse-toggle");
  const header = trainingBar.querySelector(".training-bar-header");
  
  const toggleTrainingBar = () => {
    trainingBar.classList.toggle("collapsed");
    const isCollapsed = trainingBar.classList.contains("collapsed");
    toggleBtn.textContent = isCollapsed ? "▶" : "▼";
    toggleBtn.setAttribute("aria-label", isCollapsed ? "Rādīt treniņa izvēli" : "Sakļaut treniņa izvēli");
  };
  
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTrainingBar();
  });
  
  header.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") return;
    toggleTrainingBar();
  });
}

// Template custom dropdown handlers
document.querySelectorAll(".template-dropdown").forEach(dropdown => {
  const trigger = dropdown.querySelector(".dropdown-trigger");
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".template-dropdown.open").forEach(d => {
      if (d !== dropdown) d.classList.remove("open");
    });
    dropdown.classList.toggle("open");
  });
});

document.querySelectorAll(".template-dropdown-list").forEach(list => {
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".template-dropdown-item");
    if (!item) return;

    const templateId = item.dataset.templateId;
    const dropdown = list.closest(".template-dropdown");
    const otherDropdown = dropdown.id === "allTemplatesDropdown"
      ? document.getElementById("athleteTemplatesDropdown")
      : document.getElementById("allTemplatesDropdown");

    selectedTemplateId = templateId;
    dropdown.classList.remove("open");

    otherDropdown.classList.remove("open");
    otherDropdown.querySelector(".dropdown-selected").textContent = "Izvēlies sagatavi...";
    otherDropdown.querySelectorAll(".template-dropdown-item").forEach(i => i.classList.remove("selected"));

    dropdown.querySelector(".dropdown-selected").textContent = item.querySelector(".template-dropdown-item-name").textContent;
    dropdown.querySelectorAll(".template-dropdown-item").forEach(i => i.classList.remove("selected"));
    item.classList.add("selected");

    const t = templates.find(t => t.id === templateId);
    if (t) loadTemplateToForm(t);
    render();
  });
});

document.addEventListener("click", () => {
  document.querySelectorAll(".template-dropdown.open").forEach(d => d.classList.remove("open"));
});

// Edit/Delete template buttons (delegated)
document.addEventListener("click", async (event) => {
  const deleteBtn = event.target.closest("[data-delete-template]");
  if (deleteBtn) {
    event.stopPropagation();
    const id = selectedTemplateId;
    if (!id) return;
    if (confirm("Dzēst šo sagatavi?")) {
      try {
        await deleteTemplate(id);
        templates = templates.filter((t) => t.id !== id);
        if (selectedTemplateId === id) selectedTemplateId = null;
        render();
      } catch (e) {
        alert("Neizdevās dzēst sagatavi: " + (e.message || e));
      }
    }
    return;
  }

  const updateBtn = event.target.closest("#updateTemplateBtn");
  if (updateBtn && selectedTemplateId) {
    const training = getGeneratedTraining();
    const name = document.getElementById("customName").value.trim() || training.title;
    const details = training.details;
    if (!name) return;
    try {
      const updated = await updateTemplate(selectedTemplateId, { name, details });
      const idx = templates.findIndex((t) => t.id === selectedTemplateId);
      if (idx !== -1) templates[idx] = updated;
      selectedTemplateId = updated.id;
      render();
    } catch (e) {
      console.error(e);
    }
    return;
  }
});

varSegmentList.addEventListener("input", () => {
  renderCustomPreview();
  syncVarLapsState(varSegmentList, varLaps);
});
document.getElementById("varAddSegment")?.addEventListener("click", () => {
  addVarSegmentRow(varSegmentList);
  renderCustomPreview();
});
document.getElementById("epVarAddSegment")?.addEventListener("click", () => {
  addVarSegmentRow(document.getElementById("epVarSegmentList"));
  renderEditPlanPreview();
});

[customType, warmupDuration, warmupPulse, includeWarmup, includeCooldown, includeDrills, mainAdditional, mainDrills, repeatCount, intervalLength, intervalPace, restDuration, mainDuration, mainPulse, cooldownDuration, cooldownPulse, tempoPace, document.getElementById("includeKoptreniņš"), varLaps, varRestBetweenLaps, document.getElementById("customName"), document.getElementById("customFreeText"), raceNutrition, spikes, raceShoes].forEach((input) => {
  input?.addEventListener("input", renderSourcePicker);
  input?.addEventListener("change", renderSourcePicker);
});
customType.addEventListener("change", () => {
  const t = customType.value;
  includeDrills.checked = t === SAME_INTERVAL_TYPE || t === "Intervāli" || t === VAR_INTERVAL_TYPE || t === "Tempa skrējiens" || t === OTHER_RUN_TYPE;
});

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
    const tod = dayButton.dataset.tod || "";
    if (isTimeSlotRestricted(day, tod || null)) return;
    const training = getGeneratedTraining();
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
    if (!confirm("Dzēst šo treniņu?")) return;
    try {
      await deletePlan(deletePlanBtn.dataset.deletePlan);
      await loadNonTemplateData();
    } catch (e) {
      alert("Neizdevās dzēst: " + (e.message || e));
    }
  }

  const editPlanBtn = event.target.closest("[data-edit-plan]");
  if (editPlanBtn) {
    const planId = editPlanBtn.dataset.editPlan;
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      editPlanDialog.dataset.editId = planId;
      parsePlanToForm(plan);
      editPlanDialog.showModal();
    }
  }

  const deleteLogBtn = event.target.closest("[data-delete-log]");
  if (deleteLogBtn) {
    if (!confirm("Dzēst šo izpildījuma ierakstu?")) return;
    try {
      await deleteLogEntry(deleteLogBtn.dataset.deleteLog);
      await loadNonTemplateData();
    } catch (e) {
      alert("Neizdevās dzēst: " + (e.message || e));
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
      alert("Neizdevās dzēst sacensības: " + (e.message || e));
    }
  }

});

// --- Month view expandable restriction/health text, and tap-a-training-to-reveal-full-plan ---
document.addEventListener("click", (e) => {
  const el = e.target.closest(".month-restriction-text, .month-health-text, .month-comment-text, .month-plan");
  if (el) el.classList.toggle("expanded");
});

// --- Drag & Drop (Pointer Events) ---
let dragState = null;

function getDropDay(target) {
  const col = target.closest(".day-column");
  if (!col) return null;
  const btn = col.querySelector("[data-day]");
  return btn ? btn.dataset.day : null;
}

document.addEventListener("pointerdown", (e) => {
  const card = e.target.closest(".session-card.is-draggable");
  if (!card || e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT" || e.target.closest("button")) return;
  e.preventDefault();
  const planId = card.dataset.planId;
  if (!planId) return;
  const rect = card.getBoundingClientRect();
  const clone = card.cloneNode(true);
  clone.className = "drag-clone";
  clone.style.width = rect.width + "px";
  clone.style.left = (e.clientX - rect.width / 2) + "px";
  clone.style.top = (e.clientY - 12) + "px";
  document.body.appendChild(clone);
  dragState = { planId, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, clone };
  document.body.classList.add("is-dragging");
});

document.addEventListener("pointermove", (e) => {
  if (!dragState) return;
  e.preventDefault();
  dragState.clone.style.left = (e.clientX - dragState.offsetX) + "px";
  dragState.clone.style.top = (e.clientY - dragState.offsetY) + "px";
  const target = document.elementFromPoint(e.clientX, e.clientY);
  document.querySelectorAll(".day-column.drag-target").forEach(el => el.classList.remove("drag-target"));
  if (target) {
    const col = target.closest(".day-column");
    if (col) col.classList.add("drag-target");
  }
});

document.addEventListener("pointerup", async (e) => {
  if (!dragState) return;
  const target = document.elementFromPoint(e.clientX, e.clientY);
  const day = target ? getDropDay(target) : null;
  dragState.clone.remove();
  document.querySelectorAll(".day-column.drag-target").forEach(el => el.classList.remove("drag-target"));
  document.body.classList.remove("is-dragging");
  const { planId } = dragState;
  dragState = null;
  if (!day) return;
  const plan = plans.find(p => p.id === planId);
  if (!plan || plan.date === day) return;
  try {
    await updatePlan(planId, { date: day });
    await loadNonTemplateData();
  } catch (err) {
    alert("Neizdevās pārvietot treniņu: " + (err.message || err));
  }
});

calendarGrid.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  const textarea = event.target.closest("textarea");
  if (!textarea) return;
  if (textarea.dataset.saving) return;
  textarea.dataset.saving = "1";

  const raceCommentId = textarea.dataset.commentRace;
  if (raceCommentId) {
    event.preventDefault();
    const value = textarea.value.trim();
    try {
      await updateRace(raceCommentId, { result_comment: value });
      const race = races.find(r => r.id === raceCommentId);
      if (race) race.result_comment = value;
      render();
    } catch (e) {
      alert("Neizdevās saglabāt komentāru: " + (e.message || e));
    }
    delete textarea.dataset.saving;
    return;
  }

  const planId = textarea.dataset.commentPlan;
  if (planId) {
    event.preventDefault();
    const type = textarea.dataset.commentType;
    const value = textarea.value.trim();
    try {
      await updatePlan(planId, { [`${type}_comment`]: value });
      const plan = plans.find(p => p.id === planId);
      if (plan) plan[`${type}_comment`] = value;
      render();
    } catch (e) {
      alert("Neizdevās saglabāt komentāru: " + (e.message || e));
    }
    delete textarea.dataset.saving;
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
      let note = dayNotes.find(n => n.date === dayDate);
      if (note) note.coach_comment = value;
      else dayNotes.push({ date: dayDate, coach_comment: value, athlete_comment: "" });
      render();
    } catch (e) {
      alert("Neizdevās saglabāt komentāru: " + (e.message || e));
    }
    delete textarea.dataset.saving;
    return;
  }

  const restDate = textarea.dataset.restAthleteComment;
  if (restDate) {
    event.preventDefault();
    const value = textarea.value.trim();
    try {
      await upsertDayNote({
        athlete_id: getSelectedAthleteId(),
        date: restDate,
        athlete_comment: value,
      });
      let note = dayNotes.find(n => n.date === restDate);
      if (note) note.athlete_comment = value;
      else dayNotes.push({ date: restDate, athlete_comment: value, coach_comment: "" });
      render();
    } catch (e) {
      alert("Neizdevās saglabāt komentāru: " + (e.message || e));
    }
    delete textarea.dataset.saving;
    return;
  }

  delete textarea.dataset.saving;
});

calendarGrid.addEventListener("change", async (event) => {
  const cb = event.target.closest("[data-cb-plan]");
  if (!cb) return;
  const planId = cb.dataset.cbPlan;
  const completed = !cb.checked;
  const updates = { completed };
  if (!completed) updates.coach_acknowledged = false;
  try {
    await updatePlan(planId, updates);
    const plan = plans.find(p => p.id === planId);
    if (plan) plan.completed = completed;
    await refreshAthleteNotCompletedSet();
    render();
  } catch (e) {
    alert("Neizdevās atjaunot plāna statusu: " + (e.message || e));
  }
});

async function saveNewTemplate(forAthlete) {
  const training = getGeneratedTraining();
  try {
    const saved = await insertTemplate({
      name: training.title,
      details: training.details,
      created_by: currentUser.id,
      athlete_id: forAthlete ? getSelectedAthleteId() : null,
    });
    templates.push(saved);
    selectedTemplateId = saved.id;
    render();
  } catch (e) {
    console.error(e);
  }
}

document.getElementById("saveTemplateOnlyBtn")?.addEventListener("click", () => saveNewTemplate(false));
document.getElementById("saveTemplateForAthleteBtn")?.addEventListener("click", () => saveNewTemplate(true));

document.getElementById("saveEditPlanBtn")?.addEventListener("click", async () => {
  const id = editPlanDialog.dataset.editId;
  if (!id) return;
  const training = getEditPlanTraining();
  if (!training.title) return;
  try {
    const updates = { title: training.title, details: training.details };
    if (training.custom_icon) updates.custom_icon = training.custom_icon;
    const updated = await updatePlan(id, updates);
    const idx = plans.findIndex(p => p.id === id);
    if (idx !== -1) plans[idx] = updated;
    editPlanDialog.close();
    await loadNonTemplateData();
  } catch (e) {
    console.error(e);
  }
});

[document.getElementById("epType"), document.getElementById("epIncludeWarmup"), document.getElementById("epIncludeCooldown"), document.getElementById("epIncludeKoptreniņš")].forEach((el) => {
  el?.addEventListener("change", () => {
    renderEditPlanBuilder();
    if (el === document.getElementById("epType")) {
      const t = document.getElementById("epType").value;
      document.getElementById("epIncludeDrills").checked = t === SAME_INTERVAL_TYPE || t === "Intervāli" || t === VAR_INTERVAL_TYPE || t === "Tempa skrējiens" || t === OTHER_RUN_TYPE;
    }
  });
});

["epType", "epWarmupDuration", "epWarmupPulse", "epIncludeWarmup", "epIncludeCooldown", "epIncludeDrills", "epMainAdditional", "epMainDrills", "epRepeatCount", "epIntervalLength", "epIntervalPace", "epRestDuration", "epMainDuration", "epMainPulse", "epCooldownDuration", "epCooldownPulse", "epTempoPace", "epFreeText", "epIncludeKoptreniņš", "epVarLaps", "epVarRestBetweenLaps", "epCustomName", "epRaceNutrition", "epSpikes", "epRaceShoes"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => renderEditPlanPreview());
});
document.getElementById("epVarSegmentList")?.addEventListener("input", () => {
  renderEditPlanPreview();
  syncVarLapsState(document.getElementById("epVarSegmentList"), document.getElementById("epVarLaps"));
});
document.getElementById("epIncludeWarmup")?.addEventListener("change", () => renderEditPlanPreview());
document.getElementById("epIncludeCooldown")?.addEventListener("change", () => renderEditPlanPreview());

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
      custom_icon: training.custom_icon || null,
    });
    const restNote = dayNotes.find(n => n.date === dateStr && n.is_rest_day);
    if (restNote) {
      await upsertDayNote({ athlete_id: getSelectedAthleteId(), date: dateStr, is_rest_day: false });
    }
    await loadNonTemplateData();
  } catch (e) {
    console.error(e);
  }
}

function feelingBadgeHtml(feeling, feelingTags) {
  const colors = {
    "Tempu nespēju noturēt, nebija iekšās šoreiz": { bg: "var(--danger-bg)", color: "var(--danger)" },
    "Brīžiem temps kritās, ar piepūli noturēju": { bg: "var(--warning-bg)", color: "var(--warning-dark)" },
    "Izpildīju, bet ne pārliecinoši": { bg: "var(--info-bg)", color: "var(--info)" },
    "Spēks un solis jaudīgs, psiholoģiski pārliecinoši!": { bg: "var(--success-bg)", color: "var(--success)" },
    "Kājas pasmagas, motivācija zema, jau pusē bija viss :[": { bg: "var(--danger-bg)", color: "var(--danger)" },
    "Normāli, nevaru sūdzēties.": { bg: "var(--info-bg)", color: "var(--info-dark)" },
    "Diezgan labi - kā gaidīts.": { bg: "var(--info-bg)", color: "var(--info)" },
    "Viena no veiksmīgākajām dienām pedējā laikā": { bg: "var(--success-bg)", color: "var(--success)" },
    "Jutos pārliecināts un kājas jutās svaigas": { bg: "var(--success-bg)", color: "var(--success-dark)" },
    "Jutu progresu un spēka pieaugumu, esmu priecīgs.": { bg: "var(--success-bg)", color: "var(--success-dark)" },
    "Slikti — kājas nemaz neklausīja, cīnījos visu treniņu.": { bg: "var(--danger-bg)", color: "var(--danger)" },
    "Grūti — pabeidzu, bet ar piepūli un zemu motivāciju.": { bg: "var(--warning-bg)", color: "var(--warning-dark)" },
    "Vidēji — nekas īpašs, parasta diena.": { bg: "var(--surface-alt)", color: "var(--muted)" },
    "Labi — jutos stabili, viss gāja kā ierasts.": { bg: "var(--info-bg)", color: "var(--info)" },
    "Ļoti labi — jutos spēcīgs un viegli.": { bg: "var(--olive-bg)", color: "var(--olive-dark)" },
    "Lieliski — viena no labākajām dienām, pilns enerģijas.": { bg: "var(--success-bg)", color: "var(--success-dark)" },
  };
  const all = [];
  if (feeling) all.push(feeling);
  if (feelingTags) {
    const tags = typeof feelingTags === "string" ? feelingTags.split(",") : feelingTags;
    tags.forEach((t) => { if (t && !all.includes(t.trim())) all.push(t.trim()); });
  }
  if (!all.length) return "";
  return all.map((v) => {
    const c = colors[v] || { bg: "var(--surface-alt)", color: "var(--muted)" };
    return `<div class="feeling-tag-badge" style="background:${c.bg};color:${c.color};border-color:${c.color}">${v}</div>`;
  }).join("");
}

function getActivityType(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("vfs") || t.includes("sfs")) return "gym";
  if (t === "velo") return "bike";
  return "run";
}

function getRatingGroup(planTitle, customIcon) {
  if (customIcon === "🐢") return "easy";
  if (customIcon === "🛳️") return "easy";
  if (customIcon === "🚴") return "bike";
  if (customIcon === "💪") return "gym";
  if (customIcon === "⚡") return "intervals";
  if (customIcon === "📈") return "tempo";
  if (customIcon === "⌛") return "long";
  const t = (planTitle || "").toLowerCase();
  if (t.includes("vfs") || t.includes("sfs")) return "gym";
  if (t === "velo" || t.includes("velo")) return "bike";
  if (t.includes("intervāl")) return "intervals";
  if (t.includes("temp")) return "tempo";
  if (t.includes("garais")) return "long";
  if (t.includes("vidējas intensitātes")) return "easy";
  if (t.includes("atjaunojoš") || t.includes("lēn")) return "easy";
  return "other";
}

function getRatingHtml(planTitle, customIcon) {
  const group = getRatingGroup(planTitle, customIcon);
  const typeOpts = {
    intervals: [
      { label: "Tempu nespēju noturēt, nebija iekšās šoreiz", bg: "var(--danger-bg)", border: "var(--danger)", color: "var(--danger)" },
      { label: "Brīžiem temps kritās, ar piepūli noturēju", bg: "var(--warning-bg)", border: "var(--warning)", color: "var(--warning)" },
      { label: "Izpildīju, bet ne pārliecinoši", bg: "var(--info-bg)", border: "var(--info)", color: "var(--info)" },
      { label: "Spēks un solis jaudīgs, psiholoģiski pārliecinoši!", bg: "var(--success-bg)", border: "var(--success)", color: "var(--success)" },
    ],
    tempo: [
      { label: "Tempu nespēju noturēt, nebija iekšās šoreiz", bg: "var(--danger-bg)", border: "var(--danger)", color: "var(--danger)" },
      { label: "Brīžiem temps kritās, ar piepūli noturēju", bg: "var(--warning-bg)", border: "var(--warning)", color: "var(--warning)" },
      { label: "Izpildīju, bet ne pārliecinoši", bg: "var(--info-bg)", border: "var(--info)", color: "var(--info)" },
      { label: "Spēks un solis jaudīgs, psiholoģiski pārliecinoši!", bg: "var(--success-bg)", border: "var(--success)", color: "var(--success)" },
    ],
    long: [
      { label: "Slikti — kājas nemaz neklausīja, cīnījos visu treniņu.", bg: "var(--danger-bg)", border: "var(--danger)", color: "var(--danger)" },
      { label: "Grūti — pabeidzu, bet ar piepūli un zemu motivāciju.", bg: "var(--warning-bg)", border: "var(--warning)", color: "var(--warning-dark)" },
      { label: "Vidēji — nekas īpašs, parasta diena.", bg: "var(--surface-alt)", border: "var(--muted)", color: "var(--muted)" },
      { label: "Labi — jutos stabili, viss gāja kā ierasts.", bg: "var(--info-bg)", border: "var(--info)", color: "var(--info)" },
      { label: "Ļoti labi — jutos spēcīgs un viegli.", bg: "var(--olive-bg)", border: "var(--olive)", color: "var(--olive-dark)" },
      { label: "Lieliski — viena no labākajām dienām, pilns enerģijas.", bg: "var(--success-bg)", border: "var(--success-dark)", color: "var(--success-dark)" },
    ],
    easy: [
      { label: "Slikti — kājas nemaz neklausīja, cīnījos visu treniņu.", bg: "var(--danger-bg)", border: "var(--danger)", color: "var(--danger)" },
      { label: "Grūti — pabeidzu, bet ar piepūli un zemu motivāciju.", bg: "var(--warning-bg)", border: "var(--warning)", color: "var(--warning-dark)" },
      { label: "Vidēji — nekas īpašs, parasta diena.", bg: "var(--surface-alt)", border: "var(--muted)", color: "var(--muted)" },
      { label: "Labi — jutos stabili, viss gāja kā ierasts.", bg: "var(--info-bg)", border: "var(--info)", color: "var(--info)" },
      { label: "Ļoti labi — jutos spēcīgs un viegli.", bg: "var(--olive-bg)", border: "var(--olive)", color: "var(--olive-dark)" },
      { label: "Lieliski — viena no labākajām dienām, pilns enerģijas.", bg: "var(--success-bg)", border: "var(--success-dark)", color: "var(--success-dark)" },
    ],
    gym: [
      { label: "Slikti — kājas nemaz neklausīja, cīnījos visu treniņu.", bg: "var(--danger-bg)", border: "var(--danger)", color: "var(--danger)" },
      { label: "Grūti — pabeidzu, bet ar piepūli un zemu motivāciju.", bg: "var(--warning-bg)", border: "var(--warning)", color: "var(--warning-dark)" },
      { label: "Vidēji — nekas īpašs, parasta diena.", bg: "var(--surface-alt)", border: "var(--muted)", color: "var(--muted)" },
      { label: "Labi — jutos stabili, viss gāja kā ierasts.", bg: "var(--info-bg)", border: "var(--info)", color: "var(--info)" },
      { label: "Ļoti labi — jutos spēcīgs un viegli.", bg: "var(--olive-bg)", border: "var(--olive)", color: "var(--olive-dark)" },
      { label: "Lieliski — viena no labākajām dienām, pilns enerģijas.", bg: "var(--success-bg)", border: "var(--success-dark)", color: "var(--success-dark)" },
    ],
    bike: [
      { label: "Slikti — kājas nemaz neklausīja, cīnījos visu treniņu.", bg: "var(--danger-bg)", border: "var(--danger)", color: "var(--danger)" },
      { label: "Grūti — pabeidzu, bet ar piepūli un zemu motivāciju.", bg: "var(--warning-bg)", border: "var(--warning)", color: "var(--warning-dark)" },
      { label: "Vidēji — nekas īpašs, parasta diena.", bg: "var(--surface-alt)", border: "var(--muted)", color: "var(--muted)" },
      { label: "Labi — jutos stabili, viss gāja kā ierasts.", bg: "var(--info-bg)", border: "var(--info)", color: "var(--info)" },
      { label: "Ļoti labi — jutos spēcīgs un viegli.", bg: "var(--olive-bg)", border: "var(--olive)", color: "var(--olive-dark)" },
      { label: "Lieliski — viena no labākajām dienām, pilns enerģijas.", bg: "var(--success-bg)", border: "var(--success-dark)", color: "var(--success-dark)" },
    ],
    other: [
      { label: "Slikti — kājas nemaz neklausīja, cīnījos visu treniņu.", bg: "var(--danger-bg)", border: "var(--danger)", color: "var(--danger)" },
      { label: "Grūti — pabeidzu, bet ar piepūli un zemu motivāciju.", bg: "var(--warning-bg)", border: "var(--warning)", color: "var(--warning-dark)" },
      { label: "Vidēji — nekas īpašs, parasta diena.", bg: "var(--surface-alt)", border: "var(--muted)", color: "var(--muted)" },
      { label: "Labi — jutos stabili, viss gāja kā ierasts.", bg: "var(--info-bg)", border: "var(--info)", color: "var(--info)" },
      { label: "Ļoti labi — jutos spēcīgs un viegli.", bg: "var(--olive-bg)", border: "var(--olive)", color: "var(--olive-dark)" },
      { label: "Lieliski — viena no labākajām dienām, pilns enerģijas.", bg: "var(--success-bg)", border: "var(--success-dark)", color: "var(--success-dark)" },
    ],
  };
  const items = typeOpts[group] || typeOpts.other;
  let html = `<div class="feeling-tags-group">
    <div class="feeling-tags-label">Pašsajūtas novērtējums</div>`;
  items.forEach((o) => {
    html += `<label class="feeling-option" style="--fbg:${o.bg};--fborder:${o.border};--fcolor:${o.color}">
      <input type="radio" name="trainingRating" value="${escapeHtml(o.label)}" />
      <span>${escapeHtml(o.label)}</span>
    </label>`;
  });
  html += `</div>`;
  return html;
}

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
  const feeling = feelingEl ? feelingEl.value : null;
  const feelingTags = null;
  const notes = document.getElementById("logAthleteComment")?.value.trim() || "";

  const durationMin = 0;
  const runningKm = 0;
  const planTitleEl = document.querySelector(".log-plan-block h3");
  const planTitle = planTitleEl ? planTitleEl.textContent : "";
  const activityType = getActivityType(planTitle);

  try {
    const entries = [];
    document.querySelectorAll("[data-log-section]").forEach((el) => {
      const section = el.dataset.logSection;
      const duration = el.querySelector(".log-actual-duration")?.value || "";
      const pulse = el.querySelector(".log-actual-pulse")?.value || "";
      const pace = el.querySelector(".log-actual-pace")?.value || "";
      const intervals = [];
      el.querySelectorAll("[data-log-interval]").forEach((inp) => {
        const extraRow = inp.closest('.extra-interval-row');
        if (extraRow) {
          const distInput = extraRow.querySelector('.log-extra-dist');
          intervals.push(distInput.value + ' ' + inp.value);
        } else {
          intervals.push(inp.value);
        }
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
        activity_type: activityType,
        log_data: entries,
        feeling,
        feeling_tags: feelingTags,
        notes,
        duration_min: durationMin,
        distance_km: runningKm,
      });
      const p = plans.find(p => p.id === logDialogPlanId);
      if (p && logDialogDate !== p.date) {
        if (!p.original_date) {
          await updatePlan(logDialogPlanId, { original_date: p.date, date: logDialogDate });
        } else {
          await updatePlan(logDialogPlanId, { date: logDialogDate });
        }
      }
    } else {
      const existing = logEntries.filter((l) => l.date === logDialogDate);
      for (const e of existing) {
        await deleteLogEntry(e.id);
      }
      await insertLogEntry({
        athlete_id: athleteId,
        date: logDialogDate,
        activity_type: activityType,
        log_data: entries,
        feeling,
        feeling_tags: feelingTags,
        notes,
        duration_min: durationMin,
        distance_km: runningKm,
      });
    }
    logDialog.close();
    await loadNonTemplateData();
  } catch (e) {
    console.error(e);
  }
});
function addExtraIntervalRow(container, defaultDist, defaultPace) {
  const sectionRow = container.closest('.log-section-row') || container;
  const currentCount = sectionRow.querySelectorAll('[data-log-interval]').length;
  const row = document.createElement('div');
  row.className = 'extra-interval-row';
  const distInput = document.createElement('input');
  distInput.className = 'log-extra-dist';
  distInput.placeholder = defaultDist || '400m';
  const paceInput = document.createElement('input');
  paceInput.className = 'log-interval-pace';
  paceInput.dataset.logInterval = currentCount;
  paceInput.placeholder = defaultPace || 'min/km';
  row.appendChild(distInput);
  row.appendChild(paceInput);
  const fg = sectionRow.querySelector('.field-grid');
  if (fg) {
    fg.appendChild(row);
  } else {
    const lastSeg = sectionRow.querySelector('.var-seg-log-row:last-child');
    if (lastSeg) lastSeg.after(row);
    else sectionRow.appendChild(row);
  }
  const targetLine = sectionRow.querySelector('.log-target')?.textContent || '';
  const paceStr = extractPace(targetLine);
  const bounds = paceStr ? parsePaceBounds(paceStr) : null;
  if (bounds) {
    function validate() {
      const v = parseAthleteInput(paceInput.value);
      paceInput.classList.remove('pace-fast', 'pace-good', 'pace-slow', 'pace-warn');
      if (!v) return;
      const c = getPaceColor(v, bounds);
      if (c) paceInput.classList.add('pace-' + c);
    }
    paceInput.addEventListener('input', validate);
    validate();
  }
}
function logDialogAddExtraButtons() {
  logFormContent.querySelectorAll('.log-section-row').forEach(row => {
    const hasInterval = row.querySelector('[data-log-interval]');
    if (!hasInterval) return;
    const targetText = row.querySelector('.log-target')?.textContent || '';
    const distMatch = targetText.match(/Pamatdaļa:\s*(\d+)x(\S+)/);
    const defaultDist = distMatch ? distMatch[2] : '400m';
    const defaultPace = extractPace(targetText) || 'min/km';
    const btn = document.createElement('button');
    btn.className = 'extra-interval-btn';
    btn.textContent = '+ Pievienot papildus intervālu';
    btn.type = 'button';
    btn.addEventListener('click', () => addExtraIntervalRow(row, defaultDist, defaultPace));
    const fg = row.querySelector('.field-grid');
    if (fg) {
      fg.after(btn);
    } else {
      row.appendChild(btn);
    }
  });
}
function logDialogFillIntervals(sectionEl, intervals) {
  const existing = sectionEl.querySelectorAll('[data-log-interval]');
  const needed = intervals.length - existing.length;
  if (needed > 0) {
    const targetText = sectionEl.querySelector('.log-target')?.textContent || '';
    const distMatch = targetText.match(/Pamatdaļa:\s*(\d+)x(\S+)/);
    const defaultDist = distMatch ? distMatch[2] : '400m';
    const defaultPace = extractPace(targetText) || 'min/km';
    for (let e = 0; e < needed; e++) addExtraIntervalRow(sectionEl, defaultDist, defaultPace);
  }
  sectionEl.querySelectorAll('[data-log-interval]').forEach((inp, i) => {
    if (intervals[i]) {
      const extraRow = inp.closest('.extra-interval-row');
      if (extraRow) {
        const val = intervals[i];
        const spaceIdx = val.indexOf(' ');
        if (spaceIdx > -1 && spaceIdx < val.length - 1) {
          extraRow.querySelector('.log-extra-dist').value = val.substring(0, spaceIdx);
          inp.value = val.substring(spaceIdx + 1).trim();
        } else {
          inp.value = val;
        }
      } else {
        inp.value = intervals[i];
      }
    }
  });
}
function openPlanLogDialog(planId) {
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return;
  logDialogDate = plan.date;
  logDialogPlanId = plan.id;
  const existingLog = logEntries.find((l) => l.plan_id === plan.id);
  let html = "";
  if (activeRole !== "coach") {
    html += `<label class="field-label">Izpildes datums <input type="date" id="logDatePicker" value="${plan.date}" /></label>`;
  }
  html += `<div class="log-plan-block"><h3>${displayTitle(plan.title)}</h3>`;
  const lines = (plan.details || "").split("\n");
  lines.forEach((line) => {
    if (!line.trim()) return;
    if (isVarIntervalLine(line)) {
      const result = parseSegmentsFromVarLine(line);
      html += `<div class="log-section-row" data-log-section="Pamatdaļa">
        <div class="log-target">${line}</div>`;
      let globalIdx = 0;
      result.segments.forEach((seg) => {
        const label = seg.length + (seg.pace ? " @" + seg.pace : "");
        const count = result.isGrouped ? seg.reps : 1;
        for (let r = 0; r < count; r++) {
          html += `<div class="var-seg-log-row">
            <span class="var-seg-log-label">${escapeHtml(label)}${count > 1 ? " (" + (r + 1) + "." + ")" : ""}</span>
            <label>Izp. temps <input class="log-interval-pace var-seg-pace-input" data-log-interval="${globalIdx}" placeholder="${seg.pace || ""}" /></label>
          </div>`;
          globalIdx++;
        }
      });
      html += `</div>`;
    } else {
      let intervalMatch = line.match(/Pamatdaļa:\s*(\d+)x(\S+)/);
      if (intervalMatch) {
        const count = parseInt(intervalMatch[1]);
        html += `<div class="log-section-row" data-log-section="Pamatdaļa">
          <div class="log-target">${line}</div>
          <div class="field-grid">`;
        for (let i = 0; i < count; i++) {
          html += `<label>${i + 1}. atkārtojums <input class="log-interval-pace" data-log-interval="${i}" placeholder="${extractPace(line)}" /></label>`;
        }
        html += `</div></div>`;
      } else if (line === "Sacensību uzturs" || line === "• Izmantot sacensību uzturu" || line.startsWith("Apavi:") || line.startsWith("• Apavi:")) {
        html += `<div class="log-section-row" data-log-section="${line}">
          <div class="log-target">${line}</div>
        </div>`;
      } else if (line.includes(":")) {
        const paceStr = extractPace(line);
      const paceField = `<label>Izp. vidējais temps <input class="log-actual-pace" placeholder="${paceStr || ""}" /></label>`;
      const pulseStr = extractPulse(line);
      html += `<div class="log-section-row" data-log-section="${line.split(":")[0]}">
        <div class="log-target">${line}</div>
        <div class="field-grid field-grid-3">
          <label>Izp. ilgums <input class="log-actual-duration" placeholder="${extractDuration(line)}" /></label>
          <label>Izp. vidējais pulss <input class="log-actual-pulse" placeholder="${pulseStr || ""}" /></label>
          ${paceField}
        </div>
      </div>`;
    } else if (line === "Drill") {
      html += `<div class="log-section-row" data-log-section="Drill">
        <div class="log-target">Drill</div>
        <div class="field-grid">
          <label>Izp. ilgums <input class="log-actual-duration" /></label>
        </div>
      </div>`;
    } else {
      const sectionName = line.startsWith("Velo:") ? "Velo" : "Pamatdaļa";
      html += `<div class="log-section-row" data-log-section="${sectionName}">
        <div class="log-target">${line}</div><div class="field-grid">
          <label>Izp. ilgums <input class="log-actual-duration" placeholder="${extractDuration(line)}" /></label>
          <label>Izp. vidējais pulss <input class="log-actual-pulse" placeholder="${extractPulse(line)}" /></label>
        </div>
      </div>`;
    }
    }
  });
  html += `</div>`;

  html += getRatingHtml(plan.title, plan.custom_icon);
  html += `<div class="comment-label">Sportista komentārs</div><textarea class="inline-comment" id="logAthleteComment" rows="2" placeholder="Ieraksti komentāru..."></textarea>`;
  logFormContent.innerHTML = html;
  logDialogAddExtraButtons();

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
      if (entry.intervals) logDialogFillIntervals(sectionEl, entry.intervals);
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
  attachPulseValidation();
  const datePicker = document.getElementById("logDatePicker");
  if (datePicker) {
    datePicker.addEventListener("change", () => { logDialogDate = datePicker.value; });
  }
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
  let html = "";
  dayPlans.forEach((plan) => {
    html += `<div class="log-plan-block"><h3>${displayTitle(plan.title)}</h3>`;
    const lines = (plan.details || "").split("\n");
    lines.forEach((line) => {
      if (!line.trim()) return;
      if (isVarIntervalLine(line)) {
        const result = parseSegmentsFromVarLine(line);
        html += `<div class="log-section-row" data-log-section="Pamatdaļa">
          <div class="log-target">${line}</div>`;
        let globalIdx = 0;
        result.segments.forEach((seg) => {
          const label = seg.length + (seg.pace ? " @" + seg.pace : "");
          const count = result.isGrouped ? seg.reps : 1;
          for (let r = 0; r < count; r++) {
            html += `<div class="var-seg-log-row">
              <span class="var-seg-log-label">${escapeHtml(label)}${count > 1 ? " (" + (r + 1) + "." + ")" : ""}</span>
              <label>Izp. temps <input class="log-interval-pace var-seg-pace-input" data-log-interval="${globalIdx}" placeholder="${seg.pace || ""}" /></label>
            </div>`;
            globalIdx++;
          }
        });
        html += `</div>`;
      } else {
        let intervalMatch = line.match(/Pamatdaļa:\s*(\d+)x(\S+)/);
        if (intervalMatch) {
          const count = parseInt(intervalMatch[1]);
          html += `<div class="log-section-row" data-log-section="Pamatdaļa">
            <div class="log-target">${line}</div>
            <div class="field-grid">`;
          for (let i = 0; i < count; i++) {
            html += `<label>${i + 1}. atkārtojums <input class="log-interval-pace" data-log-interval="${i}" placeholder="${extractPace(line)}" /></label>`;
          }
          html += `</div></div>`;
        } else if (line === "Sacensību uzturs" || line === "• Izmantot sacensību uzturu" || line.startsWith("Apavi:") || line.startsWith("• Apavi:")) {
          html += `<div class="log-section-row" data-log-section="${line}">
            <div class="log-target">${line}</div>
          </div>`;
        } else if (line.includes(":")) {
        const paceStr = extractPace(line);
      const paceField = `<label>Izp. vidējais temps <input class="log-actual-pace" placeholder="${paceStr || ""}" /></label>`;
        const pulseStr = extractPulse(line);
        html += `<div class="log-section-row" data-log-section="${line.split(":")[0]}">
          <div class="log-target">${line}</div>
          <div class="field-grid">
            <label>Izp. ilgums <input class="log-actual-duration" placeholder="${extractDuration(line)}" /></label>
            <label>Izp. vidējais pulss <input class="log-actual-pulse" placeholder="${pulseStr || ""}" /></label>
            ${paceField}
          </div>
        </div>`;
      } else if (line === "Drill") {
        html += `<div class="log-section-row" data-log-section="Drill">
          <div class="log-target">Drill</div>
          <div class="field-grid">
            <label>Izp. ilgums <input class="log-actual-duration" /></label>
          </div>
        </div>`;
      } else {
        html += `<div class="log-section-row">
          <div class="log-target">${line}</div>
        </div>`;
      }
      }
    });
    html += `</div>`;
  });

  html += getRatingHtml(dayPlans[0].title, dayPlans[0].custom_icon);
  html += `<div class="comment-label">Sportista komentārs</div><textarea class="inline-comment" id="logAthleteComment" rows="2" placeholder="Ieraksti komentāru..."></textarea>`;
  logFormContent.innerHTML = html;
  logDialogAddExtraButtons();

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
      if (entry.intervals) logDialogFillIntervals(sectionEl, entry.intervals);
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
  attachPulseValidation();
  logDialog.showModal();
}

function extractDuration(line) {
  const m = line.match(/(\d+)(?:['′]| min|min\b)/);
  return m ? m[1] : "";
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

function getPlannedIntervalCount(details) {
  if (!details) return 0;
  let count = 0;
  const lines = details.split("\n");
  lines.forEach(line => {
    if (!line.trim()) return;
    if (isVarIntervalLine(line)) {
      const result = parseSegmentsFromVarLine(line);
      result.segments.forEach(seg => {
        count += result.isGrouped ? seg.reps : 1;
      });
      if (!result.isGrouped && result.laps > 1) count *= result.laps;
      return;
    }
    const m = line.match(/Pamatdaļa:\s*(\d+)x(\S+)/);
    if (m) count += parseInt(m[1]);
  });
  return count;
}

function secToPace(totalSec) {
  if (totalSec < 0) totalSec = 0;
  return { m: Math.floor(totalSec / 60), s: totalSec % 60 };
}
function parsePaceBounds(paceStr) {
  if (!paceStr) return null;
  let s = paceStr.trim().replace(/\s*\/\s*km\s*$/i, "").replace(/\s*(sek|sec|s)\s*$/i, "").trim();
  let minTotal, maxTotal;
  if (s.includes(":")) {
    const range = s.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
    if (range) {
      minTotal = +range[1] * 60 + +range[2];
      maxTotal = +range[3] * 60 + +range[4];
    } else {
      const single = s.match(/^(\d+):(\d+)$/);
      if (single) minTotal = maxTotal = +single[1] * 60 + +single[2];
    }
  } else {
    const range = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
    if (range) {
      minTotal = +range[1];
      maxTotal = +range[2];
    } else {
      const single = s.match(/^(\d+(?:\.\d+)?)$/);
      if (single) minTotal = maxTotal = +single[1];
    }
  }
  if (minTotal === undefined) return null;
  const center = (minTotal + maxTotal) / 2;
  const warnOff = Math.max(1, Math.round(center * 0.03));
  let greenMin, greenMax;
  if (minTotal !== maxTotal) {
    greenMin = minTotal;
    greenMax = maxTotal;
  } else {
    const greenOff = Math.max(1, Math.round(center * 0.015));
    greenMin = center - greenOff;
    greenMax = center + greenOff;
  }
  return {
    min: secToPace(Math.max(0, greenMin)),
    max: secToPace(Math.max(0, greenMax)),
    warnBelow: secToPace(Math.max(0, center - warnOff)),
    warnAbove: secToPace(center + warnOff),
    isRange: minTotal !== maxTotal
  };
}
function paceLt(a, b) {
  return (a.m * 60 + a.s) < (b.m * 60 + b.s);
}
function parseAthleteInput(str) {
  if (!str) return null;
  let s = str.trim().replace(/\s*\/\s*km\s*$/i, "").replace(/\s*(sek|sec|s)\s*$/i, "").trim();
  const mmss = s.match(/^(\d+):(\d+)$/);
  if (mmss) return { m: +mmss[1], s: +mmss[2] };
  const num = s.match(/^(\d+(?:\.\d+)?)$/);
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
    if (isVarIntervalLine(line)) {
      const varBounds = parseVarIntervalPaceBounds(line);
      const firstKey = Object.keys(varBounds)[0];
      if (firstKey) {
        map[section] = varBounds[firstKey];
      }
      Object.assign(map, varBounds);
    } else {
      const paceStr = extractPace(line);
      if (paceStr) {
        const bounds = parsePaceBounds(paceStr);
        if (bounds) map[section] = bounds;
      }
    }
  });
  return map;
}
function attachPulseValidation() {
  document.querySelectorAll("[data-log-section]").forEach((sectionEl) => {
    const targetLine = sectionEl.querySelector(".log-target")?.textContent || "";
    const pulseStr = extractPulse(targetLine);
    if (!pulseStr) return;
    const inp = sectionEl.querySelector(".log-actual-pulse");
    if (!inp) return;
    inp.placeholder = pulseStr;
  });
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

