const profileCard = document.getElementById("profileCard");
const urlEditState = { garmin: false, strava: false, spreadsheet: false };
profileCard.addEventListener("click", (e) => {
  const btn = e.target.closest(".url-edit-btn");
  if (!btn) return;
  urlEditState[btn.dataset.field] = true;
  renderProfile();
  const input = document.getElementById(`edit${btn.dataset.field}Url`);
  if (input) input.focus();
});

function renderProfile() {
  const athleteId = getSelectedAthleteId();
  const profile = isCoach()
    ? athletes.find((a) => a.id === athleteId) || currentProfile
    : currentProfile;
  const canEdit = currentUser.id === athleteId;
  const canEditUrls = profile.role === "athlete" && canEdit;

  function urlRow(id, label, field, url, logo, placeholder) {
    const editing = canEditUrls && (urlEditState[field] || !url);
    if (editing) {
      return `<input id="${id}" value="${url || ""}" placeholder="${placeholder}" />`;
    }
    if (url) {
      const editBtn = canEditUrls
        ? `<button class="url-edit-btn" data-field="${field}" type="button">Labot</button>`
        : "";
      return `<div class="profile-url-row"><a href="${url}" target="_blank" rel="noopener"><img class="profile-logo" src="${logo}" alt="${label}"></a>${editBtn}</div>`;
    }
    return `<span class="muted">— Nav norādīts</span>`;
  }

  profileCard.innerHTML = `
    <div class="profile-header">
      <div class="profile-name">${profile.full_name}</div>
    </div>
    <section class="profile-section">
      <label>${urlRow("editGarminUrl", "Garmin", "garmin", profile.garmin_url, "https://pngimg.com/uploads/garmin/garmin_PNG5.png", "https://connect.garmin.com/...")}</label>
      <label>${urlRow("editStravaUrl", "Strava", "strava", profile.strava_url, "https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.svg", "https://strava.com/...")}</label>
      <label>Treniņu plāna arhīvs
        ${urlRow("editSpreadsheetUrl", "Kalendāra arhīvs", "spreadsheet", profile.spreadsheet_url, "https://cloud.gmelius.com/public/logos/google/Google_Sheets_Logo_512px.png", "https://docs.google.com/spreadsheets/...")}
      </label>
    </section>
  `;
  ["editGarminUrl", "editStravaUrl", "editSpreadsheetUrl"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("blur", saveProfileUrls);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") e.target.blur();
      });
    }
  });
}

function renderHrZones() {
  const athleteId = getSelectedAthleteId();
  const profile = isCoach()
    ? athletes.find((a) => a.id === athleteId) || currentProfile
    : currentProfile;
  const hrZones = profile.hr_zones || {};
  const canEdit = isCoach();
  const disabled = canEdit ? "" : "disabled";

  const zoneRowsHtml = ["1", "2", "3", "4", "5"]
    .map((z) => {
      const zone = hrZones[z] || {};
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
    <div class="zone-row">
      <span class="zone-num">Maks.</span>
      <input id="maxHrInput" value="${hrZones.max_hr || ""}" placeholder="maks. HR" ${disabled} />
    </div>
  `;

  if (canEdit) {
    document.querySelectorAll("#hrZoneFields .zone-no, #hrZoneFields .zone-lidz, #maxHrInput").forEach(el => {
      el.addEventListener("change", saveHrZones);
    });
  }
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
        <label>Aerobais temps (min/km) <input id="editAerobicPace" value="${thresholds.aerobic_pace || ""}" ${disabled} /></label>
        <label>Aerobais pulss <input id="editAerobicHr" value="${thresholds.aerobic_hr || ""}" ${disabled} /></label>
      </div>
      <div class="field-grid">
        <label>Anaerobais temps (min/km) <input id="editAnaerobicPace" value="${thresholds.anaerobic_pace || ""}" ${disabled} /></label>
        <label>Anaerobais pulss <input id="editAnaerobicHr" value="${thresholds.anaerobic_hr || ""}" ${disabled} /></label>
      </div>
      <div class="field-grid">
        <label>Laktāta temps (min/km) <input id="editLtPace" value="${thresholds.lt_pace || ""}" ${disabled} /></label>
        <label>Laktāta pulss <input id="editLtHr" value="${thresholds.lt_hr || ""}" ${disabled} /></label>
      </div>
    </div>
  `;

  if (canEdit) {
    document.querySelectorAll("#thresholdsBody input").forEach(el => {
      el.addEventListener("change", saveThresholds);
    });
  }
}

function renderPaceHrMap() {
  const athleteId = getSelectedAthleteId();
  const profile = isCoach()
    ? athletes.find((a) => a.id === athleteId) || currentProfile
    : currentProfile;
  const paceHrMap = profile.pace_hr_map || {};
  const canEdit = !isCoach();
  const disabled = canEdit ? "" : "disabled";

  const hrValues = ["125", "135", "145", "155", "165"];
  const zoneRowsHtml = hrValues
    .map((hr) => {
      const entry = paceHrMap[hr] || {};
      return `
        <div class="zone-row">
          <span class="zone-num">${hr}</span>
          <input class="zone-no" value="${entry.no || ""}" placeholder="no" ${disabled} />
          <input class="zone-lidz" value="${entry.lidz || ""}" placeholder="līdz" ${disabled} />
        </div>
      `;
    })
    .join("");

  document.getElementById("paceHrBody").innerHTML = `
    <div class="profile-section" id="paceHrFields">${zoneRowsHtml}</div>
  `;

  if (canEdit) {
    document.querySelectorAll("#paceHrFields .zone-no, #paceHrFields .zone-lidz").forEach(el => {
      el.addEventListener("change", savePaceHrMap);
    });
  }
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
    Object.keys(urlEditState).forEach((k) => (urlEditState[k] = false));
    renderProfile();
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
  const maxHr = document.getElementById("maxHrInput")?.value?.trim();
  if (maxHr) zones.max_hr = maxHr;
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

async function savePaceHrMap() {
  const profile = getViewedProfile();
  const paceHrMap = {};
  document.querySelectorAll("#paceHrFields .zone-row").forEach((row) => {
    const hr = row.querySelector(".zone-num")?.textContent?.trim() || "";
    const no = row.querySelector(".zone-no")?.value?.trim() || "";
    const lidz = row.querySelector(".zone-lidz")?.value?.trim() || "";
    if (hr && (no || lidz)) {
      paceHrMap[hr] = { no, lidz };
    }
  });
  try {
    await updateProfile(profile.id, { pace_hr_map: paceHrMap });
    if (profile.id === currentUser.id) {
      currentProfile = await getProfile(currentUser.id);
    }
    const idx = athletes.findIndex((a) => a.id === profile.id);
    if (idx !== -1) athletes[idx].pace_hr_map = paceHrMap;
    render();
  } catch (e) {
    console.error(e);
  }
}
