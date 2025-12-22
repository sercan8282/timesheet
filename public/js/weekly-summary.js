let currentPage = 1;
let weeklyFilterYear = "";
let weeklyFilterWeek = "";
let weeklyAvailableYears = [];

function renderWeeklySummary() {
  return `
    <div class="container mt-4">
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h5 class="mb-0"><i class="bi bi-calendar-week"></i> <span data-i18n="ui:weekly.title">Weekly Hours Summary</span></h5>
                <div class="d-flex align-items-center gap-2">
                  <label class="form-label mb-0" for="weeklyYearFilter"><span data-i18n="ui:weekly.year">Year</span></label>
                  <select id="weeklyYearFilter" class="form-select form-select-sm" style="width: auto"></select>
                  <label class="form-label mb-0" for="weeklyWeekFilter"><span data-i18n="ui:weekly.week">Week</span></label>
                  <input id="weeklyWeekFilter" type="number" min="1" max="53" class="form-control form-control-sm" style="width: 90px" placeholder="e.g. 12">
                </div>
              </div>
            </div>
            <div class="card-body">
              <div id="weeklySummaryAlert"></div>
              <div class="table-responsive">
                <table class="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th><span data-i18n="ui:weekly.year">Year</span></th>
                      <th><span data-i18n="ui:weekly.week_number">Week Number</span></th>
                      <th><span data-i18n="ui:weekly.work_days">Work Days</span></th>
                      <th><span data-i18n="ui:weekly.total_hours">Total Hours</span></th>
                      <th><span data-i18n="ui:weekly.overworked">Overworked</span></th>
                    </tr>
                  </thead>
                  <tbody id="weeklySummaryTableBody">
                    <tr>
                      <td colspan="5" class="text-center">
                        <div class="spinner-border spinner-border-sm" role="status">
                          <span class="visually-hidden" data-i18n="ui:loading">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div id="weeklySummaryPagination" class="d-flex justify-content-center mt-3"></div>
              <div id="weeklySummaryMeta" class="text-muted small mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function initWeeklySummary() {
  currentPage = 1;
  weeklyFilterYear = "";
  weeklyFilterWeek = "";
  weeklyAvailableYears = [];

  const yearSelect = document.getElementById("weeklyYearFilter");
  const weekInput = document.getElementById("weeklyWeekFilter");

  if (yearSelect) {
    yearSelect.onchange = () => {
      weeklyFilterYear = yearSelect.value || "";
      currentPage = 1;
      loadWeeklySummary();
    };
  }

  if (weekInput) {
    weekInput.oninput = () => {
      weeklyFilterWeek = weekInput.value.trim();
      currentPage = 1;
      loadWeeklySummary();
    };
  }

  await loadWeeklySummary();
}

async function loadWeeklySummary(page = 1) {
  try {
    currentPage = page;
    const data = await api.getWeeklySummary({
      page,
      year: weeklyFilterYear,
      week: weeklyFilterWeek,
    });

    weeklyAvailableYears = data.years || [];

    const tbody = document.getElementById("weeklySummaryTableBody");
    const paginationDiv = document.getElementById("weeklySummaryPagination");
    const metaDiv = document.getElementById("weeklySummaryMeta");
    const yearSelect = document.getElementById("weeklyYearFilter");
    const weekInput = document.getElementById("weeklyWeekFilter");

    if (yearSelect) {
      yearSelect.innerHTML =
        '<option value="">Alle jaren</option>' +
        weeklyAvailableYears
          .map(
            (y) =>
              `<option value="${escapeHtml(y)}" ${String(y) === String(weeklyFilterYear) ? "selected" : ""}>${escapeHtml(y)}</option>`
          )
          .join("");
    }
    if (weekInput) {
      weekInput.value = weeklyFilterWeek;
    }

    if (data.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted">
            <i class="bi bi-inbox"></i> No weekly data available yet
          </td>
        </tr>
      `;
      paginationDiv.innerHTML = "";
      if (metaDiv) metaDiv.innerHTML = "";
      return;
    }

    tbody.innerHTML = data.data
      .map((week) => {
        const overworkedClass =
          parseFloat(week.overworked) > 0
            ? "text-danger fw-bold"
            : parseFloat(week.overworked) < 0
            ? "text-success"
            : "";
        return `
          <tr>
            <td>${escapeHtml(week.year || "-")}</td>
            <td>Week ${escapeHtml(week.week_number)}</td>
            <td>${escapeHtml(week.work_days)}</td>
            <td>${escapeHtml(week.total_hours)}h</td>
            <td class="${overworkedClass}">
              ${parseFloat(week.overworked) > 0 ? "+" : ""}${escapeHtml(week.overworked)}h
            </td>
          </tr>
        `;
      })
      .join("");

    if (data.pagination.totalPages > 1) {
      paginationDiv.innerHTML = `
        <nav>
          <ul class="pagination">
            <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
              <a class="page-link" href="#" onclick="loadWeeklySummary(${currentPage - 1}); return false;">Previous</a>
            </li>
            ${Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1)
              .map(
                (p) => `
                  <li class="page-item ${p === currentPage ? "active" : ""}">
                    <a class="page-link" href="#" onclick="loadWeeklySummary(${p}); return false;">${p}</a>
                  </li>
                `
              )
              .join("")}
            <li class="page-item ${currentPage === data.pagination.totalPages ? "disabled" : ""}">
              <a class="page-link" href="#" onclick="loadWeeklySummary(${currentPage + 1}); return false;">Next</a>
            </li>
          </ul>
        </nav>
      `;
    } else {
      paginationDiv.innerHTML = "";
    }

    if (metaDiv) {
      const start = (data.pagination.page - 1) * data.pagination.limit + 1;
      const end = Math.min(
        data.pagination.page * data.pagination.limit,
        data.pagination.total
      );
      metaDiv.textContent = `Toon ${start}-${end} van ${data.pagination.total}${
        weeklyFilterYear ? ` (jaar ${weeklyFilterYear})` : ""
      }${weeklyFilterWeek ? ` (week ${weeklyFilterWeek})` : ""}`;
    }
  } catch (error) {
    showWeeklySummaryAlert(error.message, "danger");
  }
}

function showWeeklySummaryAlert(message, type) {
  const alertDiv = document.getElementById("weeklySummaryAlert");
  const safeType = ['danger', 'warning', 'info', 'success'].includes(type) ? type : 'info';
  alertDiv.innerHTML = `
    <div class="alert alert-${safeType} alert-dismissible fade show" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
}
