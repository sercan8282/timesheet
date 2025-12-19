let timesheets = [];
let timesheetCounter = 0;
let deleteConfirmationData = { index: null, timesheet: null };
let selectedCompanyId = null; // Track selected company for multi-company users

function renderDashboard() {
  return `
        <div class="container mt-4">
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-calendar-week"></i> <span data-i18n="ui:dashboard.timesheet_entry">Timesheet Entry</span></h5>
                            <div id="companySelector" style="display: none;">
                                <select class="form-select form-select-sm" id="selectedCompanyDropdown" onchange="handleCompanyChange()" style="max-width: 250px;">
                                    <option value=""><span data-i18n="ui:dashboard.select_company">Select company...</span></option>
                                </select>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="timesheetAlert"></div>
                            <div id="timesheetRows"></div>
                              <button type="button" class="btn btn-success mb-3 w-100 w-sm-auto" onclick="addTimesheetRow()">
                              <i class="bi bi-plus-circle"></i> <span data-i18n="ui:add_row">Add Row</span>
                            </button>
                            <hr>
                              <div class="d-grid gap-2 d-sm-flex flex-sm-wrap">
                                  <button type="button" class="btn btn-primary btn-mobile-full" onclick="saveTimesheets()">
                                  <i class="bi bi-save"></i> <span data-i18n="ui:save_all">Save All</span>
                                </button>
                                  <button type="button" class="btn btn-info btn-mobile-full" onclick="submitTimesheetsOnly()">
                                  <i class="bi bi-check-circle"></i> <span data-i18n="ui:submit">Submit</span>
                                </button>
                                  <button type="button" class="btn btn-danger btn-mobile-full" onclick="previewPDF()">
                                  <i class="bi bi-file-pdf"></i> <span data-i18n="ui:preview_pdf">Preview PDF</span>
                                </button>
                                  <button type="button" class="btn btn-success btn-mobile-full" onclick="previewXLSX()">
                                  <i class="bi bi-file-earmark-excel"></i> <span data-i18n="ui:preview_excel">Preview Excel</span>
                                </button>
                                  <button type="button" class="btn btn-primary btn-mobile-full" onclick="submitTimesheets()">
                                  <i class="bi bi-send"></i> <span data-i18n="ui:submit_send_email">Submit & Send Email</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div class="modal fade" id="deleteConfirmationModal" tabindex="-1" aria-labelledby="deleteConfirmationLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="deleteConfirmationLabel">
                            <i class="bi bi-exclamation-triangle text-warning"></i> <span data-i18n="ui:confirm_delete">Confirm Delete</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p data-i18n="ui:delete_timesheet_confirm">Are you sure you want to delete this timesheet entry?</p>
                        <p class="text-muted small" data-i18n="ui:this_action_cannot_be_undone">This action cannot be undone.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><span data-i18n="ui:cancel">Cancel</span></button>
                        <button type="button" class="btn btn-danger" onclick="confirmDelete()"><span data-i18n="ui:delete_entry">Delete Entry</span></button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initDashboard() {
  timesheets = [];
  timesheetCounter = 0;

  // Initialize company selector for multi-company users
  const userCompanies = window.currentUser?.userCompanies || [];
  if (userCompanies.length > 1) {
    const selector = document.getElementById("companySelector");
    const dropdown = document.getElementById("selectedCompanyDropdown");

    if (selector && dropdown) {
      selector.style.display = "block";

      // Load saved company selection from localStorage
      const savedCompanyId = localStorage.getItem("selectedCompanyId");

      // Populate dropdown
      dropdown.innerHTML =
        `<option value="">${t("ui", "dashboard.select_company")}</option>` +
        userCompanies
          .map(
            (c) =>
              `<option value="${c.id}" ${
                savedCompanyId == c.id || c.is_primary ? "selected" : ""
              }>${c.name} (${c.pause_time})</option>`
          )
          .join("");

      // Set initial selected company
      selectedCompanyId =
        savedCompanyId ||
        userCompanies.find((c) => c.is_primary)?.id ||
        userCompanies[0]?.id ||
        null;

      if (selectedCompanyId) {
        dropdown.value = selectedCompanyId;
      }
    }
  }

  await loadExistingTimesheets();
  if (timesheets.length === 0) {
    addTimesheetRow();
  }
}

function handleCompanyChange() {
  const dropdown = document.getElementById("selectedCompanyDropdown");
  selectedCompanyId = dropdown.value ? parseInt(dropdown.value) : null;

  if (selectedCompanyId) {
    localStorage.setItem("selectedCompanyId", selectedCompanyId);
    console.log("[DEBUG] Selected company changed to:", selectedCompanyId);
  }
}

async function loadExistingTimesheets() {
  try {
    const data = await api.getTimesheets();
    // Load only unsaved timesheets or add empty row
    if (data.length === 0) {
      addTimesheetRow();
    } else {
      // Show recent timesheets for editing
      data.slice(0, 5).forEach((ts) => {
        timesheets.push({
          id: ts.id,
          ritnumber: ts.ritnumber || "",
          date: ts.date,
          startTime: ts.start_time,
          endTime: ts.end_time,
          startKm: ts.start_km,
          endKm: ts.end_km,
          pauseTime: ts.pause_time,
          saved: true,
        });
      });
      renderTimesheetRows();
    }
  } catch (error) {
    console.error("Error loading timesheets:", error);
    addTimesheetRow();
  }
}

function addTimesheetRow() {
  const today = new Date().toISOString().split("T")[0];

  // Get pause time based on selected company
  let pauseDefault = "00:30"; // Default fallback

  // If user has multiple companies and one is selected
  if (selectedCompanyId && window.currentUser?.userCompanies) {
    const selectedCompany = window.currentUser.userCompanies.find(
      (c) => c.id === selectedCompanyId
    );
    if (selectedCompany?.pause_time) {
      pauseDefault = selectedCompany.pause_time;
    }
  } else if (window.currentUser?.company_pause_time) {
    // Fallback to primary company
    pauseDefault = window.currentUser.company_pause_time;
  } else if (window.currentUser?.companyPauseTime) {
    pauseDefault = window.currentUser.companyPauseTime;
  } else {
    // Fallback based on company name
    const userCompany =
      window.currentUser?.company_name || window.currentUser?.companyName || "";
    if (userCompany.toLowerCase() === "dachser") {
      pauseDefault = "01:00";
    } else if (userCompany.toLowerCase() === "mainfreight") {
      pauseDefault = "00:45";
    }
  }

  console.log("[DEBUG addTimesheetRow]", {
    selectedCompanyId,
    currentUser: window.currentUser,
    pauseDefault,
  });

  timesheets.push({
    id: null,
    tempId: ++timesheetCounter,
    ritnumber: "",
    date: today,
    startTime: "09:00",
    endTime: "17:00",
    startKm: 0,
    endKm: 0,
    pauseTime: pauseDefault,
    saved: false,
  });
  renderTimesheetRows();
}

function removeTimesheetRow(index) {
  const timesheet = timesheets[index];
  if (!timesheet.id) {
    // If not saved to database, just remove from array
    timesheets.splice(index, 1);
    renderTimesheetRows();
  } else {
    // Show modal confirmation for saved timesheets
    deleteConfirmationData = { index: index, timesheet: timesheet };
    const modal = new bootstrap.Modal(
      document.getElementById("deleteConfirmationModal")
    );
    modal.show();
  }
}

function confirmDelete() {
  const { index, timesheet } = deleteConfirmationData;
  if (timesheet && timesheet.id) {
    api
      .deleteTimesheet(timesheet.id)
      .then(() => {
        timesheets.splice(index, 1);
        renderTimesheetRows();
        showAlert("Timesheet deleted", "success");

        // Close modal
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("deleteConfirmationModal")
        );
        if (modal) modal.hide();
      })
      .catch((err) => {
        showAlert(err.message, "danger");
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("deleteConfirmationModal")
        );
        if (modal) modal.hide();
      });
  }
  deleteConfirmationData = { index: null, timesheet: null };
}

function renderTimesheetRows() {
  const container = document.getElementById("timesheetRows");
  const user = JSON.parse(localStorage.getItem("user"));

  container.innerHTML = timesheets
    .map((ts, index) => {
      const weekNumber = getWeekNumber(new Date(ts.date));
      const totalHours = calculateHours(ts.startTime, ts.endTime, ts.pauseTime);
      const totalKm = (ts.endKm - ts.startKm).toFixed(2);

      return `
              <div class="timesheet-row card mb-3">
                  <div class="card-body p-2">
                    <!-- Row 1: Week & Ritnumber -->
                    <div class="row g-2 mb-2">
                      <div class="col-6 col-md-3">
                        <label class="form-label small mb-1">${t("field", "week")}</label>
                        <input type="text" class="form-control form-control-sm" value="${weekNumber}" readonly>
                      </div>
                      <div class="col-6 col-md-3">
                        <label class="form-label small mb-1">${t("field", "ritnumber")}</label>
                        <input type="text" class="form-control form-control-sm" value="${ts.ritnumber || ""}" onchange="updateTimesheet(${index}, 'ritnumber', this.value)">
                      </div>
                    </div>
                    
                    <!-- Row 2: Name (full width) -->
                    <div class="row g-2 mb-2">
                      <div class="col-12">
                        <label class="form-label small mb-1">${t("field", "name")}</label>
                        <input type="text" class="form-control form-control-sm" value="${user.fullName}" readonly>
                      </div>
                    </div>
                    
                    <!-- Row 3: Date (full width) -->
                    <div class="row g-2 mb-2">
                      <div class="col-12">
                        <label class="form-label small mb-1">${t("field", "date")}</label>
                        <input type="date" class="form-control form-control-sm" value="${ts.date}" onchange="updateTimesheet(${index}, 'date', this.value)">
                      </div>
                    </div>
                    
                    <!-- Row 4: Start & End time -->
                    <div class="row g-2 mb-2">
                      <div class="col-6">
                        <label class="form-label small mb-1">${t("field", "start")}</label>
                        <input type="time" class="form-control form-control-sm" value="${ts.startTime}" onchange="updateTimesheet(${index}, 'startTime', this.value)">
                      </div>
                      <div class="col-6">
                        <label class="form-label small mb-1">${t("field", "end")}</label>
                        <input type="time" class="form-control form-control-sm" value="${ts.endTime}" onchange="updateTimesheet(${index}, 'endTime', this.value)">
                      </div>
                    </div>
                    
                    <!-- Row 5: Start KM & End KM -->
                    <div class="row g-2 mb-2">
                      <div class="col-6">
                        <label class="form-label small mb-1">${t("field", "start_km")}</label>
                        <input type="number" class="form-control form-control-sm" value="${ts.startKm}" step="0.1" onchange="updateTimesheet(${index}, 'startKm', parseFloat(this.value))">
                      </div>
                      <div class="col-6">
                        <label class="form-label small mb-1">${t("field", "end_km")}</label>
                        <input type="number" class="form-control form-control-sm" value="${ts.endKm}" step="0.1" onchange="updateTimesheet(${index}, 'endKm', parseFloat(this.value))">
                      </div>
                    </div>
                    
                    <!-- Row 6: Pause, Hours & KM -->
                    <div class="row g-2 mb-2">
                      <div class="col-6 col-md-4">
                        <label class="form-label small mb-1">${t("field", "pause")}</label>
                        <input type="time" class="form-control form-control-sm" value="${ts.pauseTime}" onchange="updateTimesheet(${index}, 'pauseTime', this.value)">
                      </div>
                      <div class="col-6 col-md-4">
                        <label class="form-label small mb-1">${t("field", "hours")}</label>
                        <input type="text" class="form-control form-control-sm" value="${totalHours}" readonly>
                      </div>
                      <div class="col-6 col-md-4">
                        <label class="form-label small mb-1">${t("field", "km")}</label>
                        <input type="text" class="form-control form-control-sm" value="${totalKm}" readonly>
                      </div>
                    </div>
                    
                    <!-- Row 7: Delete button -->
                    <div class="row g-2">
                      <div class="col-12">
                        <button class="btn btn-sm btn-danger w-100" onclick="removeTimesheetRow(${index})">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
              </div>
        `;
    })
    .join("");
}

function updateTimesheet(index, field, value) {
  timesheets[index][field] = value;
  timesheets[index].saved = false;
  renderTimesheetRows();
}

async function saveTimesheets() {
  const alertDiv = document.getElementById("timesheetAlert");

  try {
    for (let ts of timesheets) {
      if (!ts.saved) {
        const data = {
          date: ts.date,
          startTime: ts.startTime,
          endTime: ts.endTime,
          startKm: parseFloat(ts.startKm),
          endKm: parseFloat(ts.endKm),
          pauseTime: ts.pauseTime,
          ritnumber: ts.ritnumber || "",
          companyId: selectedCompanyId || null,
        };

        if (ts.id) {
          await api.updateTimesheet(ts.id, data);
        } else {
          const result = await api.createTimesheet(data);
          ts.id = result.id;
        }
        ts.saved = true;
      }
    }

    showAlert("All timesheets saved successfully!", "success");
  } catch (error) {
    showAlert(error.message, "danger");
  }
}

async function submitTimesheets() {
  // Save first
  await saveTimesheets();

  const timesheetIds = timesheets.filter((ts) => ts.id).map((ts) => ts.id);

  if (timesheetIds.length === 0) {
    showAlert("No timesheets to submit", "warning");
    return;
  }

  // Show modal with two options
  const modalHtml = `
    <div class="modal fade" id="submitOptionsModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Submit Timesheets</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>How would you like to submit ${timesheetIds.length} timesheet(s)?</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitTimesheetsOnly()" data-bs-dismiss="modal">
              <i class="bi bi-check-circle"></i> Submit Only
            </button>
            <button type="button" class="btn btn-success" onclick="submitTimesheetsWithEmail()" data-bs-dismiss="modal">
              <i class="bi bi-envelope"></i> Submit & Email
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if any
  const existingModal = document.getElementById("submitOptionsModal");
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to body
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Show modal
  const modal = new bootstrap.Modal(
    document.getElementById("submitOptionsModal")
  );
  modal.show();
}

