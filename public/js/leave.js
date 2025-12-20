let leaveRequests = [];
let leaveBalance = { vacation_hours: 0, overtime_hours: 0 };

function translate(namespace, key, fallback = `${namespace}:${key}`) {
  // Try to get from window.app.translations first
  if (window.app && window.app.translations) {
    const translationKey = `${namespace}:${key}`;
    const translation = window.app.translations[translationKey];
    if (
      translation !== undefined &&
      translation !== null &&
      translation !== key
    ) {
      return translation;
    }
  }
  // Return fallback if provided, otherwise return the key
  return fallback || key;
}

function getCurrentLocale() {
  const locale =
    (window.app && app.locale) ||
    localStorage.getItem("locale") ||
    navigator.language ||
    "en-US";

  if (locale.startsWith("nl")) return "nl-NL";
  if (locale.startsWith("de")) return "de-DE";
  return "en-US";
}

function renderLeave() {
  return `
    <div class="container mt-4">
      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0"><i class="bi bi-wallet2"></i> <span data-i18n="ui:leave.balance">Verlofsaldo</span></h5>
              <span class="badge bg-info" id="leaveBalanceUpdated">-</span>
            </div>
            <div class="card-body" id="leaveBalanceCard">
              <div class="text-center text-muted" data-i18n="ui:loading">Loading...</div>
            </div>
          </div>
        </div>
        <div class="col-lg-8">
          <div class="card mb-3">
            <div class="card-header"><h5 class="mb-0"><i class="bi bi-send"></i> <span data-i18n="ui:leave.request">Verlofaanvraag</span></h5></div>
            <div class="card-body">
              <div id="leaveFormAlert"></div>
              <div class="row g-2">
                <div class="col-md-3">
                  <label class="form-label" data-i18n="ui:leave.type">Type</label>
                  <select class="form-select" id="leaveType">
                    <option value="vacation" data-i18n="ui:leave.type_vacation">Verlof</option>
                    <option value="overtime" data-i18n="ui:leave.type_overtime">Overuren</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <label class="form-label" data-i18n="ui:leave.start_date">Vanaf datum</label>
                  <input type="date" class="form-control" id="leaveStart" onchange="calculateLeaveHours()" />
                </div>
                <div class="col-md-3">
                  <label class="form-label" data-i18n="ui:leave.end_date">Tot en met</label>
                  <input type="date" class="form-control" id="leaveEnd" onchange="calculateLeaveHours()" />
                </div>
                <div class="col-md-3">
                  <label class="form-label" data-i18n="ui:leave.hours_auto">Uren (auto)</label>
                  <input type="number" step="0.25" min="0.25" class="form-control" id="leaveHours" readonly />
                </div>
                <div class="col-md-3">
                  <label class="form-label" data-i18n="ui:leave.start_time">Vanaf tijd</label>
                  <input type="time" class="form-control" id="leaveStartTime" value="09:00" onchange="calculateLeaveHours()" />
                </div>
                <div class="col-md-3">
                  <label class="form-label" data-i18n="ui:leave.end_time">Tot tijd</label>
                  <input type="time" class="form-control" id="leaveEndTime" value="18:00" onchange="calculateLeaveHours()" />
                </div>
                <div class="col-md-6">
                  <label class="form-label" data-i18n="ui:leave.reason">Toelichting (optioneel)</label>
                  <textarea class="form-control" id="leaveReason" rows="1"></textarea>
                </div>
                <div class="col-12 d-flex justify-content-end">
                  <button class="btn btn-primary" onclick="submitLeaveRequestForm()">
                    <i class="bi bi-send"></i> <span data-i18n="ui:leave.submit_request">Aanvraag indienen</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h5 class="mb-0"><i class="bi bi-list-check"></i> <span data-i18n="ui:leave.my_requests">Mijn aanvragen</span></h5></div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th><span data-i18n="ui:leave.period">Periode</span></th>
                      <th><span data-i18n="ui:leave.hours">Uren</span></th>
                      <th><span data-i18n="ui:leave.type_col">Type</span></th>
                      <th><span data-i18n="ui:leave.status">Status</span></th>
                      <th><span data-i18n="ui:leave.note">Opmerking</span></th>
                      <th><span data-i18n="ui:actions">Acties</span></th>
                    </tr>
                  </thead>
                  <tbody id="leaveRequestsBody">
                    <tr><td colspan="6" class="text-center text-muted" data-i18n="ui:loading">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Verlofkalender Overzicht -->
      <div class="row mt-4">
        <div class="col-12">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0"><i class="bi bi-calendar3"></i> <span data-i18n="ui:leave.calendar_title">Verlofkalender - Team Overzicht</span></h5>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" onclick="shiftCalendar(-1)">
                  <i class="bi bi-chevron-left"></i> <span data-i18n="ui:leave.prev_month">Vorige maand</span>
                </button>
                <button class="btn btn-outline-secondary" onclick="shiftCalendar(0)">
                  <span data-i18n="ui:leave.today">Vandaag</span>
                </button>
                <button class="btn btn-outline-secondary" onclick="shiftCalendar(1)">
                  <span data-i18n="ui:leave.next_month">Volgende maand</span> <i class="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
            <div class="card-body p-0">
              <div id="leaveCalendar" style="overflow-x: auto; overflow-y: visible;">
                <div class="text-center p-4 text-muted" data-i18n="ui:leave.calendar_loading">Loading calendar...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function initLeave() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("leaveStart").value = today;
  document.getElementById("leaveEnd").value = today;
  await Promise.all([
    loadLeaveBalance(),
    loadLeaveRequests(),
    loadLeaveCalendar(),
  ]);
  calculateLeaveHours();
}

function calculateLeaveHours() {
  const startDate = document.getElementById("leaveStart").value;
  const endDate = document.getElementById("leaveEnd").value;
  const startTime = document.getElementById("leaveStartTime").value;
  const endTime = document.getElementById("leaveEndTime").value;

  if (!startDate || !endDate || !startTime || !endTime) {
    document.getElementById("leaveHours").value = "";
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    document.getElementById("leaveHours").value = "";
    return;
  }

  let totalHours = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const isFirstDay = current.getTime() === start.getTime();
      const isLastDay = current.getTime() === end.getTime();
      const isSingleDay = isFirstDay && isLastDay;

      if (isSingleDay) {
        // Single day - calculate hours between start and end time
        totalHours += calculateDailyHours(startTime, endTime);
      } else if (isFirstDay) {
        // First day - from start time to 18:00
        totalHours += calculateDailyHours(startTime, "18:00");
      } else if (isLastDay) {
        // Last day - from 09:00 to end time
        totalHours += calculateDailyHours("09:00", endTime);
      } else {
        // Full day in between
        totalHours += 8;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  document.getElementById("leaveHours").value = totalHours.toFixed(2);
}

function calculateDailyHours(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  let totalMinutes = endMinutes - startMinutes;

  if (totalMinutes <= 0) return 0;

  // Check if pause should be deducted (1 hour = 60 minutes)
  // Werkdag: 09:00-18:00 (9 uur totaal)
  // Pauze: 12:00-13:00 (1 uur)
  // Verlof hele dag: 9u - 1u pauze = 8u
  //
  // Pauze wordt alleen afgetrokken als:
  // - Start tijd is voor of op 12:00 EN eind tijd is na 13:00
  const lunchStart = 12 * 60; // 12:00 in minutes
  const lunchEnd = 13 * 60; // 13:00 in minutes

  if (startMinutes <= lunchStart && endMinutes > lunchEnd) {
    // Full lunch break applies
    totalMinutes -= 60;
  }

  return totalMinutes / 60;
}

async function loadLeaveBalance() {
  const card = document.getElementById("leaveBalanceCard");
  try {
    const balance = await api.getLeaveBalance();
    leaveBalance = balance;
    const hoursUnit = translate("ui", "leave.hours_unit", "uur");
    const vacationLabel = translate("ui", "leave.type_vacation", "Verlof");
    const overtimeLabel = translate("ui", "leave.type_overtime", "Overuren");
    const balanceHint = translate(
      "ui",
      "leave.balance_hint",
      "Beschikbaar voor aanvragen. Aanvragen worden direct verrekend."
    );
    const locale = getCurrentLocale();
    card.innerHTML = `
      <div class="mb-2 d-flex justify-content-between align-items-center">
        <span>${vacationLabel}</span>
        <span class="fw-bold text-primary" id="vacationHours">${
          balance.vacation_hours?.toFixed?.(2) ??
          Number(balance.vacation_hours || 0).toFixed(2)
        } ${hoursUnit}</span>
      </div>
      <div class="mb-2 d-flex justify-content-between align-items-center">
        <span>${overtimeLabel}</span>
        <span class="fw-bold text-success" id="overtimeHours">${
          balance.overtime_hours?.toFixed?.(2) ??
          Number(balance.overtime_hours || 0).toFixed(2)
        } ${hoursUnit}</span>
      </div>
      <small class="text-muted">${balanceHint}</small>
    `;
    document.getElementById("leaveBalanceUpdated").textContent =
      balance.updated_at
        ? new Date(balance.updated_at).toLocaleString(locale)
        : "-";
  } catch (error) {
    card.innerHTML = `<div class="alert alert-danger mb-0">${error.message}</div>`;
  }
}

async function loadLeaveRequests() {
  const tbody = document.getElementById("leaveRequestsBody");
  try {
    leaveRequests = await api.getLeaveRequests();
    const hoursUnit = translate("ui", "leave.hours_unit", "u");
    const noRequestsText = translate("ui", "leave.no_requests", "No requests");
    const toLabel = translate("ui", "leave.to", "to");
    const timeSeparator = translate("ui", "leave.time_separator", " - ");
    if (!leaveRequests.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted"><i class="bi bi-inbox"></i> ${noRequestsText}</td></tr>`;
      return;
    }

    tbody.innerHTML = leaveRequests
      .map((req) => {
        const vacationLabel = translate(
          "ui",
          "leave.type_vacation",
          "Vacation"
        );
        const overtimeLabel = translate(
          "ui",
          "leave.type_overtime",
          "Overtime"
        );
        const statusBadge =
          req.status === "approved"
            ? "badge bg-success"
            : req.status === "rejected"
            ? "badge bg-danger"
            : "badge bg-warning text-dark";
        const statusLabel =
          req.status === "approved"
            ? translate("ui", "leave.status_approved", "Approved")
            : req.status === "rejected"
            ? translate("ui", "leave.status_rejected", "Rejected")
            : translate("ui", "leave.status_pending", "Pending");
        const approver = req.approver_name ? ` (${req.approver_name})` : "";

        let dateTimeDisplay = `${req.start_date}`;
        if (req.start_date === req.end_date && req.start_time && req.end_time) {
          dateTimeDisplay += ` (${req.start_time}${timeSeparator}${req.end_time})`;
        } else if (req.start_date !== req.end_date) {
          dateTimeDisplay += ` ${toLabel} ${req.end_date}`;
          if (req.start_time && req.end_time) {
            dateTimeDisplay += ` (${req.start_time}${timeSeparator}${req.end_time})`;
          }
        }

        return `
          <tr>
            <td>${dateTimeDisplay}</td>
            <td>${Number(req.hours_requested).toFixed(2)} ${hoursUnit}</td>
            <td>${
              req.balance_type === "vacation" ? vacationLabel : overtimeLabel
            }</td>
            <td><span class="${statusBadge}">${statusLabel}${approver}</span></td>
            <td>${req.reason || req.admin_note || "-"}</td>
            <td>
              <button class="btn btn-sm btn-warning" onclick="editLeaveRequest(${
                req.id
              })" title="${translate("ui", "edit", "Edit")}">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteLeaveRequest(${
                req.id
              })" title="${translate("ui", "withdraw", "Withdraw")}">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${error.message}</td></tr>`;
  }
}

