let weeklyReviewedSet = new Set();

const weeklyReviewDialog = document.getElementById("weeklyReviewDialog");
const weeklyReviewGridWrap = document.getElementById("weeklyReviewGridWrap");

function weeklyReviewKey(athleteId, weekStart) {
  return `${athleteId}|${weekStart}`;
}

function getWeeklyReviewWeeks() {
  const currentMonday = getMonday(new Date());
  const weeks = [];
  for (let i = 12; i >= 0; i--) {
    weeks.push(formatDateISO(addDays(currentMonday, -7 * i)));
  }
  return weeks;
}

async function openWeeklyReviewDialog() {
  weeklyReviewGridWrap.innerHTML = '<p class="muted">Ielādē...</p>';
  weeklyReviewDialog.showModal();
  try {
    const rows = await getWeeklyReviews();
    weeklyReviewedSet = new Set(rows.map((r) => weeklyReviewKey(r.athlete_id, r.week_start)));
    renderWeeklyReviewGrid();
  } catch (err) {
    console.error(err);
    weeklyReviewGridWrap.innerHTML = '<p class="muted">Neizdevās ielādēt datus (iespējams, datubāzes tabula vēl nav izveidota).</p>';
  }
}

function closeWeeklyReviewDialog() {
  weeklyReviewDialog.close();
}

function renderWeeklyReviewGrid() {
  const weeks = getWeeklyReviewWeeks();
  const header = `
    <tr>
      <th class="weekly-review-name-col">Sportists</th>
      ${weeks.map((w) => `<th>${formatShortDate(w)}</th>`).join("")}
    </tr>
  `;
  const rows = athletes.map((a) => `
    <tr>
      <td class="weekly-review-name-col">${escapeHtml(a.full_name)}</td>
      ${weeks.map((w) => `
        <td>${weeklyReviewedSet.has(weeklyReviewKey(a.id, w)) ? '<span class="weekly-review-check">✓</span>' : ""}</td>
      `).join("")}
    </tr>
  `).join("");
  weeklyReviewGridWrap.innerHTML = `
    <table class="weekly-review-table">
      <thead>${header}</thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

document.getElementById("openWeeklyReviewBtn")?.addEventListener("click", openWeeklyReviewDialog);
document.getElementById("closeWeeklyReviewBtn")?.addEventListener("click", closeWeeklyReviewDialog);