async function submitTimesheetsOnly() {
  // Save first
  await saveTimesheets();
  await performSubmit(false);
}

async function submitTimesheetsWithEmail() {
  // Save first
  await saveTimesheets();
  await performSubmit(true);
}

async function performSubmit(sendEmail = false) {
  const timesheetIds = timesheets.filter((ts) => ts.id).map((ts) => ts.id);

  try {
    const response = await api.submitTimesheets(timesheetIds, sendEmail);

    // Clear all timesheets from the display and start fresh
    timesheets = [];
    timesheetCounter = 0;
    addTimesheetRow(); // Add one empty row for new entries - also calls renderTimesheetRows()

    // Show success message with overtime info
    let message = sendEmail
      ? "Timesheets submitted and sent successfully!"
      : "Timesheets submitted successfully!";

    if (response.overtimeAdded && parseFloat(response.overtimeAdded) > 0) {
      message += ` (+${response.overtimeAdded} overuren toegevoegd aan saldo)`;
    }
    showAlert(message, "success");

    // Clear alert after 5 seconds
    setTimeout(() => {
      const alertDiv = document.getElementById("timesheetAlert");
      if (alertDiv) {
        alertDiv.innerHTML = "";
      }
    }, 5000);
  } catch (error) {
    showAlert(error.message, "danger");
  }
}