async function editLeaveRequest(id) {
  const req = leaveRequests.find((r) => r.id === id);
  if (!req) return;

  // Populate form with existing data
  document.getElementById("leaveType").value = req.balance_type;
  document.getElementById("leaveStart").value = req.start_date;
  document.getElementById("leaveEnd").value = req.end_date;
  document.getElementById("leaveStartTime").value = req.start_time || "09:00";
  document.getElementById("leaveEndTime").value = req.end_time || "18:00";
  document.getElementById("leaveReason").value = req.reason || "";
  calculateLeaveHours();

  // Change submit button to update mode
  const alertDiv = document.getElementById("leaveFormAlert");
  alertDiv.innerHTML = `<div class="alert alert-info">
    <strong>${translate("ui", "edit", "Edit")}:</strong> ${translate(
      "ui",
      "leave_edit_hint",
      'Adjust the data and click "Update"'
    )}
    <button class="btn btn-sm btn-secondary ms-2" onclick="cancelEdit()">${translate(
      "ui",
      "cancel",
      "Cancel"
    )}</button>
  </div>`;

  // Replace submit button
  const submitBtn = document.querySelector(
    'button[onclick="submitLeaveRequestForm()"]'
  );
  submitBtn.setAttribute("onclick", `updateLeaveRequest(${id})`);
  submitBtn.innerHTML = `<i class="bi bi-check-circle"></i> ${t(
    "ui",
    "update"
  )}`;

  // Scroll to form
  document.querySelector(".card-header").scrollIntoView({ behavior: "smooth" });
}

