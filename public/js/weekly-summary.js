let currentPage = 1;

function renderWeeklySummary() {
  return `
        <div class="container mt-4">
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-calendar-week"></i> Weekly Hours Summary</h5>
                        </div>
                        <div class="card-body">
                            <div id="weeklySummaryAlert"></div>
                            <div class="table-responsive">
                                <table class="table table-striped table-hover">
                                    <thead>
                                        <tr>
                                            <th>Week Number</th>
                                            <th>Work Days</th>
                                            <th>Total Hours</th>
                                            <th>Overworked</th>
                                        </tr>
                                    </thead>
                                    <tbody id="weeklySummaryTableBody">
                                        <tr>
                                            <td colspan="4" class="text-center">
                                                <div class="spinner-border spinner-border-sm" role="status">
                                                    <span class="visually-hidden">Loading...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div id="weeklySummaryPagination" class="d-flex justify-content-center mt-3"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initWeeklySummary() {
  currentPage = 1;
  await loadWeeklySummary();
}

async function loadWeeklySummary(page = 1) {
  try {
    currentPage = page;
    const data = await api.getWeeklySummary(page);

    const tbody = document.getElementById("weeklySummaryTableBody");
    const paginationDiv = document.getElementById("weeklySummaryPagination");

    if (data.data.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        <i class="bi bi-inbox"></i> No weekly data available yet
                    </td>
                </tr>
            `;
      paginationDiv.innerHTML = "";
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
                    <td>Week ${week.week_number}</td>
                    <td>${week.work_days}</td>
                    <td>${week.total_hours}h</td>
                    <td class="${overworkedClass}">
                        ${parseFloat(week.overworked) > 0 ? "+" : ""}${
          week.overworked
        }h
                    </td>
                </tr>
            `;
      })
      .join("");

    // Render pagination
    if (data.pagination.totalPages > 1) {
      paginationDiv.innerHTML = `
                <nav>
                    <ul class="pagination">
                        <li class="page-item ${
                          currentPage === 1 ? "disabled" : ""
                        }">
                            <a class="page-link" href="#" onclick="loadWeeklySummary(${
                              currentPage - 1
                            }); return false;">Previous</a>
                        </li>
                        ${Array.from(
                          { length: data.pagination.totalPages },
                          (_, i) => i + 1
                        )
                          .map(
                            (p) => `
                                <li class="page-item ${
                                  p === currentPage ? "active" : ""
                                }">
                                    <a class="page-link" href="#" onclick="loadWeeklySummary(${p}); return false;">${p}</a>
                                </li>
                            `
                          )
                          .join("")}
                        <li class="page-item ${
                          currentPage === data.pagination.totalPages
                            ? "disabled"
                            : ""
                        }">
                            <a class="page-link" href="#" onclick="loadWeeklySummary(${
                              currentPage + 1
                            }); return false;">Next</a>
                        </li>
                    </ul>
                </nav>
            `;
    } else {
      paginationDiv.innerHTML = "";
    }
  } catch (error) {
    showWeeklySummaryAlert(error.message, "danger");
  }
}

function showWeeklySummaryAlert(message, type) {
  const alertDiv = document.getElementById("weeklySummaryAlert");
  alertDiv.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}
