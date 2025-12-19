function renderHistory() {
  return `
        <div class="container mt-4">
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-clock-history"></i> <span data-i18n="ui:history.title">Submission History</span></h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="companyFilter" class="form-label" data-i18n="ui:history.filter_company">Filter by Company:</label>
                                <select class="form-select" id="companyFilter" onchange="filterHistoryByCompany()">
                                    <option value="" data-i18n="ui:history.all_companies">All Companies</option>
                                </select>
                            </div>
                            <div id="historyContent">
                                <div class="text-center">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden" data-i18n="ui:loading">Loading...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Global state for history filtering
let historyData = {
  allSubmissions: [],
  filteredSubmissions: [],
  selectedCompanyFilter: "",
  currentImportTimesheets: [],
};

function filterHistoryByCompany() {
  const filterSelect = document.getElementById("companyFilter");
  historyData.selectedCompanyFilter = filterSelect.value;

  if (historyData.selectedCompanyFilter === "") {
    historyData.filteredSubmissions = historyData.allSubmissions;
  } else {
    historyData.filteredSubmissions = historyData.allSubmissions.filter(
      (sub) => {
        // Check if any timesheet in this submission has the selected company
        return (
          sub.timesheetDetails &&
          sub.timesheetDetails.some(
            (ts) =>
              (ts.company_id || null) ===
              (historyData.selectedCompanyFilter
                ? parseInt(historyData.selectedCompanyFilter)
                : null)
          )
        );
      }
    );
  }

  renderSubmissions(historyData.filteredSubmissions);
}

async function initHistory() {
  try {
    const submissions = await api.getSubmissions();

    // Store all submissions for filtering
    historyData.allSubmissions = submissions;
    historyData.filteredSubmissions = submissions;

    // Populate company filter
    const companies = new Set();
    for (const sub of submissions) {
      if (sub.timesheetDetails) {
        sub.timesheetDetails.forEach((ts) => {
          if (ts.company_id && ts.company_name) {
            companies.add(`${ts.company_id}|${ts.company_name}`);
          }
        });
      }
    }

    const filterSelect = document.getElementById("companyFilter");
    if (filterSelect) {
      Array.from(companies)
        .sort()
        .forEach((company) => {
          const [id, name] = company.split("|");
          const option = document.createElement("option");
          option.value = id;
          option.textContent = name;
          filterSelect.appendChild(option);
        });
    }

    await renderSubmissions(submissions);
  } catch (error) {
    document.getElementById("historyContent").innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> ${error.message}
            </div>
        `;
  }
}

function getWeekDateRange(weekNumber, year) {
  // ISO 8601 week date calculation
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

  const weekEnd = new Date(ISOweekStart);
  weekEnd.setDate(ISOweekStart.getDate() + 6);

  return {
    start: ISOweekStart,
    end: weekEnd,
  };
}

