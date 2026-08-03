let statsPeriod = "week";
let trendWeeks = 8;
let trendMonths = 6;
let weeklyTrend = [];
let monthlyTrend = [];

const statsBar = document.getElementById("statsBar");

// Drawing surface. The SVG is scaled to the panel width by CSS, so these are
// just internal proportions - lines keep their real thickness thanks to
// vector-effect="non-scaling-stroke".
const CHART_W = 1000;
const CHART_H = 300;
const CHART_PAD = { top: 18, right: 96, bottom: 34, left: 12 };

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
  // A metric that is zero for the whole period would just lie along the bottom
  // edge and get in the way of the ones that do have data.
  const hasData = {};
  for (const m of metrics) {
    hasData[m.key] = data.some((d) => (d[m.key] || 0) > 0);
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

  // The full week label ("07.07.–13.07.") is far too wide to repeat under every
  // point, so the axis only carries the start of the week.
  function axisDateLabel(d) {
    if (statsPeriod === "week") {
      const parts = (d.week_start || "").split("-");
      if (parts.length !== 3) return "";
      return `${parts[2]}.${parts[1]}.`;
    }
    const parts = (d.month_start || "").split("-");
    return parts.length >= 2 ? `${parts[1]}.${parts[0].slice(2)}.` : "";
  }

  function displayValue(m, val) {
    if (m.key === "run_km") return val.toFixed(1) + " km";
    return val.toFixed(1) + " h";
  }

  const legendHtml = `
    <div class="chart-legend">
      ${metrics.map((m) => `
        <span class="chart-legend-item${hasData[m.key] ? "" : " is-empty"}">
          <span class="chart-legend-swatch ${m.color}"></span>
          ${m.label}
          <span class="chart-legend-max">${hasData[m.key] ? `līdz ${displayValue(m, maxValues[m.key])}` : "nav datu"}</span>
        </span>
      `).join("")}
    </div>
  `;

  statsBar.innerHTML = `
    <div class="stats-chart">
      ${tabsHtml}
      ${buildStatsRangeHtml()}
      ${legendHtml}
      ${buildTrendChartHtml(data, metrics, maxValues, hasData, {
        chartDateLabel, axisDateLabel, displayValue,
      })}
    </div>
  `;

  attachStatsTabHandlers();
  attachStatsRangeHandlers();
}

function buildStatsRangeHtml() {
  const isWeek = statsPeriod === "week";
  const ranges = isWeek
    ? [{ val: 4, label: "4 nedēļas" }, { val: 8, label: "8 nedēļas" }, { val: 12, label: "12 nedēļas" }]
    : [{ val: 3, label: "3 mēn." }, { val: 6, label: "6 mēn." }, { val: 12, label: "12 mēn." }];
  const currentRange = isWeek ? trendWeeks : trendMonths;

  return `
    <div class="stats-range">
      ${ranges.map((r) => `
        <button class="${r.val === currentRange ? "active" : ""}" data-stat-range="${r.val}" type="button">${r.label}</button>
      `).join("")}
    </div>
  `;
}

// Catmull-Rom through every point, converted to cubic beziers - that is what
// makes the line curve through the data instead of kinking at each point.
// Control points are clamped to the plot area so a steep step cannot bow the
// curve out through the top or bottom edge.
function smoothLinePath(points, minY, maxY) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const clamp = (v) => Math.max(minY, Math.min(maxY, v));
  const TENSION = 0.85;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || points[i + 1];
    const c1x = p1.x + ((p2.x - p0.x) / 6) * TENSION;
    const c1y = clamp(p1.y + ((p2.y - p0.y) / 6) * TENSION);
    const c2x = p2.x - ((p3.x - p1.x) / 6) * TENSION;
    const c2y = clamp(p2.y - ((p3.y - p1.y) / 6) * TENSION);
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Keeps the end-of-line value labels from sitting on top of each other when two
// curves finish at nearly the same height. Nudges them apart, in order.
function spreadLabelYs(entries, minY, maxY, gap) {
  const sorted = entries.slice().sort((a, b) => a.y - b.y);
  let prev = -Infinity;
  sorted.forEach((e) => {
    e.labelY = Math.max(e.y, prev + gap);
    prev = e.labelY;
  });
  const overflow = sorted.length ? sorted[sorted.length - 1].labelY - maxY : 0;
  if (overflow > 0) sorted.forEach((e) => { e.labelY -= overflow; });
  sorted.forEach((e) => { e.labelY = Math.max(minY, Math.min(maxY, e.labelY)); });
  return entries;
}

function buildTrendChartHtml(data, metrics, maxValues, hasData, fmt) {
  const plotLeft = CHART_PAD.left;
  const plotRight = CHART_W - CHART_PAD.right;
  const plotTop = CHART_PAD.top;
  const plotBottom = CHART_H - CHART_PAD.bottom;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // A single point has no width to spread over, so it sits in the middle.
  const xAt = (i) => (data.length === 1
    ? plotLeft + plotW / 2
    : plotLeft + (i / (data.length - 1)) * plotW);
  const yAt = (key, val) => plotBottom - (val / maxValues[key]) * plotH;

  const gridHtml = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = (plotTop + f * plotH).toFixed(1);
      return `<line class="chart-grid-line" x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" />`;
    })
    .join("");

  const drawn = metrics.filter((m) => hasData[m.key]);

  const linesHtml = drawn.map((m) => {
    const points = data.map((d, i) => ({ x: xAt(i), y: yAt(m.key, d[m.key] || 0) }));
    const path = smoothLinePath(points, plotTop, plotBottom);
    const dots = points.map((p, i) => `
      <circle class="chart-dot ${m.color}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5">
        <title>${escapeHtml(fmt.chartDateLabel(data[i]))} · ${escapeHtml(m.label)}: ${escapeHtml(fmt.displayValue(m, data[i][m.key] || 0))}</title>
      </circle>
    `).join("");
    return `<path class="chart-line ${m.color}" d="${path}" />${dots}`;
  }).join("");

  // Last value of each curve, printed just past the right edge of the plot.
  const endLabels = spreadLabelYs(
    drawn.map((m) => ({
      metric: m,
      y: yAt(m.key, data[data.length - 1][m.key] || 0),
    })),
    plotTop, plotBottom, 20
  );
  const endLabelsHtml = endLabels.map((e) => `
    <text class="chart-end-label ${e.metric.color}" x="${plotRight + 8}" y="${(e.labelY + 4).toFixed(1)}">
      ${escapeHtml(fmt.displayValue(e.metric, data[data.length - 1][e.metric.key] || 0))}
    </text>
  `).join("");

  // With 12 weeks every second label is enough to keep the axis readable. The
  // newest point always gets a label; if that would sit right next to the
  // previous one, the previous one is dropped rather than crowding it.
  const labelStep = data.length > 8 ? 2 : 1;
  const last = data.length - 1;
  const shown = new Set();
  for (let i = 0; i <= last; i += labelStep) shown.add(i);
  if (!shown.has(last)) {
    const prev = Math.max(...shown);
    if (last - prev <= 1) shown.delete(prev);
    shown.add(last);
  }
  const axisHtml = data
    .map((d, i) => (shown.has(i)
      ? `<text class="chart-axis-label" x="${xAt(i).toFixed(1)}" y="${plotBottom + 22}">${escapeHtml(fmt.axisDateLabel(d))}</text>`
      : ""))
    .join("");

  return `
    <div class="chart-plot">
      <svg viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="Paveiktās slodzes tendence">
        ${gridHtml}
        ${linesHtml}
        ${endLabelsHtml}
        ${axisHtml}
      </svg>
    </div>
  `;
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
