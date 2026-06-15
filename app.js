const days = [
  "Pirmdiena",
  "Otrdiena",
  "Trešdiena",
  "Ceturtdiena",
  "Piektdiena",
  "Sestdiena",
  "Svētdiena",
];

const athletes = [
  { id: "sandis", name: "Sandis Linards", group: "Pieaugušie" },
  { id: "laura", name: "Laura Ozola", group: "Pieaugušie" },
  { id: "martins", name: "Mārtiņš Bērziņš", group: "Pieaugušie" },
  { id: "elina", name: "Elīna Kalniņa", group: "Jaunieši" },
];

const templates = [
  {
    id: "easy-run",
    title: "Vieglais skrējiens",
    details: "45-60 min mierīgi. Beigās 4-6 īsi paātrinājumi.",
  },
  {
    id: "intervals",
    title: "Intervāli stadionā",
    details: "15 min iesildīšanās, drills, 6 x 600 m, pauze 2 min, atsildīšanās.",
  },
  {
    id: "tempo",
    title: "Tempa treniņš",
    details: "20 min viegli, 2 x 12 min tempā, pauze 3 min, 10 min atsildīšanās.",
  },
  {
    id: "long-run",
    title: "Garais skrējiens",
    details: "75-90 min vienmērīgā tempā. Sekot pašsajūtai.",
  },
];

let activeRole = "coach";
let selectedAthleteId = athletes[0].id;
let selectedSource = "template";
let selectedTemplateId = templates[0].id;
let activeCommentSessionId = null;
let pendingCustomDay = null;

let plans = [
  {
    id: createId(),
    athleteId: "sandis",
    day: "Pirmdiena",
    title: "Vieglais skrējiens",
    details: "45-60 min mierīgi. Beigās 4-6 īsi paātrinājumi.",
    coachComment: "Pēc vakardienas slodzes turēt mierīgu tempu.",
    athleteComment: "",
  },
  {
    id: createId(),
    athleteId: "sandis",
    day: "Trešdiena",
    title: "Intervāli stadionā",
    details: "15 min iesildīšanās, drills, 6 x 600 m, pauze 2 min, atsildīšanās.",
    coachComment: "Ja pūš stiprs vējš, intervālus skriet pēc sajūtas.",
    athleteComment: "",
  },
];

const athleteSelect = document.querySelector("#athleteSelect");
const athleteComment = document.querySelector("#athleteComment");
const calendarGrid = document.querySelector("#calendarGrid");
const coachComment = document.querySelector("#coachComment");
const commentDialog = document.querySelector("#commentDialog");
const cooldownDuration = document.querySelector("#cooldownDuration");
const cooldownPulse = document.querySelector("#cooldownPulse");
const customBuilder = document.querySelector("#customBuilder");
const customPreview = document.querySelector("#customPreview");
const customType = document.querySelector("#customType");
const includeDrills = document.querySelector("#includeDrills");
const intervalFields = document.querySelector("#intervalFields");
const intervalLength = document.querySelector("#intervalLength");
const intervalPace = document.querySelector("#intervalPace");
const mainDuration = document.querySelector("#mainDuration");
const mainFields = document.querySelector("#mainFields");
const mainPulse = document.querySelector("#mainPulse");
const profileCard = document.querySelector("#profileCard");
const repeatCount = document.querySelector("#repeatCount");
const restDuration = document.querySelector("#restDuration");
const saveCommentButton = document.querySelector("#saveCommentButton");
const saveTemplateDialog = document.querySelector("#saveTemplateDialog");
const saveTemplateSummary = document.querySelector("#saveTemplateSummary");
const insertOnlyButton = document.querySelector("#insertOnlyButton");
const saveAndInsertButton = document.querySelector("#saveAndInsertButton");
const templateList = document.querySelector("#templateList");
const templatePicker = document.querySelector("#templatePicker");
const trainingPickerPanel = document.querySelector("#trainingPickerPanel");
const warmupDuration = document.querySelector("#warmupDuration");
const warmupPulse = document.querySelector("#warmupPulse");
const weekLabel = document.querySelector("#weekLabel");

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getWeekLabel() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatter = new Intl.DateTimeFormat("lv-LV", {
    day: "numeric",
    month: "long",
  });

  return `${formatter.format(monday)} - ${formatter.format(sunday)}`;
}