function cancelEdit() {
  document.getElementById("leaveFormAlert").innerHTML = "";
  document.getElementById("leaveReason").value = "";
  const submitBtn =
    document.querySelector('button[onclick^="updateLeaveRequest"]') ||
    document.querySelector('button[onclick="submitLeaveRequestForm()"]');
  submitBtn.setAttribute("onclick", "submitLeaveRequestForm()");
  submitBtn.innerHTML = `<i class="bi bi-send"></i> ${translate(
    "ui",
    "leave.submit_request",
    "Submit Request"
  )}`;
}

async function updateLeaveRequest(id) {
  const alertDiv = document.getElementById("leaveFormAlert");
  const balanceType = document.getElementById("leaveType").value;
  const startDate = document.getElementById("leaveStart").value;
  const endDate = document.getElementById("leaveEnd").value;
  const startTime = document.getElementById("leaveStartTime").value;
  const endTime = document.getElementById("leaveEndTime").value;
  const hours = parseFloat(document.getElementById("leaveHours").value);
  const reason = document.getElementById("leaveReason").value.trim();

  if (
    !startDate ||
    !endDate ||
    !startTime ||
    !endTime ||
    !hours ||
    hours <= 0
  ) {
    alertDiv.innerHTML = `<div class="alert alert-warning">${translate(
      "ui",
      "leave.validation_required",
      "Please fill all required fields and use a valid hours value."
    )}</div>`;
    return;
  }

  alertDiv.innerHTML = `<div class="alert alert-info">${translate(
    "ui",
    "leave.updating",
    "Updating request..."
  )}</div>`;

  try {
    const response = await api.updateLeaveRequest(id, {
      startDate,
      endDate,
      startTime,
      endTime,
      hours,
      balanceType,
      reason,
    });
    
    const successMessage = response.statusChanged 
      ? translate("ui", "leave.updated_pending", "Request updated and reset to pending approval.")
      : translate("ui", "leave.updated_success", "Request updated and balance adjusted.");
    
    alertDiv.innerHTML = `<div class="alert alert-success">${successMessage}</div>`;
    cancelEdit();
    await Promise.all([
      loadLeaveBalance(),
      loadLeaveRequests(),
      loadLeaveCalendar(),
    ]);
  } catch (error) {
    alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

async function deleteLeaveRequest(id) {
  if (
    !confirm(
      translate(
        "ui",
        "leave.withdraw_confirm",
        "Are you sure you want to withdraw this leave request? The hours will be refunded."
      )
    )
  ) {
    return;
  }

  try {
    await api.deleteLeaveRequest(id);
    await Promise.all([
      loadLeaveBalance(),
      loadLeaveRequests(),
      loadLeaveCalendar(),
    ]);
  } catch (error) {
    const withdrawError = translate(
      "ui",
      "leave.withdraw_error",
      "Error while withdrawing"
    );
    alert(`${withdrawError}: ${error.message}`);
  }
}

async function submitLeaveRequestForm() {
  const alertDiv = document.getElementById("leaveFormAlert");
  const balanceType = document.getElementById("leaveType").value;
  const startDate = document.getElementById("leaveStart").value;
  const endDate = document.getElementById("leaveEnd").value;
  const startTime = document.getElementById("leaveStartTime").value;
  const endTime = document.getElementById("leaveEndTime").value;
  const hours = parseFloat(document.getElementById("leaveHours").value);
  const reason = document.getElementById("leaveReason").value.trim();

  if (
    !startDate ||
    !endDate ||
    !startTime ||
    !endTime ||
    !hours ||
    hours <= 0
  ) {
    alertDiv.innerHTML = `<div class="alert alert-warning">${translate(
      "ui",
      "leave.validation_required",
      "Please fill all required fields and use a valid hours value."
    )}</div>`;
    return;
  }

  alertDiv.innerHTML = `<div class="alert alert-info">${translate(
    "ui",
    "leave.submitting",
    "Submitting request..."
  )}</div>`;

  try {
    await api.submitLeaveRequest({
      startDate,
      endDate,
      startTime,
      endTime,
      hours,
      balanceType,
      reason,
    });
    alertDiv.innerHTML = `<div class="alert alert-success">${translate(
      "ui",
      "leave.submitted",
      "Request submitted and balance updated."
    )}</div>`;
    document.getElementById("leaveReason").value = "";
    await Promise.all([
      loadLeaveBalance(),
      loadLeaveRequests(),
      loadLeaveCalendar(),
    ]);
  } catch (error) {
    alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

// Calendar state
let calendarViewDate = new Date();

async function loadLeaveCalendar() {
  const container = document.getElementById("leaveCalendar");
  try {
    // Fetch all approved leave requests from all users
    const allRequests = await api.getLeaveRequestsCalendar();
    renderLeaveCalendar(allRequests);
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger m-3">${error.message}</div>`;
  }
}

function shiftCalendar(months) {
  if (months === 0) {
    calendarViewDate = new Date();
  } else {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + months);
  }
  loadLeaveCalendar();
}

function renderLeaveCalendar(requests) {
  const container = document.getElementById("leaveCalendar");
  const locale = getCurrentLocale();
  const hoursUnit = translate("ui", "leave.hours_unit", "u");
  const employeeHeader = translate("ui", "leave.employee", "Employee");
  const calendarEmpty = translate(
    "ui",
    "leave.calendar_empty",
    "No approved leave requests found"
  );

  // Calculate date range: 3 months from view date
  const startDate = new Date(calendarViewDate);
  startDate.setDate(1); // First day of current month
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 3);

  // Generate days array
  const days = [];
  const currentDate = new Date(startDate);
  while (currentDate < endDate) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Group requests by user
  const userRequests = {};
  requests.forEach((req) => {
    if (req.status === "approved") {
      if (!userRequests[req.user_id]) {
        userRequests[req.user_id] = {
          name: req.full_name || req.username,
          requests: [],
        };
      }
      userRequests[req.user_id].requests.push(req);
    }
  });

  const users = Object.values(userRequests);

  if (users.length === 0) {
    container.innerHTML = `<div class="text-center p-4 text-muted">${calendarEmpty}</div>`;
    return;
  }

  // Calculate cell width (minimum 30px per day)
  const cellWidth = 35;
  const nameColumnWidth = 180;
  const totalWidth = nameColumnWidth + days.length * cellWidth;

  let html = `<div style="min-width: ${totalWidth}px;">`;

  // Header with dates
  html += `<div style="display: flex; border-bottom: 2px solid #dee2e6; background: #f8f9fa; position: sticky; top: 0; z-index: 10;">`;
  html += `<div style="width: ${nameColumnWidth}px; padding: 10px; font-weight: bold; border-right: 2px solid #dee2e6; background: #f8f9fa;">${employeeHeader}</div>`;

  let currentMonth = null;
  let monthStartCol = 0;
  const monthHeaders = [];

  days.forEach((day, index) => {
    const monthYear = day.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
    if (monthYear !== currentMonth) {
      if (currentMonth !== null) {
        monthHeaders.push({
          month: currentMonth,
          start: monthStartCol,
          end: index - 1,
        });
      }
      currentMonth = monthYear;
      monthStartCol = index;
    }
  });
  monthHeaders.push({
    month: currentMonth,
    start: monthStartCol,
    end: days.length - 1,
  });

  html += `</div>`;

  // Month headers
  html += `<div style="display: flex; border-bottom: 1px solid #dee2e6; background: #e9ecef;">`;
  html += `<div style="width: ${nameColumnWidth}px; border-right: 2px solid #dee2e6;"></div>`;
  monthHeaders.forEach((mh) => {
    const width = (mh.end - mh.start + 1) * cellWidth;
    html += `<div style="width: ${width}px; text-align: center; font-weight: 600; padding: 5px; border-right: 1px solid #dee2e6; font-size: 0.85rem;">${mh.month}</div>`;
  });
  html += `</div>`;

  // Day headers
  html += `<div style="display: flex; border-bottom: 2px solid #dee2e6; background: #f8f9fa;">`;
  html += `<div style="width: ${nameColumnWidth}px; border-right: 2px solid #dee2e6;"></div>`;
  days.forEach((day, index) => {
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isToday = day.toDateString() === new Date().toDateString();
    const bgColor = isToday ? "#fff3cd" : isWeekend ? "#f8f9fa" : "#ffffff";
    const dayNum = day.getDate();
    const dayName = day.toLocaleDateString(locale, { weekday: "short" });

    html += `<div style="width: ${cellWidth}px; text-align: center; font-size: 0.7rem; padding: 4px 2px; border-right: 1px solid #e9ecef; background: ${bgColor}; ${
      isWeekend ? "color: #6c757d;" : ""
    }">
      <div style="font-weight: 600;">${dayNum}</div>
      <div style="font-size: 0.65rem;">${dayName}</div>
    </div>`;
  });
  html += `</div>`;

  // User rows
  users.forEach((user, userIndex) => {
    const rowBg = userIndex % 2 === 0 ? "#ffffff" : "#f8f9fa";
    html += `<div style="display: flex; border-bottom: 1px solid #dee2e6; background: ${rowBg};">`;
    html += `<div style="width: ${nameColumnWidth}px; padding: 10px; font-weight: 500; border-right: 2px solid #dee2e6; display: flex; align-items: center;">${user.name}</div>`;

    days.forEach((day) => {
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const dayStr = day.toISOString().split("T")[0];

      // Check if this day falls in any leave request
      const leaveRequest = user.requests.find((req) => {
        const reqStart = new Date(req.start_date);
        const reqEnd = new Date(req.end_date);
        return day >= reqStart && day <= reqEnd && !isWeekend;
      });

      let cellBg = isWeekend ? "#f1f3f5" : "#ffffff";
      let cellContent = "";

      if (leaveRequest) {
        const color =
          leaveRequest.balance_type === "vacation" ? "#0d6efd" : "#198754";
        const lightColor =
          leaveRequest.balance_type === "vacation" ? "#cfe2ff" : "#d1e7dd";
        cellBg = lightColor;

        // Show tooltip on hover
        const startDate = new Date(leaveRequest.start_date).toLocaleDateString(
          locale
        );
        const endDate = new Date(leaveRequest.end_date).toLocaleDateString(
          locale
        );
        const typeLabel =
          leaveRequest.balance_type === "vacation"
            ? translate("ui", "leave.type_vacation", "Vacation")
            : translate("ui", "leave.type_overtime", "Overtime");

        cellContent = `<div style="height: 100%; background: ${cellBg}; border-left: 3px solid ${color};" title="${typeLabel}: ${startDate} - ${endDate} (${leaveRequest.hours_requested}${hoursUnit})"></div>`;
      }

      html += `<div style="width: ${cellWidth}px; border-right: 1px solid #e9ecef; background: ${cellBg}; min-height: 40px;">
        ${cellContent}
      </div>`;
    });

    html += `</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}