async function renderSubmissions(submissions) {
  const container = document.getElementById("historyContent");

  // Debug: log what backend returns to diagnose missing names
  console.log("Submissions payload:", submissions);

  if (submissions.length === 0) {
    container.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> No submissions yet
            </div>
        `;
    return;
  }

  // Build HTML with collapsible submissions
  let html = '<div class="accordion" id="submissionsAccordion">';

  for (const sub of submissions) {
    if (!sub.timesheet_ids) {
      console.warn("Submission has no timesheet_ids:", sub.id);
      continue;
    }

    const timesheetIds = sub.timesheet_ids.split(",").map((id) => parseInt(id));
    const submissionDate = new Date(sub.submission_date);
    const statusBadgeClass =
      sub.status === "sent"
        ? "bg-success"
        : sub.status === "failed"
        ? "bg-danger"
        : "bg-warning";

    // Fetch timesheet details to get week numbers and dates
    let submissionTitle = `Loading...`;
    let weekInfo = "";
    const userName = sub.user_name || "Unknown";
    let timesheetDetails = [];

    try {
      timesheetDetails = await api.getTimesheetDetails(timesheetIds);
      // Store for later filtering
      sub.timesheetDetails = timesheetDetails;

      if (timesheetDetails && timesheetDetails.length > 0) {
        const weekNumbers = [
          ...new Set(timesheetDetails.map((ts) => ts.week_number)),
        ];
        const year = new Date(timesheetDetails[0].date).getFullYear();

        if (weekNumbers.length === 1) {
          const weekNum = weekNumbers[0];
          const dateRange = getWeekDateRange(weekNum, year);
          const startStr = dateRange.start.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const endStr = dateRange.end.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          submissionTitle = `Week ${weekNum} (${startStr} - ${endStr})`;
          weekInfo = `Week ${weekNum}`;
        } else {
          const sortedWeeks = weekNumbers.sort((a, b) => a - b);
          const dateRange = timesheetDetails.reduce((acc, ts) => {
            const date = new Date(ts.date);
            if (!acc.min || date < acc.min) acc.min = date;
            if (!acc.max || date > acc.max) acc.max = date;
            return acc;
          }, {});
          const startStr = dateRange.min.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const endStr = dateRange.max.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          submissionTitle = `Week ${sortedWeeks.join(
            ", "
          )} (${startStr} - ${endStr})`;
          weekInfo = `Weeks ${sortedWeeks.join(", ")}`;
        }
      } else {
        // If no timesheet details, show basic info
        submissionTitle = `Submission (${timesheetIds.length} entries)`;
      }
    } catch (error) {
      console.error("Error fetching timesheet details:", error);
      // Fallback title on error
      submissionTitle = `Submission (${timesheetIds.length} entries)`;
    }

    html += `
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                            data-bs-target="#submission${
                              sub.id
                            }" aria-expanded="false" 
                            aria-controls="submission${sub.id}">
                        <div class="w-100">
                            <div class="d-flex justify-content-between align-items-center w-100">
                                <div>
                                    <strong><i class="bi bi-file-earmark"></i> ${submissionTitle}</strong>
                                    <small class="text-muted ms-2">${submissionDate.toLocaleString()}</small>
                                </div>
                                <div class="text-end">
                                    <small class="text-muted d-block mb-1">Submitted by: <span class="badge bg-secondary">${userName}</span></small>
                                    <span class="badge ${statusBadgeClass} me-2">${
      sub.status
    }</span>
                                    <small class="text-muted">${
                                      timesheetIds.length
                                    } entries</small>
                                </div>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="submission${
                  sub.id
                }" class="accordion-collapse collapse" 
                     data-bs-parent="#submissionsAccordion">
                    <div class="accordion-body">
                        <div id="timesheet-rows-${sub.id}">
                            ${renderSubmissionTimesheets(
                              timesheetDetails,
                              sub.id
                            )}
                        </div>
                        <div class="mt-3">
                            <button class="btn btn-sm btn-danger" onclick="viewSubmissionPDF(${
                              sub.id
                            })">
                                <i class="bi bi-file-pdf"></i> <span data-i18n="ui:pdf">PDF</span>
                            </button>
                            <button class="btn btn-sm btn-success" onclick="downloadSubmissionXLSX(${
                              sub.id
                            })">
                                <i class="bi bi-file-earmark-excel"></i> <span data-i18n="ui:excel">Excel</span>
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="resendSubmissionEmail(${
                              sub.id
                            })">
                                <i class="bi bi-envelope"></i> <span data-i18n="ui:send_email">Send Email</span>
                            </button>
                            <button class="btn btn-sm btn-info" onclick="showImportModal(${
                              sub.id
                            })">
                                <i class="bi bi-download"></i> <span data-i18n="ui:import">Import</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  html += "</div>";
  container.innerHTML = html;
}

