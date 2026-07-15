let labTests = [];
let editingLabTestId = null;
let seenLabTestIds = new Set();
let seenIzvertetsIds = new Set();

function loadSeenLabTestIds() {
  try {
    const stored = localStorage.getItem("seenLabTestIds");
    if (stored) seenLabTestIds = new Set(JSON.parse(stored));
  } catch (e) {
    seenLabTestIds = new Set();
  }
}

function saveSeenLabTestIds() {
  localStorage.setItem("seenLabTestIds", JSON.stringify([...seenLabTestIds]));
}

function isLabTestSeen(athleteId, testId) {
  return seenLabTestIds.has(`${athleteId}:${testId}`);
}

function markAllLabTestsSeen(athleteId, tests) {
  tests.forEach(t => seenLabTestIds.add(`${athleteId}:${t.id}`));
  saveSeenLabTestIds();
}

function loadSeenIzvertetsIds() {
  try {
    const stored = localStorage.getItem("seenIzvertetsIds");
    if (stored) seenIzvertetsIds = new Set(JSON.parse(stored));
  } catch (e) {
    seenIzvertetsIds = new Set();
  }
}

function saveSeenIzvertetsIds() {
  localStorage.setItem("seenIzvertetsIds", JSON.stringify([...seenIzvertetsIds]));
}

function isIzvertetsSeen(athleteId, testId) {
  return seenIzvertetsIds.has(`${athleteId}:${testId}`);
}

function markAllIzvertetsSeen(athleteId, tests) {
  tests.forEach(t => seenIzvertetsIds.add(`${athleteId}:${t.id}`));
  saveSeenIzvertetsIds();
}

loadSeenLabTestIds();
loadSeenIzvertetsIds();

document.getElementById("saveLabTestBtn")?.addEventListener("click", saveLabTest);
document.getElementById("deleteLabTestBtn")?.addEventListener("click", deleteLabTestFile);

const LABTEST_TYPE_LABEL = {
  asins_aina: "🧪 Asins aina",
  slodzes_tests: "💉 Slodzes tests",
  cits: "📄 Cits"
};

const LABTEST_TYPE_CLASS = {
  asins_aina: "labtest-type-asins",
  slodzes_tests: "labtest-type-slodzes",
  cits: "labtest-type-cits"
};

function renderLabTests() {
  const body = document.getElementById("labTestsBody");
  if (!body) return;
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;
  const isAthleteView = (activeRole === "athlete") && currentUser.id === athleteId;
  const isCoachView = activeRole === "coach";

  let html = "";

  if (labTests.length === 0) {
    html += `<p class="empty-state">Nav pievienotu izmeklējumu.</p>`;
  } else {
    html += `<div class="labtest-list">`;
    labTests.forEach(t => {
      const izvertetsBadge = t.izvertets && isAthleteView
        ? `<span class="labtest-izvertets-badge">Izvērtēts</span>`
        : "";
      const coachCheckbox = isCoachView
        ? `<label class="labtest-izvertets-cb" title="Izvērtēts">
            <input type="checkbox" data-labtest-id="${t.id}" ${t.izvertets ? "checked" : ""} />
          </label>`
        : "";
      html += `<div class="labtest-row" data-labtest-id="${t.id}">
        <span class="labtest-actions">
          ${coachCheckbox}
          <a class="labtest-download-btn" href="#" data-labtest-id="${t.id}" title="Lejupielādēt">⬇</a>
          ${isAthleteView ? `<button class="labtest-delete-btn" data-labtest-id="${t.id}" title="Dzēst">✕</button>` : ""}
        </span>
        <div class="labtest-info">
          <span class="labtest-date">${formatDateLV(t.date)}</span>
          <span class="labtest-type-badge ${LABTEST_TYPE_CLASS[t.type] || ""}">${LABTEST_TYPE_LABEL[t.type] || t.type}</span>
          ${izvertetsBadge}
        </div>
        <span class="labtest-name">${escapeHtml(t.name)}</span>
      </div>`;
    });
    html += `</div>`;
  }

  if (isAthleteView) {
    html += `<button class="secondary-action panel-add-btn" id="addLabTestBtn" type="button">Pievienot</button>`;
  }

  body.innerHTML = html;

  document.getElementById("addLabTestBtn")?.addEventListener("click", () => openLabTestDialog(null));

  body.querySelectorAll(".labtest-download-btn").forEach(a => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      const t = labTests.find(lt => lt.id === a.dataset.labtestId);
      if (!t) return;
      try {
        const { data, error } = await supabase
          .storage
          .from("lab-test-files")
          .createSignedUrl(t.file_path, 60);
        if (error) throw error;
        if (data?.signedUrl) {
          const link = document.createElement("a");
          link.href = data.signedUrl;
          link.download = t.file_name;
          link.click();
        }
      } catch (e) {
        alert("Neizdevās lejupielādēt: " + (e.message || e));
      }
    });
  });

  body.querySelectorAll(".labtest-delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const t = labTests.find(lt => lt.id === btn.dataset.labtestId);
      if (!t) return;
      if (!confirm(`Dzēst "${t.name}"?`)) return;
      try {
        await supabase.storage.from("lab-test-files").remove([t.file_path]);
        await deleteLabTest(t.id);
        labTests = await getLabTests(athleteId);
        renderLabTests();
      } catch (e) {
        alert("Neizdevās dzēst: " + (e.message || e));
      }
    });
  });

  body.querySelectorAll(".labtest-izvertets-cb input").forEach(cb => {
    cb.addEventListener("change", async () => {
      const testId = cb.dataset.labtestId;
      const checked = cb.checked;
      try {
        await updateLabTest(testId, { izvertets: checked });
        const t = labTests.find(lt => lt.id === testId);
        if (t) t.izvertets = checked;
      } catch (e) {
        cb.checked = !checked;
        alert("Neizdevās atjaunināt: " + (e.message || e));
      }
    });
  });

  const panel = document.getElementById("labTestsPanel");
  if (panel) {
    const header = panel.querySelector(".panel-header");
    if (isCoachView) {
      const unseen = labTests.filter(t => !isLabTestSeen(athleteId, t.id)).length;
      panel.classList.toggle("has-entries", unseen > 0);
      if (header) {
        header.dataset.count = unseen > 9 ? "9+" : String(unseen);
      }
    } else {
      const unseenIzv = labTests.filter(t => t.izvertets && !isIzvertetsSeen(athleteId, t.id)).length;
      panel.classList.toggle("has-entries", unseenIzv > 0);
      if (header) {
        header.dataset.count = unseenIzv > 9 ? "9+" : String(unseenIzv);
      }
    }
  }
}

