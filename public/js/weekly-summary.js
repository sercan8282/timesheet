let currentWeeklySummaryPage = 1;

function renderWeeklySummary() {
    return `
        <div class="container mt-4">
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-bar-chart"></i> Weekly Summary</h5>
                            <small class="text-muted">Total hours worked per week</small>
                        </div>
                        <div class="card-body">
                            <div id="weeklySummaryContent">
                                <div class="text-center">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
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

async function initWeeklySummary() {
    currentWeeklySummaryPage = 1;
    await loadWeeklySummary(1);
}

async function loadWeeklySummary(page = 1) {
    const container = document.getElementById('weeklySummaryContent');
    container.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';

    try {
        const data = await api.getWeeklySummary(page);
        renderWeeklySummaryTable(data);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
    }
}

function renderWeeklySummaryTable(data) {
    const container = document.getElementById('weeklySummaryContent');
    const { data: weeks, pagination } = data;

    if (!weeks || weeks.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> No timesheet data available yet
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Week #</th>
                        <th>Date Range</th>
                        <th>Worked Hours</th>
                        <th>Expected Hours</th>
                        <th>Overworked</th>
                    </tr>
                </thead>
                <tbody>
    `;

    weeks.forEach(week => {
        const workingHours = week.workingHours || 40;
        const totalHours = week.totalHours || 0;
        const overworked = week.overworked || 0;
        
        // Calculate date range for the week
        const dateRange = getWeekDateRange(week.weekNumber, new Date(week.weekStartDate).getFullYear());
        const startStr = dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const overworkedClass = overworked > 0 ? 'text-success' : '';
        const hoursStatus = totalHours >= workingHours ? 'text-success fw-bold' : totalHours < workingHours * 0.8 ? 'text-danger' : 'text-warning';

        html += `
            <tr>
                <td><strong>Week ${week.weekNumber}</strong></td>
                <td>${startStr} - ${endStr}</td>
                <td class="${hoursStatus}">${totalHours.toFixed(2)}h</td>
                <td>${workingHours}h</td>
                <td class="${overworkedClass}">${overworked > 0 ? '+' : ''}${overworked.toFixed(2)}h</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    // Add pagination controls
    if (pagination.totalPages > 1) {
        html += `
            <nav aria-label="Page navigation" class="mt-4">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="loadWeeklySummary(1); return false;">
                            <i class="bi bi-chevron-double-left"></i> First
                        </a>
                    </li>
                    <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="loadWeeklySummary(${pagination.page - 1}); return false;">
                            <i class="bi bi-chevron-left"></i> Previous
                        </a>
                    </li>
        `;

        // Show page numbers
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.totalPages, pagination.page + 2);

        if (startPage > 1) {
            html += `<li class="page-item disabled"><a class="page-link">...</a></li>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === pagination.page ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="loadWeeklySummary(${i}); return false;">${i}</a>
                </li>
            `;
        }

        if (endPage < pagination.totalPages) {
            html += `<li class="page-item disabled"><a class="page-link">...</a></li>`;
        }

        html += `
                    <li class="page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="loadWeeklySummary(${pagination.page + 1}); return false;">
                            Next <i class="bi bi-chevron-right"></i>
                        </a>
                    </li>
                    <li class="page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="loadWeeklySummary(${pagination.totalPages}); return false;">
                            Last <i class="bi bi-chevron-double-right"></i>
                        </a>
                    </li>
                </ul>
            </nav>
        `;
    }

    html += `
        <div class="alert alert-info mt-3">
            <small>
                <i class="bi bi-info-circle"></i> 
                Showing ${weeks.length} weeks (Page ${pagination.page} of ${pagination.totalPages}).
                Total weeks available: ${pagination.totalWeeks}
            </small>
        </div>
    `;

    container.innerHTML = html;
    currentWeeklySummaryPage = pagination.page;
}

function getWeekDateRange(weekNumber, year) {
    // ISO 8601 week date calculation
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

    const weekEnd = new Date(ISOweekStart);
    weekEnd.setDate(ISOweekStart.getDate() + 6);

    return {
        start: ISOweekStart,
        end: weekEnd
    };
}