function renderSubmissionTimesheets(timesheets, submissionId) {
  if (!timesheets || timesheets.length === 0) {
    return '<p class="text-muted">No timesheet details available</p>';
  }

  return `
        <div class="timesheet-list">
            ${timesheets
              .map((ts, index) => {
                const totalHours = calculateHours(
                  ts.start_time,
                  ts.end_time,
                  ts.pause_time
                );
                const totalKm = (ts.end_km - ts.start_km).toFixed(2);
                const isEditing = window.editingTimesheetId === ts.id;

                return `
                    <div class="timesheet-row row g-1 mb-2 p-2 border rounded align-items-end" style="background-color: ${
                      isEditing ? "#f8f9fa" : "white"
                    }">
                        <div class="col-auto" style="width: 60px;">
                            <label class="form-label small mb-1">Week</label>
                            <input type="text" class="form-control form-control-sm" value="${
                              ts.week_number
                            }" readonly>
                        </div>
                        <div class="col-auto" style="width: 120px;">
                            <label class="form-label small mb-1">Company</label>
                            <input type="text" class="form-control form-control-sm" value="${
                              ts.company_name || "Unknown"
                            }" readonly>
                        </div>
                        <div class="col-auto" style="width: 90px;">
                            <label class="form-label small mb-1">Ritnumber</label>
                            <input type="text" class="form-control form-control-sm history-ritnumber-${
                              ts.id
                            }" value="${ts.ritnumber || ""}" 
                                   ${isEditing ? "" : "readonly"}>
                        </div>
                        <div class="col-auto" style="width: 130px;">
                            <label class="form-label small mb-1">Name</label>
                            <input type="text" class="form-control form-control-sm" value="${
                              ts.user_name || "Unknown"
                            }" readonly>
                        </div>
                        <div class="col-auto" style="width: 130px;">
                            <label class="form-label small mb-1">Date</label>
                            <input type="date" class="form-control form-control-sm history-date-${
                              ts.id
                            }" value="${ts.date}" 
                                   ${isEditing ? "" : "readonly"}>
                        </div>
                        <div class="col-auto" style="width: 85px;">
                            <label class="form-label small mb-1">Start</label>
                            <input type="time" class="form-control form-control-sm history-starttime-${
                              ts.id
                            }" value="${ts.start_time}" 
                                   ${isEditing ? "" : "readonly"}>
                        </div>
                        <div class="col-auto" style="width: 85px;">
                            <label class="form-label small mb-1">End</label>
                            <input type="time" class="form-control form-control-sm history-endtime-${
                              ts.id
                            }" value="${ts.end_time}" 
                                   ${isEditing ? "" : "readonly"}>
                        </div>
                        <div class="col-auto" style="width: 80px;">
                            <label class="form-label small mb-1">Start KM</label>
                            <input type="number" class="form-control form-control-sm history-startkm-${
                              ts.id
                            }" value="${ts.start_km}" step="0.1"
                                   ${isEditing ? "" : "readonly"}>
                        </div>
                        <div class="col-auto" style="width: 80px;">
                            <label class="form-label small mb-1">End KM</label>
                            <input type="number" class="form-control form-control-sm history-endkm-${
                              ts.id
                            }" value="${ts.end_km}" step="0.1"
                                   ${isEditing ? "" : "readonly"}>
                        </div>
                        <div class="col-auto" style="width: 85px;">
                            <label class="form-label small mb-1">Pause</label>
                            <input type="time" class="form-control form-control-sm history-pausetime-${
                              ts.id
                            }" value="${ts.pause_time}" 
                                   ${isEditing ? "" : "readonly"}>
                        </div>
                        <div class="col-auto" style="width: 70px;">
                            <label class="form-label small mb-1">Hours</label>
                            <input type="text" class="form-control form-control-sm" value="${totalHours}" readonly>
                        </div>
                        <div class="col-auto" style="width: 70px;">
                            <label class="form-label small mb-1">KM</label>
                            <input type="text" class="form-control form-control-sm" value="${totalKm}" readonly>
                        </div>
                        <div class="col-auto">
                            <div class="btn-group" role="group" style="margin-top: 2px;">
                                ${
                                  isEditing
                                    ? `
                                    <button class="btn btn-sm btn-success" onclick="saveHistoryEdit(${ts.id}, ${submissionId}); event.stopPropagation(); return false;" title="Save">
                                        <i class="bi bi-check"></i>
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="cancelHistoryEdit(${submissionId}); event.stopPropagation(); return false;" title="Cancel">
                                        <i class="bi bi-x"></i>
                                    </button>
                                `
                                    : `
                                    <button class="btn btn-sm btn-primary" onclick="startHistoryEdit(${ts.id}, ${submissionId}); event.stopPropagation(); return false;" title="Edit">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                `
                                }
                            </div>
                        </div>
                    </div>
                `;
              })
              .join("")}
        </div>
    `;
}