function getSelectedAthlete() {
  return athletes.find((athlete) => athlete.id === selectedAthleteId);
}

function getSelectedTemplate() {
  return templates.find((template) => template.id === selectedTemplateId);
}

function formatPulse(pulse) {
  const cleanPulse = pulse.trim();
  return cleanPulse ? `, pulss ${cleanPulse}` : "";
}

function formatPace(pace) {
  const cleanPace = pace.trim();
  return cleanPace ? `, temps ${cleanPace}` : "";
}

function formatPart(label, duration, pulse) {
  const cleanDuration = duration.trim();
  if (!cleanDuration) return "";
  return `${label}: ${cleanDuration}${formatPulse(pulse)}.`;
}

function getDrillsPart() {
  return includeDrills.checked ? "Drills." : "";
}

function getGeneratedTraining() {
  const type = customType.value;
  const warmup = formatPart("Iesildīšanās", warmupDuration.value, warmupPulse.value);
  const drills = getDrillsPart();
  const cooldown = formatPart("Atsildīšanās", cooldownDuration.value, cooldownPulse.value);
  const baseParts = [warmup, drills].filter(Boolean);

  if (type !== "Intervāli") {
    const main = formatPart("Pamatdaļa", mainDuration.value, mainPulse.value);
    return {
      title: type,
      details: [...baseParts, main, cooldown].filter(Boolean).join(" "),
    };
  }

  const intervalCore = [repeatCount.value.trim(), intervalLength.value.trim()]
    .filter(Boolean)
    .join(" x ");
  const interval = intervalCore ? `Intervāli: ${intervalCore}${formatPace(intervalPace.value)}.` : "";
  const rest = restDuration.value.trim() ? `Atpūta ${restDuration.value.trim()}.` : "";

  return {
    title: "Intervālu treniņš",
    details: [...baseParts, interval, rest, cooldown].filter(Boolean).join(" "),
  };
}

function getSelectedTraining() {
  return selectedSource === "template" ? getSelectedTemplate() : getGeneratedTraining();
}

function renderAthleteSelect() {
  athleteSelect.innerHTML = athletes
    .map(
      (athlete) => `
        <option value="${athlete.id}" ${athlete.id === selectedAthleteId ? "selected" : ""}>
          ${athlete.name}
        </option>
      `,
    )
    .join("");
}

function renderTemplates() {
  templateList.innerHTML = templates
    .map(
      (template) => `
        <button class="template-button ${template.id === selectedTemplateId ? "active" : ""}" data-template="${template.id}" type="button">
          <strong>${template.title}</strong>
          <span>${template.details}</span>
        </button>
      `,
    )
    .join("");
}

function renderCustomPreview() {
  const training = getGeneratedTraining();

  customPreview.innerHTML = `
    <strong>${training.title}</strong>
    <span>${training.details}</span>
  `;
}

function renderSourcePicker() {
  templatePicker.hidden = selectedSource !== "template";
  customBuilder.hidden = selectedSource !== "custom";
  intervalFields.hidden = customType.value !== "Intervāli";
  mainFields.hidden = customType.value === "Intervāli";

  document.querySelectorAll("[data-source]").forEach((button) => {
    button.classList.toggle("active", button.dataset.source === selectedSource);
  });

  renderCustomPreview();
}

function renderPlanCard(plan) {
  return `
    <article class="session-card">
      <h3>${plan.title}</h3>
      <p>${plan.details}</p>
      ${plan.coachComment ? `<div class="comment-preview"><strong>Treneris:</strong> ${plan.coachComment}</div>` : ""}
      ${plan.athleteComment ? `<div class="comment-preview"><strong>Sportists:</strong> ${plan.athleteComment}</div>` : ""}
      <button class="secondary-action" data-comment-session="${plan.id}" type="button">Komentāri</button>
    </article>
  `;
}

function renderCalendar() {
  const athletePlans = plans.filter((plan) => plan.athleteId === selectedAthleteId);

  calendarGrid.innerHTML = days
    .map((day) => {
      const dayPlans = athletePlans.filter((plan) => plan.day === day);

      return `
        <section class="day-column">
          <div class="day-name">${day}</div>
          ${activeRole === "coach" ? `<button class="add-day-button" data-day="${day}" type="button">+ Ielikt treniņu</button>` : ""}
          ${dayPlans.length ? dayPlans.map(renderPlanCard).join("") : '<p class="empty-day">Nav treniņa</p>'}
        </section>
      `;
    })
    .join("");
}

