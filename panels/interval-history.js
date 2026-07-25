const INTERVAL_DISTANCES = [200, 300, 400, 800, 1000];
let intervalHistoryActiveDist = 200;

function parseDistanceMeters(str) {
  str = (str || "").trim().toLowerCase();
  let m = str.match(/^(\d+)\s*m$/);
  if (m) return parseInt(m[1]);
  m = str.match(/^(\d+(?:\.\d+)?)\s*km$/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  m = str.match(/^(\d+)$/);
  if (m) return parseInt(m[1]);
  return null;
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
        if (d) distances.push(d);
      });
    } else {
      const m = line.match(/Pamatdaļa:\s*(\d+)x(\S+)/);
      if (m) {
        const d = parseDistanceMeters(m[2]);
        if (d) distances.push(d);
      }
    }
  });
  return distances;
}

function findSessionsForDistance(athletePlans, targetMeters) {
  const today = formatDateISO(new Date());
  const found = [];
  for (const plan of athletePlans) {
    if (found.length >= 3) break;
    if (plan.date > today) continue;
    if (!allLogEntries.some(l => l.plan_id === plan.id)) continue;
    const dists = extractIntervalDistances(plan.details);
    if (dists.includes(targetMeters)) {
      const log = allLogEntries.find(l => l.plan_id === plan.id);
      found.push({ plan, log });
    }
  }
  return found;
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

  let html = '<div class="interval-tabs">';
  INTERVAL_DISTANCES.forEach(d => {
    const label = d >= 1000 ? d / 1000 + "km" : d + "m";
    const active = d === intervalHistoryActiveDist ? " active" : "";
    html += `<button class="interval-tab${active}" data-dist="${d}">${label}</button>`;
  });
  html += "</div>";

  const athletePlans = allPlans;

  const sessions = findSessionsForDistance(athletePlans, intervalHistoryActiveDist);

  if (sessions.length === 0) {
    html += "";
  } else {
    html += '<div class="interval-sessions">';
    sessions.forEach(s => {
      html += renderIntervalHistoryCard(s);
    });
    html += "</div>";
  }

  body.innerHTML = html;

  body.querySelectorAll(".interval-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      intervalHistoryActiveDist = parseInt(btn.dataset.dist);
      renderIntervalHistory();
    });
  });
}
