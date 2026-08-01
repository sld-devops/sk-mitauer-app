// Tabs are derived per athlete from their own completed interval sessions, so
// nothing is hardcoded here. A coach writes an interval either as a distance
// ("6x400m") or as a duration ("6x4min"), so both kinds get their own tab
// strip under the Attālums/Laiks switch. These ranges reject typos and keep
// the two kinds from being confused (e.g. "3min" must not become 3 metres).
const MIN_INTERVAL_METERS = 50;
const MAX_INTERVAL_METERS = 20000;
const MIN_INTERVAL_SECONDS = 15;
const MAX_INTERVAL_SECONDS = 3600;
const MAX_INTERVAL_SESSIONS = 5;

let intervalHistoryMode = "dist"; // "dist" | "time"
let intervalHistoryActiveDist = null;
let intervalHistoryActiveDur = null;

function parseDistanceMeters(str) {
  str = (str || "").trim().toLowerCase().replace(",", ".");
  let m = str.match(/^(\d+(?:\.\d+)?)\s*m$/);
  if (m) return Math.round(parseFloat(m[1]));
  m = str.match(/^(\d+(?:\.\d+)?)\s*km$/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  m = str.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Math.round(parseFloat(m[1]));
  return null;
}

// Accepts "4min", "4 min", "4'", "90s", "1:30", "1min30s".
function parseDurationSeconds(str) {
  str = (str || "").trim().toLowerCase().replace(",", ".");
  let m = str.match(/^(\d+)\s*(?:min|['′])\s*(\d+)\s*(?:s|sek|sec|["″])?$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = str.match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = str.match(/^(\d+(?:\.\d+)?)\s*(?:min|minūtes|['′])$/);
  if (m) return Math.round(parseFloat(m[1]) * 60);
  m = str.match(/^(\d+)\s*(?:s|sek|sec|["″])$/);
  if (m) return parseInt(m[1]);
  return null;
}

function isPlausibleIntervalDistance(meters) {
  return meters !== null && meters >= MIN_INTERVAL_METERS && meters <= MAX_INTERVAL_METERS;
}

function isPlausibleIntervalDuration(seconds) {
  return seconds !== null && seconds >= MIN_INTERVAL_SECONDS && seconds <= MAX_INTERVAL_SECONDS;
}

function formatIntervalDistLabel(meters) {
  if (meters < 1000) return meters + "m";
  const km = meters / 1000;
  return (Number.isInteger(km) ? String(km) : km.toFixed(1).replace(".", ",")) + "km";
}

function formatIntervalDurLabel(seconds) {
  if (seconds < 60) return seconds + "s";
  const min = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${min}min ${rest}s` : `${min}min`;
}

// Sorts one written interval length into the distance bucket or the time
// bucket. Anything unrecognised (or implausible) is ignored on purpose.
function classifyIntervalLength(raw, out) {
  const meters = parseDistanceMeters(raw);
  if (isPlausibleIntervalDistance(meters)) {
    out.distances.push(meters);
    return;
  }
  const seconds = parseDurationSeconds(raw);
  if (isPlausibleIntervalDuration(seconds)) out.durations.push(seconds);
}

function extractIntervalLengths(details) {
  const out = { distances: [], durations: [] };
  if (!details) return out;
  const lines = details.split("\n");
  lines.forEach(line => {
    if (isVarIntervalLine(line)) {
      const result = parseSegmentsFromVarLine(line);
      result.segments.forEach(seg => classifyIntervalLength(seg.length, out));
    } else {
      // Grabs the length written right after "Nx": "400m", "400 m", "1,5km",
      // a bare "400", or a duration such as "4min" / "4'" / "90s" / "1:30".
      const m = line.match(/Pamatdaļa:\s*\d+\s*x\s*([\d.,]+(?::\d{1,2})?\s*(?:(?:min|['′])\s*(?:\d+\s*(?:s|sek|sec|["″]))?|km|sek|sec|[msh]|["″])?)/i);
      if (m) classifyIntervalLength(m[1], out);
    }
  });
  return out;
}

// One pass over the athlete's history -> two Maps (distance in meters, and
// duration in seconds) of length to its most recent sessions. A length only
// appears once the athlete has actually logged that session, so every tab is
// guaranteed to have at least one card.
function buildIntervalHistory() {
  const today = formatDateISO(new Date());
  const logByPlanId = new Map();
  allLogEntries.forEach(l => {
    if (!logByPlanId.has(l.plan_id)) logByPlanId.set(l.plan_id, l);
  });

  const history = { dist: new Map(), time: new Map() };
  const add = (map, key, session) => {
    if (!map.has(key)) map.set(key, []);
    const sessions = map.get(key);
    if (sessions.length < MAX_INTERVAL_SESSIONS) sessions.push(session);
  };

  for (const plan of allPlans) {
    if (plan.date > today) continue;
    const log = logByPlanId.get(plan.id);
    if (!log) continue;
    const lengths = extractIntervalLengths(plan.details);
    new Set(lengths.distances).forEach(d => add(history.dist, d, { plan, log }));
    new Set(lengths.durations).forEach(s => add(history.time, s, { plan, log }));
  }
  return history;
}

function renderIntervalHistoryCard(session) {
  const { plan, log } = session;
  const notCompleted = plan.completed === false;
  const mainLine = extractMainPart(plan.details);
  const paceBoundsMap = buildPaceBoundsMap(plan.details);
  const planLogData = log?.log_data || [];
  const feelingBadge = log?.feeling || log?.feeling_tags ? feelingBadgeHtml(log.feeling, log.feeling_tags) : "";
  const logNotes = log?.notes
    ? `<div class="log-notes">${escapeHtml(log.notes)}</div>`
    : "";
  const todBadge = plan.time_of_day
    ? `<span class="tod-badge tod-${plan.time_of_day}">${todLabel(plan.time_of_day)}</span>`
    : "";

  let logBlock = "";
  if (log) {
    const plannedIntervalCount = getPlannedIntervalCount(plan.details);
    const pamatData = planLogData.filter(e => e.section === "Pamatdaļa");
    const inlineHtml = pamatData.length ? renderLogEntryLines(pamatData, paceBoundsMap, plannedIntervalCount) : "";
    if (inlineHtml || feelingBadge || logNotes) {
      logBlock = `
        <div class="log-card log-inline">
          ${inlineHtml}
          ${feelingBadge}
          ${logNotes}
        </div>`;
    }
  }

  const coachComment = plan.coach_comment
    ? `<div class="log-notes">${escapeHtml(plan.coach_comment)}</div>`
    : "";

  return `
    <article class="session-card interval-history-card${notCompleted ? " not-completed" : ""}">
      <div style="font-size:0.82rem;color:var(--muted);margin-bottom:4px;">${formatDateLV(plan.date)} ${todBadge}</div>
      <span class="plan-type-badge">${plan.custom_icon || badgeForTitle(plan.title)}</span>
      ${notCompleted ? '<span class="not-completed-icon-abs">!</span>' : ""}
      <div class="task-card">
        <strong>${escapeHtml(mainLine)}</strong>
      </div>
      ${coachComment}
      ${logBlock}
      ${notCompleted ? `<div class="not-completed-badge"><span class="not-completed-icon">!</span> Sportists atzīmēja kā neizpildītu</div>` : ""}
      ${notCompleted && plan.athlete_comment ? `<div class="log-notes not-completed-comment">${escapeHtml(plan.athlete_comment)}</div>` : ""}
    </article>
  `;
}

function renderIntervalHistory() {
  const body = document.getElementById("intervalHistoryBody");
  const athleteId = getSelectedAthleteId();
  if (!athleteId) {
    body.innerHTML = "";
    return;
  }

  const history = buildIntervalHistory();
  const distances = [...history.dist.keys()].sort((a, b) => a - b);
  const durations = [...history.time.keys()].sort((a, b) => a - b);

  if (distances.length === 0 && durations.length === 0) {
    body.innerHTML = '<p class="interval-empty">Nav neviena intervālu treniņa</p>';
    return;
  }

  // Only auto-switch when the current side has nothing at all for this
  // athlete; a deliberate click on an empty side is left alone.
  if (intervalHistoryMode === "dist" && distances.length === 0) intervalHistoryMode = "time";
  if (intervalHistoryMode === "time" && durations.length === 0 && distances.length) intervalHistoryMode = "dist";

  const isTime = intervalHistoryMode === "time";
  const keys = isTime ? durations : distances;
  const map = isTime ? history.time : history.dist;
  const label = isTime ? formatIntervalDurLabel : formatIntervalDistLabel;
  let activeKey = isTime ? intervalHistoryActiveDur : intervalHistoryActiveDist;

  // The previously selected length may not exist for this athlete.
  if (!keys.includes(activeKey)) {
    activeKey = keys.length ? keys[0] : null;
    if (isTime) intervalHistoryActiveDur = activeKey;
    else intervalHistoryActiveDist = activeKey;
  }

  let html = `
    <div class="view-tabs interval-mode-tabs">
      <button type="button" data-mode="dist"${isTime ? "" : ' class="active"'}>Attālums</button>
      <button type="button" data-mode="time"${isTime ? ' class="active"' : ""}>Laiks</button>
    </div>`;

  if (keys.length === 0) {
    html += `<p class="interval-empty">${isTime ? "Nav neviena laika intervāla" : "Nav neviena attāluma intervāla"}</p>`;
  } else {
    html += '<div class="interval-tabs">';
    keys.forEach(k => {
      html += `<button class="interval-tab${k === activeKey ? " active" : ""}" data-len="${k}">${label(k)}</button>`;
    });
    html += "</div>";

    html += '<div class="interval-sessions">';
    map.get(activeKey).forEach(s => {
      html += renderIntervalHistoryCard(s);
    });
    html += "</div>";
  }

  body.innerHTML = html;

  body.querySelectorAll(".interval-mode-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      intervalHistoryMode = btn.dataset.mode;
      renderIntervalHistory();
    });
  });

  body.querySelectorAll(".interval-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const len = parseInt(btn.dataset.len);
      if (intervalHistoryMode === "time") intervalHistoryActiveDur = len;
      else intervalHistoryActiveDist = len;
      renderIntervalHistory();
    });
  });
}