async function viewSubmissionPDF(submissionId) {
  try {
    const blob = await api.getSubmissionPDF(submissionId);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (error) {
    alert("Failed to load PDF: " + error.message);
  }
}

async function downloadSubmissionXLSX(submissionId) {
  try {
    const blob = await api.getSubmissionXLSX(submissionId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submission_${submissionId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    alert("Failed to download Excel: " + error.message);
  }
}

// Inline editing functions for history
window.editingTimesheetId = null;

function startHistoryEdit(timesheetId, submissionId) {
  window.editingTimesheetId = timesheetId;
  window.currentSubmissionId = submissionId;

  // Re-render just this submission's timesheets without closing accordion
  api.getSubmissions().then((submissions) => {
    const sub = submissions.find((s) => s.id === submissionId);
    if (sub && sub.timesheet_ids) {
      const timesheetIds = sub.timesheet_ids
        .split(",")
        .map((id) => parseInt(id));
      api.getTimesheetDetails(timesheetIds).then((timesheetDetails) => {
        const container = document.getElementById(
          `timesheet-rows-${submissionId}`
        );
        if (container) {
          container.innerHTML = renderSubmissionTimesheets(
            timesheetDetails,
            submissionId
          );
        }
      });
    }
  });
}

function cancelHistoryEdit(submissionId) {
  window.editingTimesheetId = null;

  // Re-render just this submission's timesheets without closing accordion
  api.getSubmissions().then((submissions) => {
    const sub = submissions.find((s) => s.id === submissionId);
    if (sub && sub.timesheet_ids) {
      const timesheetIds = sub.timesheet_ids
        .split(",")
        .map((id) => parseInt(id));
      api.getTimesheetDetails(timesheetIds).then((timesheetDetails) => {
        const container = document.getElementById(
          `timesheet-rows-${submissionId}`
        );
        if (container) {
          container.innerHTML = renderSubmissionTimesheets(
            timesheetDetails,
            submissionId
          );
        }
      });
    }
  });
}

async function saveHistoryEdit(timesheetId, submissionId) {
  try {
    const data = {
      date: document.querySelector(`.history-date-${timesheetId}`).value,
      startTime: document.querySelector(`.history-starttime-${timesheetId}`)
        .value,
      endTime: document.querySelector(`.history-endtime-${timesheetId}`).value,
      startKm: parseFloat(
        document.querySelector(`.history-startkm-${timesheetId}`).value
      ),
      endKm: parseFloat(
        document.querySelector(`.history-endkm-${timesheetId}`).value
      ),
      pauseTime: document.querySelector(`.history-pausetime-${timesheetId}`)
        .value,
      ritnumber: document.querySelector(`.history-ritnumber-${timesheetId}`)
        .value,
    };

    await api.updateTimesheet(timesheetId, data);
    window.editingTimesheetId = null;

    // Re-render just this submission's timesheets without closing accordion
    const submissions = await api.getSubmissions();
    const sub = submissions.find((s) => s.id === submissionId);
    if (sub && sub.timesheet_ids) {
      const timesheetIds = sub.timesheet_ids
        .split(",")
        .map((id) => parseInt(id));
      const timesheetDetails = await api.getTimesheetDetails(timesheetIds);
      const container = document.getElementById(
        `timesheet-rows-${submissionId}`
      );
      if (container) {
        container.innerHTML = renderSubmissionTimesheets(
          timesheetDetails,
          submissionId
        );

        // Show success message inline
        const successMsg = document.createElement("div");
        successMsg.className =
          "alert alert-success alert-dismissible fade show mt-2";
        successMsg.innerHTML = `
                    <i class="bi bi-check-circle"></i> Row updated successfully!
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
        container.insertBefore(successMsg, container.firstChild);

        setTimeout(() => {
          if (successMsg.parentNode) {
            successMsg.remove();
          }
        }, 3000);
      }
    }
  } catch (error) {
    alert("Error updating timesheet: " + error.message);
  }
}

async function resendSubmissionEmail(submissionId) {
  showConfirmModal(
    "Send Email",
    "Send this submission via email?",
    async () => {
      try {
        await api.resendSubmissionEmail(submissionId);
        showAlert("Email sent successfully!", "success");
        initHistory(); // Reload to update status
      } catch (error) {
        showAlert("Failed to send email: " + error.message, "danger");
      }
    }
  );
}

function showAlert(message, type) {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  // Find the history content container and prepend alert
  const container = document.getElementById("historyContent");
  if (container) {
    container.insertBefore(alertDiv, container.firstChild);
  }

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 5000);
}

// Import functionality
function showImportModal(submissionId) {
  try {
    // Find the submission to get its timesheets
    const submission = historyData.allSubmissions.find(
      (s) => s.id === submissionId
    );
    if (!submission || !submission.timesheetDetails) {
      alert("Timesheet details not found");
      return;
    }

    const timesheets = submission.timesheetDetails;
    historyData.currentImportTimesheets = timesheets;

    // Group timesheets by week number
    const weekGroups = {};
    timesheets.forEach((ts) => {
      if (!weekGroups[ts.week_number]) {
        weekGroups[ts.week_number] = [];
      }
      weekGroups[ts.week_number].push(ts);
    });

    // Create modal HTML
    const weeks = Object.keys(weekGroups).sort(
      (a, b) => parseInt(b) - parseInt(a)
    );

    let weekCheckboxesHtml = weeks
      .map((weekNum) => {
        const count = weekGroups[weekNum].length;
        return `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="week-${weekNum}" value="${weekNum}" checked>
          <label class="form-check-label" for="week-${weekNum}">
            Week ${weekNum} (${count} entries)
          </label>
        </div>
      `;
      })
      .join("");

    const modalHtml = `
      <div class="modal fade" id="importModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Import Timesheets by Week</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p>Select which weeks you want to import:</p>
              <div id="weekCheckboxes">
                ${weekCheckboxesHtml}
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="performImport()">
                <i class="bi bi-download"></i> Import Selected
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("importModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById("importModal"));
    modal.show();
  } catch (error) {
    alert("Error showing import dialog: " + error.message);
    console.error("Import modal error:", error);
  }
}

async function performImport() {
  try {
    const timesheets = historyData.currentImportTimesheets;

    if (!timesheets || timesheets.length === 0) {
      alert("No timesheets to import");
      return;
    }

    // Get selected weeks
    const selectedWeeks = [];
    document
      .querySelectorAll('#weekCheckboxes input[type="checkbox"]:checked')
      .forEach((checkbox) => {
        selectedWeeks.push(parseInt(checkbox.value));
      });

    if (selectedWeeks.length === 0) {
      alert("Please select at least one week");
      return;
    }

    // Filter timesheets by selected weeks
    const timesheetsToImport = timesheets.filter((ts) =>
      selectedWeeks.includes(ts.week_number)
    );

    if (timesheetsToImport.length === 0) {
      alert("No timesheets found for selected weeks");
      return;
    }

    // Store import data in sessionStorage so dashboard can pick it up
    sessionStorage.setItem(
      "importedTimesheets",
      JSON.stringify(timesheetsToImport)
    );

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("importModal")
    );
    if (modal) modal.hide();

    // Show success message and navigate to dashboard
    showAlert(
      `${timesheetsToImport.length} timesheet(s) ready to import! Going to Dashboard...`,
      "success"
    );

    // Auto-navigate to dashboard after short delay
    setTimeout(() => {
      app.loadPage("dashboard");

      // Give dashboard time to render, then add the timesheets
      setTimeout(() => {
        const importedData = JSON.parse(
          sessionStorage.getItem("importedTimesheets")
        );
        if (importedData && window.timesheets) {
          importedData.forEach((importedTs) => {
            const newTimesheet = {
              id: null,
              tempId: ++timesheetCounter,
              ritnumber: importedTs.ritnumber || "",
              date: importedTs.date,
              startTime: importedTs.start_time,
              endTime: importedTs.end_time,
              startKm: importedTs.start_km,
              endKm: importedTs.end_km,
              pauseTime: importedTs.pause_time,
              saved: false,
              companyId: importedTs.company_id,
            };
            window.timesheets.push(newTimesheet);
          });

          renderTimesheetRows();
          showAlert(`${importedData.length} timesheet(s) imported!`, "success");
          sessionStorage.removeItem("importedTimesheets");
        }
      }, 500);
    }, 1500);
  } catch (error) {
    alert("Error importing timesheets: " + error.message);
    console.error("Import error:", error);
  }
}