async function previewPDF() {
  await saveTimesheets();

  const timesheetIds = timesheets.filter((ts) => ts.id).map((ts) => ts.id);

  if (timesheetIds.length === 0) {
    showAlert("No timesheets to preview", "warning");
    return;
  }

  try {
    const blob = await api.previewPDF(timesheetIds);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (error) {
    showAlert(error.message, "danger");
  }
}

async function previewXLSX() {
  await saveTimesheets();

  const timesheetIds = timesheets.filter((ts) => ts.id).map((ts) => ts.id);

  if (timesheetIds.length === 0) {
    showAlert("No timesheets to preview", "warning");
    return;
  }

  try {
    const blob = await api.previewXLSX(timesheetIds);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet_preview_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAlert("Excel file downloaded successfully!", "success");
  } catch (error) {
    showAlert(error.message, "danger");
  }
}

function showAlert(message, type) {
  const alertDiv = document.getElementById("timesheetAlert");
  alertDiv.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

  setTimeout(() => {
    alertDiv.innerHTML = "";
  }, 5000);
}

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function calculateHours(startTime, endTime, pauseTime) {
  if (!startTime || !endTime || !pauseTime) {
    return "0.00";
  }

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const [pauseH, pauseM] = pauseTime.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const pauseMinutes = pauseH * 60 + pauseM;

  const totalMinutes = endMinutes - startMinutes - pauseMinutes;
  return (totalMinutes / 60).toFixed(2);
}