function renderProfile() {
  const athlete = getSelectedAthlete();
  const planCount = plans.filter((plan) => plan.athleteId === selectedAthleteId).length;

  profileCard.innerHTML = `
    <div class="profile-name">${activeRole === "coach" ? "Trenera skats" : athlete.name}</div>
    <div class="profile-meta">${athlete.group}</div>
    <strong>${planCount} treniņi šonedēļ</strong>
  `;
}

function render() {
  weekLabel.textContent = getWeekLabel();
  trainingPickerPanel.hidden = activeRole !== "coach";

  renderAthleteSelect();
  renderTemplates();
  renderSourcePicker();
  renderCalendar();
  renderProfile();
}

function insertTrainingToDay(day, training) {
  plans.push({
    id: createId(),
    athleteId: selectedAthleteId,
    day,
    title: training.title,
    details: training.details,
    coachComment: "",
    athleteComment: "",
  });

  render();
}

function openSaveTemplateDialog(day) {
  const training = getGeneratedTraining();

  pendingCustomDay = day;
  saveTemplateSummary.innerHTML = `
    <strong>${training.title}</strong>
    <span>${training.details}</span>
  `;
  saveTemplateDialog.showModal();
}

function addTrainingToDay(day) {
  if (selectedSource === "custom") {
    openSaveTemplateDialog(day);
    return;
  }

  insertTrainingToDay(day, getSelectedTemplate());
}

function openCommentDialog(sessionId) {
  const plan = plans.find((item) => item.id === sessionId);
  if (!plan) return;

  activeCommentSessionId = sessionId;
  coachComment.value = plan.coachComment;
  athleteComment.value = plan.athleteComment;
  coachComment.disabled = activeRole !== "coach";
  athleteComment.disabled = activeRole !== "athlete";
  commentDialog.showModal();
}

function saveComments() {
  const plan = plans.find((item) => item.id === activeCommentSessionId);
  if (!plan) return;

  if (activeRole === "coach") {
    plan.coachComment = coachComment.value.trim();
  } else {
    plan.athleteComment = athleteComment.value.trim();
  }

  commentDialog.close();
  render();
}

athleteSelect.addEventListener("change", (event) => {
  selectedAthleteId = event.target.value;
  render();
});

templateList.addEventListener("click", (event) => {
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

[
  customType,
  warmupDuration,
  warmupPulse,
  includeDrills,
  repeatCount,
  intervalLength,
  intervalPace,
  restDuration,
  mainDuration,
  mainPulse,
  cooldownDuration,
  cooldownPulse,
].forEach((input) => {
  input.addEventListener("input", renderSourcePicker);
  input.addEventListener("change", renderSourcePicker);
});

calendarGrid.addEventListener("click", (event) => {
  const dayButton = event.target.closest("[data-day]");
  const commentButton = event.target.closest("[data-comment-session]");

  if (dayButton && activeRole === "coach") {
    addTrainingToDay(dayButton.dataset.day);
  }

  if (commentButton) {
    openCommentDialog(commentButton.dataset.commentSession);
  }
});

document.querySelectorAll("[data-role]").forEach((button) => {
  button.addEventListener("click", () => {
    activeRole = button.dataset.role;
    document
      .querySelectorAll("[data-role]")
      .forEach((roleButton) => roleButton.classList.toggle("active", roleButton === button));
    render();
  });
});

insertOnlyButton.addEventListener("click", () => {
  if (!pendingCustomDay) return;

  insertTrainingToDay(pendingCustomDay, getGeneratedTraining());
  pendingCustomDay = null;
  saveTemplateDialog.close();
});

saveAndInsertButton.addEventListener("click", () => {
  if (!pendingCustomDay) return;

  const training = getGeneratedTraining();
  const savedTemplate = {
    id: createId(),
    title: training.title,
    details: training.details,
  };

  templates.push(savedTemplate);
  selectedTemplateId = savedTemplate.id;
  insertTrainingToDay(pendingCustomDay, training);
  pendingCustomDay = null;
  saveTemplateDialog.close();
});

saveCommentButton.addEventListener("click", saveComments);

render();
