// Distance tabs are derived per athlete from their own completed interval
// sessions, so nothing is hardcoded here. Anything outside this range is a
// duration or a typo, not an interval length (e.g. "3min" -> 3).
const MIN_INTERVAL_METERS = 50;
const MAX_INTERVAL_METERS = 20000;
const MAX_INTERVAL_SESSIONS = 3;

let intervalHistoryActiveDist = null;

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

function isPlausibleIntervalDistance(meters) {
  return meters !== null && meters >= MIN_INTERVAL_METERS && meters <= MAX_INTERVAL_METERS;
}

function formatIntervalDistLabel(meters) {
  if (meters < 1000) return meters + "m";
  const km = meters / 1000;
  return (Number.isInteger(km) ? String(km) : km.toFixed(1).replace(".", ",")) + "km";
}

function extractIntervalDistances(details) {
  const distances = [];
  if (!details) return distances;
  const lines = details.split("\n");
  lines.forEach(line => {
    if (isVarIntervalLine(line)) {
      const result = parseSegmentsFromVarLine(line);
      result.segments.forEach(seg => {
        const d = parseDistanceMeters(seg.length);
        if (isPlausibleIntervalDistance(d)) distances.push(d);
      });
    } else {
      // Tolerates "6x400m", "6x400 m", "6x1,5km" and a bare "6x400".
      const m = line.match(/Pamatdaļa:\s*\d+\s*x\s*([\d.,]+\s*km\b|[\d.,]+\s*m\b|[\d.,]+)/i);
      if (m) {
        const d = parseDistanceMeters(m[1]);
        if (isPlausibleIntervalDistance(d)) distances.push(d);
      }
    }
  });
  return distances;
}

// One pass over the athlete's history -> Map of distance (meters) to its most
// recent sessions. A distance only appears once the athlete has actually logged
// that session, so every tab is guaranteed to have at least one card.
function buildIntervalHistoryMap() {
  const today = formatDateISO(new Date());
  const logByPlanId = new Map();
  allLogEntries.forEach(l => {
    if (!logByPlanId.has(l.plan_id)) logByPlanId.set(l.plan_id, l);
  });

  const map = new Map();
  for (const plan of allPlans) {
    if (plan.date > today) continue;
    const log = logByPlanId.get(plan.id);
    if (!log) continue;
    new Set(extractIntervalDistances(plan.details)).forEach(d => {
      if (!map.has(d)) map.set(d, []);
      const sessions = map.get(d);
      if (sessions.length < MAX_INTERVAL_SESSIONS) sessions.push({ plan, log });
    });
  }
  return map;
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

  const historyMap = buildIntervalHistoryMap();
  const distances = [...historyMap.keys()].sort((a, b) => a - b);

  if (distances.length === 0) {
    body.innerHTML = '<p class="interval-empty">Nav neviena intervālu treniņa</p>';
    return;
  }

  // The previously selected distance may not exist for this athlete.
  if (!distances.includes(intervalHistoryActiveDist)) intervalHistoryActiveDist = distances[0];

  let html = '<div class="interval-tabs">';
  distances.forEach(d => {
    const active = d === intervalHistoryActiveDist ? " active" : "";
    html += `<button class="interval-tab${active}" data-dist="${d}">${formatIntervalDistLabel(d)}</button>`;
  });
  html += "</div>";

  html += '<div class="interval-sessions">';
  historyMap.get(intervalHistoryActiveDist).forEach(s => {
    html += renderIntervalHistoryCard(s);
  });
  html += "</div>";

  body.innerHTML = html;

  body.querySelectorAll(".interval-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      intervalHistoryActiveDist = parseInt(btn.dataset.dist);
      renderIntervalHistory();
    });
  });
}
