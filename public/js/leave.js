let leaveRequests = [];
let leaveBalance = { vacation_hours: 0, overtime_hours: 0 };

function renderLeave() {
  return `
    <div class="container mt-4">
      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0"><i class="bi bi-wallet2"></i> Verlofsaldo</h5>
              <span class="badge bg-info" id="leaveBalanceUpdated">-</span>
            </div>
            <div class="card-body" id="leaveBalanceCard">
              <div class="text-center text-muted">Loading...</div>
            </div>
          </div>
        </div>
        <div class="col-lg-8">
          <div class="card mb-3">
            <div class="card-header"><h5 class="mb-0"><i class="bi bi-send"></i> Verlofaanvraag</h5></div>
            <div class="card-body">
              <div id="leaveFormAlert"></div>
              <div class="row g-2">
                <div class="col-md-3">
                  <label class="form-label">Type</label>
                  <select class="form-select" id="leaveType">
                    <option value="vacation">Verlof</option>
                    <option value="overtime">Overuren</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <label class="form-label">Vanaf datum</label>
                  <input type="date" class="form-control" id="leaveStart" onchange="calculateLeaveHours()" />
                </div>
                <div class="col-md-3">
                  <label class="form-label">Tot en met</label>
                  <input type="date" class="form-control" id="leaveEnd" onchange="calculateLeaveHours()" />
                </div>
                <div class="col-md-3">
                  <label class="form-label">Uren (auto)</label>
                  <input type="number" step="0.25" min="0.25" class="form-control" id="leaveHours" readonly />
                </div>
                <div class="col-md-3">
                  <label class="form-label">Vanaf tijd</label>
                  <input type="time" class="form-control" id="leaveStartTime" value="09:00" onchange="calculateLeaveHours()" />
                </div>
                <div class="col-md-3">
                  <label class="form-label">Tot tijd</label>
                  <input type="time" class="form-control" id="leaveEndTime" value="18:00" onchange="calculateLeaveHours()" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Toelichting (optioneel)</label>
                  <textarea class="form-control" id="leaveReason" rows="1"></textarea>
                </div>
                <div class="col-12 d-flex justify-content-end">
                  <button class="btn btn-primary" onclick="submitLeaveRequestForm()">
                    <i class="bi bi-send"></i> Aanvraag indienen
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h5 class="mb-0"><i class="bi bi-list-check"></i> Mijn aanvragen</h5></div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>Periode</th>
                      <th>Uren</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Opmerking</th>
                      <th>Acties</th>
                    </tr>
                  </thead>
                  <tbody id="leaveRequestsBody">
                    <tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>
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
              <h5 class="mb-0"><i class="bi bi-calendar3"></i> Verlofkalender - Team Overzicht</h5>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" onclick="shiftCalendar(-1)">
                  <i class="bi bi-chevron-left"></i> Vorige maand
                </button>
                <button class="btn btn-outline-secondary" onclick="shiftCalendar(0)">
                  Vandaag
                </button>
                <button class="btn btn-outline-secondary" onclick="shiftCalendar(1)">
                  Volgende maand <i class="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
            <div class="card-body p-0">
              <div id="leaveCalendar" style="overflow-x: auto; overflow-y: visible;">
                <div class="text-center p-4 text-muted">Loading calendar...</div>
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
    card.innerHTML = `
      <div class="mb-2 d-flex justify-content-between align-items-center">
        <span>Verlofuren</span>
        <span class="fw-bold text-primary" id="vacationHours">${
          balance.vacation_hours?.toFixed?.(2) ??
          Number(balance.vacation_hours || 0).toFixed(2)
        } u</span>
      </div>
      <div class="mb-2 d-flex justify-content-between align-items-center">
        <span>Overuren</span>
        <span class="fw-bold text-success" id="overtimeHours">${
          balance.overtime_hours?.toFixed?.(2) ??
          Number(balance.overtime_hours || 0).toFixed(2)
        } u</span>
      </div>
      <small class="text-muted">Beschikbaar voor aanvragen. Aanvragen worden direct verrekend.</small>
    `;
    document.getElementById("leaveBalanceUpdated").textContent =
      balance.updated_at ? new Date(balance.updated_at).toLocaleString() : "-";
  } catch (error) {
    card.innerHTML = `<div class="alert alert-danger mb-0">${error.message}</div>`;
  }
}

async function loadLeaveRequests() {
  const tbody = document.getElementById("leaveRequestsBody");
  try {
    leaveRequests = await api.getLeaveRequests();
    if (!leaveRequests.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted"><i class="bi bi-inbox"></i> Geen aanvragen</td></tr>`;
      return;
    }

    tbody.innerHTML = leaveRequests
      .map((req) => {
        const statusBadge =
          req.status === "approved"
            ? "badge bg-success"
            : req.status === "rejected"
            ? "badge bg-danger"
            : "badge bg-warning text-dark";
        const approver = req.approver_name ? ` (${req.approver_name})` : "";

        // Format date/time display
        let dateTimeDisplay = `${req.start_date}`;
        if (req.start_date === req.end_date && req.start_time && req.end_time) {
          dateTimeDisplay += ` (${req.start_time} - ${req.end_time})`;
        } else if (req.start_date !== req.end_date) {
          dateTimeDisplay += ` t/m ${req.end_date}`;
          if (req.start_time && req.end_time) {
            dateTimeDisplay += ` (${req.start_time} - ${req.end_time})`;
          }
        }

        return `
          <tr>
            <td>${dateTimeDisplay}</td>
            <td>${Number(req.hours_requested).toFixed(2)} u</td>
            <td>${req.balance_type === "vacation" ? "Verlof" : "Overuren"}</td>
            <td><span class="${statusBadge}">${
          req.status
        }${approver}</span></td>
            <td>${req.reason || req.admin_note || "-"}</td>
            <td>
              <button class="btn btn-sm btn-warning" onclick="editLeaveRequest(${
                req.id
              })" title="Bewerken">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteLeaveRequest(${
                req.id
              })" title="Intrekken">
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
    <strong>Bewerken:</strong> Pas de gegevens aan en klik op "Bijwerken"
    <button class="btn btn-sm btn-secondary ms-2" onclick="cancelEdit()">Annuleren</button>
  </div>`;

  // Replace submit button
  const submitBtn = document.querySelector(
    'button[onclick="submitLeaveRequestForm()"]'
  );
  submitBtn.setAttribute("onclick", `updateLeaveRequest(${id})`);
  submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> Bijwerken';

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
  submitBtn.innerHTML = '<i class="bi bi-send"></i> Aanvraag indienen';
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
    alertDiv.innerHTML = `<div class="alert alert-warning">Vul alle verplichte velden in en gebruik een geldige urenwaarde.</div>`;
    return;
  }

  alertDiv.innerHTML = `<div class="alert alert-info">Aanvraag wordt bijgewerkt...</div>`;

  try {
    await api.updateLeaveRequest(id, {
      startDate,
      endDate,
      startTime,
      endTime,
      hours,
      balanceType,
      reason,
    });
    alertDiv.innerHTML = `<div class="alert alert-success">Aanvraag bijgewerkt en saldo aangepast.</div>`;
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
      "Weet je zeker dat je deze verlofaanvraag wilt intrekken? De uren worden teruggestort."
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
    alert(`Fout bij intrekken: ${error.message}`);
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
    alertDiv.innerHTML = `<div class="alert alert-warning">Vul alle verplichte velden in en gebruik een geldige urenwaarde.</div>`;
    return;
  }

  alertDiv.innerHTML = `<div class="alert alert-info">Aanvraag wordt verzonden...</div>`;

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
    alertDiv.innerHTML = `<div class="alert alert-success">Aanvraag verzonden en saldo bijgewerkt.</div>`;
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
    container.innerHTML =
      '<div class="text-center p-4 text-muted">Geen goedgekeurde verlofaanvragen gevonden</div>';
    return;
  }

  // Calculate cell width (minimum 30px per day)
  const cellWidth = 35;
  const nameColumnWidth = 180;
  const totalWidth = nameColumnWidth + days.length * cellWidth;

  let html = `<div style="min-width: ${totalWidth}px;">`;

  // Header with dates
  html += `<div style="display: flex; border-bottom: 2px solid #dee2e6; background: #f8f9fa; position: sticky; top: 0; z-index: 10;">`;
  html += `<div style="width: ${nameColumnWidth}px; padding: 10px; font-weight: bold; border-right: 2px solid #dee2e6; background: #f8f9fa;">Medewerker</div>`;

  let currentMonth = null;
  let monthStartCol = 0;
  const monthHeaders = [];

  days.forEach((day, index) => {
    const monthYear = day.toLocaleDateString("nl-NL", {
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
    const dayName = day.toLocaleDateString("nl-NL", { weekday: "short" });

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
          "nl-NL"
        );
        const endDate = new Date(leaveRequest.end_date).toLocaleDateString(
          "nl-NL"
        );
        const typeLabel =
          leaveRequest.balance_type === "vacation" ? "Verlof" : "Overuren";

        cellContent = `<div style="height: 100%; background: ${cellBg}; border-left: 3px solid ${color};" title="${typeLabel}: ${startDate} - ${endDate} (${leaveRequest.hours_requested}u)"></div>`;
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