function openLabTestDialog(existing) {
  const dlg = document.getElementById("labTestDialog");
  const athleteId = getSelectedAthleteId();
  const isAthleteView = (activeRole === "athlete") && currentUser.id === athleteId;

  const dateField = document.getElementById("labTestDate");
  const typeField = document.getElementById("labTestType");
  const nameField = document.getElementById("labTestName");
  const fileField = document.getElementById("labTestFile");
  const deleteBtn = document.getElementById("deleteLabTestBtn");
  const saveBtn = document.getElementById("saveLabTestBtn");
  const dlgTitle = dlg.querySelector("h2");

  if (existing) {
    editingLabTestId = existing.id;
    dlgTitle.textContent = "Rediģēt izmeklējumu";
    dateField.value = existing.date;
    typeField.value = existing.type;
    nameField.value = existing.name;
    fileField.value = "";
    fileField.required = false;
    deleteBtn.hidden = !isAthleteView;
    saveBtn.textContent = "Saglabāt izmaiņas";
    fileField.disabled = false;
  } else {
    editingLabTestId = null;
    dlgTitle.textContent = "Pievienot izmeklējumu";
    dateField.value = formatDateISO(new Date());
    typeField.value = "asins_aina";
    nameField.value = "";
    fileField.value = "";
    fileField.required = true;
    deleteBtn.hidden = true;
    saveBtn.textContent = "Saglabāt";
    fileField.disabled = false;
  }

  dateField.disabled = !isAthleteView;
  typeField.disabled = !isAthleteView;
  nameField.disabled = !isAthleteView;
  fileField.disabled = !isAthleteView;

  dlg.showModal();
}

async function saveLabTest() {
  const athleteId = getSelectedAthleteId();
  if (!athleteId) return;
  const date = document.getElementById("labTestDate").value;
  const type = document.getElementById("labTestType").value;
  const name = document.getElementById("labTestName").value.trim();
  const fileInput = document.getElementById("labTestFile");

  if (!date || !name) { alert("Aizpildiet datumu un nosaukumu!"); return; }

  if (editingLabTestId) {
    const existing = labTests.find(t => t.id === editingLabTestId);
    if (!existing) return;

    try {
      if (fileInput.files.length > 0) {
        await supabase.storage.from("lab-test-files").remove([existing.file_path]);
        const file = fileInput.files[0];
        const filePath = `${athleteId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("lab-test-files")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        await supabase
          .from("lab_tests")
          .update({
            date,
            type,
            name,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type,
          })
          .eq("id", editingLabTestId);
      } else {
        await supabase
          .from("lab_tests")
          .update({ date, type, name })
          .eq("id", editingLabTestId);
      }
    } catch (e) {
      alert("Neizdevās atjaunināt: " + (e.message || e));
      return;
    }
  } else {
    if (fileInput.files.length === 0) { alert("Izvēlieties failu!"); return; }
    const file = fileInput.files[0];
    const filePath = `${athleteId}/${Date.now()}-${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("lab-test-files")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      await insertLabTest({
        athlete_id: athleteId,
        date,
        type,
        name,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
      });
    } catch (e) {
      alert("Neizdevās saglabāt: " + (e.message || e));
      return;
    }
  }

  editingLabTestId = null;
  labTests = await getLabTests(athleteId);
  renderLabTests();
  document.getElementById("labTestDialog").close();
}

async function deleteLabTestFile() {
  if (!editingLabTestId) return;
  const existing = labTests.find(t => t.id === editingLabTestId);
  if (!existing) return;
  if (!confirm(`Dzēst "${existing.name}"?`)) return;

  try {
    await supabase.storage.from("lab-test-files").remove([existing.file_path]);
    await deleteLabTest(editingLabTestId);
    editingLabTestId = null;
    labTests = await getLabTests(getSelectedAthleteId());
    renderLabTests();
    document.getElementById("labTestDialog").close();
  } catch (e) {
    alert("Neizdevās dzēst: " + (e.message || e));
  }
}
