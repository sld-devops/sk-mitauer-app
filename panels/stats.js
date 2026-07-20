let statsPeriod = "week";
let trendWeeks = 8;
let trendMonths = 6;
let weeklyTrend = [];
let monthlyTrend = [];

const statsBar = document.getElementById("statsBar");

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
    ? [{ val: 4, label: "4 nedēļas" }, { val: 8, label: "8 nedēļas" }, { val: 12, label: "12 nedēļas" }]
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
