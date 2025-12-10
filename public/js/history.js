function renderHistory() {
    return `
        <div class="container mt-4">
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-clock-history"></i> Submission History</h5>
                        </div>
                        <div class="card-body">
                            <div id="historyContent">
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

async function initHistory() {
    try {
        const submissions = await api.getSubmissions();
        await renderSubmissions(submissions);
    } catch (error) {
        document.getElementById('historyContent').innerHTML = `
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

async function renderSubmissions(submissions) {
    const container = document.getElementById('historyContent');

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
            console.warn('Submission has no timesheet_ids:', sub.id);
            continue;
        }
        
        const timesheetIds = sub.timesheet_ids.split(',').map(id => parseInt(id));
        const submissionDate = new Date(sub.submission_date);
        const statusBadgeClass = sub.status === 'sent' ? 'bg-success' : sub.status === 'failed' ? 'bg-danger' : 'bg-warning';
        
        // Fetch timesheet details to get week numbers and dates
        let submissionTitle = `Loading...`;
        let weekInfo = '';
        const userName = sub.user_name || 'Unknown';
        let timesheetDetails = [];

        
        try {
            timesheetDetails = await api.getTimesheetDetails(timesheetIds);
            if (timesheetDetails && timesheetDetails.length > 0) {
                const weekNumbers = [...new Set(timesheetDetails.map(ts => ts.week_number))];
                const year = new Date(timesheetDetails[0].date).getFullYear();
                
                if (weekNumbers.length === 1) {
                    const weekNum = weekNumbers[0];
                    const dateRange = getWeekDateRange(weekNum, year);
                    const startStr = dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const endStr = dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
                    const startStr = dateRange.min.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const endStr = dateRange.max.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    submissionTitle = `Week ${sortedWeeks.join(', ')} (${startStr} - ${endStr})`;
                    weekInfo = `Weeks ${sortedWeeks.join(', ')}`;
                }
            } else {
                // If no timesheet details, show basic info
                submissionTitle = `Submission (${timesheetIds.length} entries)`;
            }
        } catch (error) {
            console.error('Error fetching timesheet details:', error);
            // Fallback title on error
            submissionTitle = `Submission (${timesheetIds.length} entries)`;
        }
        
        html += `
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                            data-bs-target="#submission${sub.id}" aria-expanded="false" 
                            aria-controls="submission${sub.id}">
                        <div class="w-100">
                            <div class="d-flex justify-content-between align-items-center w-100">
                                <div>
                                    <strong><i class="bi bi-file-earmark"></i> ${submissionTitle}</strong>
                                    <small class="text-muted ms-2">${submissionDate.toLocaleString()}</small>
                                </div>
                                <div class="text-end">
                                    <small class="text-muted d-block mb-1">Submitted by: <span class="badge bg-secondary">${userName}</span></small>
                                    <span class="badge ${statusBadgeClass} me-2">${sub.status}</span>
                                    <small class="text-muted">${timesheetIds.length} entries</small>
                                </div>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="submission${sub.id}" class="accordion-collapse collapse" 
                     data-bs-parent="#submissionsAccordion">
                    <div class="accordion-body">
                        <div id="timesheet-rows-${sub.id}">
                            ${renderSubmissionTimesheets(timesheetDetails, sub.id)}
                        </div>
                        <div class="mt-3">
                            <button class="btn btn-sm btn-danger" onclick="viewSubmissionPDF(${sub.id})">
                                <i class="bi bi-file-pdf"></i> PDF
                            </button>
                            <button class="btn btn-sm btn-success" onclick="downloadSubmissionXLSX(${sub.id})">
                                <i class="bi bi-file-earmark-excel"></i> Excel
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="resendSubmissionEmail(${sub.id})">
                                <i class="bi bi-envelope"></i> Send Email
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderSubmissionTimesheets(timesheets, submissionId) {
    if (!timesheets || timesheets.length === 0) {
        return '<p class="text-muted">No timesheet details available</p>';
    }

    return `
        <div class="timesheet-list">
            ${timesheets.map((ts, index) => {
                const totalHours = calculateHours(ts.start_time, ts.end_time, ts.pause_time);
                const totalKm = (ts.end_km - ts.start_km).toFixed(2);
                const isEditing = window.editingTimesheetId === ts.id;

                return `
                    <div class="timesheet-row row g-2 mb-2 p-2 border rounded" style="background-color: ${isEditing ? '#f8f9fa' : 'white'}">
                        <div class="col-md-1">
                            <label class="form-label small">Week</label>
                            <input type="text" class="form-control form-control-sm" value="${ts.week_number}" readonly>
                        </div>
                        <div class="col-md-1">
                            <label class="form-label small">Ritnumber</label>
                            <input type="text" class="form-control form-control-sm history-ritnumber-${ts.id}" value="${ts.ritnumber || ''}" 
                                   ${isEditing ? '' : 'readonly'}>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small">Name</label>
                            <input type="text" class="form-control form-control-sm" value="${ts.user_name || 'Unknown'}" readonly>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small">Date</label>
                            <input type="date" class="form-control form-control-sm history-date-${ts.id}" value="${ts.date}" 
                                   ${isEditing ? '' : 'readonly'}>
                        </div>
                        <div class="col-md-1">
                            <label class="form-label small">Start</label>
                            <input type="time" class="form-control form-control-sm history-starttime-${ts.id}" value="${ts.start_time}" 
                                   ${isEditing ? '' : 'readonly'}>
                        </div>
                        <div class="col-md-1">
                            <label class="form-label small">End</label>
                            <input type="time" class="form-control form-control-sm history-endtime-${ts.id}" value="${ts.end_time}" 
                                   ${isEditing ? '' : 'readonly'}>
                        </div>
                        <div class="col-md-1">
                            <label class="form-label small">Start KM</label>
                            <input type="number" class="form-control form-control-sm history-startkm-${ts.id}" value="${ts.start_km}" step="0.1"
                                   ${isEditing ? '' : 'readonly'}>
                        </div>
                        <div class="col-md-1">
                            <label class="form-label small">End KM</label>
                            <input type="number" class="form-control form-control-sm history-endkm-${ts.id}" value="${ts.end_km}" step="0.1"
                                   ${isEditing ? '' : 'readonly'}>
                        </div>
                        <div class="col-md-1">
                            <label class="form-label small">Pause</label>
                            <input type="time" class="form-control form-control-sm history-pausetime-${ts.id}" value="${ts.pause_time}" 
                                   ${isEditing ? '' : 'readonly'}>
                        </div>
                        <div class="col-md-0.8">
                            <label class="form-label small">Hours</label>
                            <input type="text" class="form-control form-control-sm" value="${totalHours}" readonly>
                        </div>
                        <div class="col-md-0.8">
                            <label class="form-label small">KM</label>
                            <input type="text" class="form-control form-control-sm" value="${totalKm}" readonly>
                        </div>
                        <div class="col-md-auto">
                            <label class="form-label small">&nbsp;</label>
                            <div class="btn-group" role="group">
                                ${isEditing ? `
                                    <button class="btn btn-sm btn-success" onclick="saveHistoryEdit(${ts.id}, ${submissionId})" title="Save">
                                        <i class="bi bi-check"></i>
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="cancelHistoryEdit(${submissionId})" title="Cancel">
                                        <i class="bi bi-x"></i>
                                    </button>
                                ` : `
                                    <button class="btn btn-sm btn-primary" onclick="startHistoryEdit(${ts.id}, ${submissionId})" title="Edit">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function viewSubmissionPDF(submissionId) {
    try {
        const blob = await api.getSubmissionPDF(submissionId);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (error) {
        alert('Failed to load PDF: ' + error.message);
    }
}

async function downloadSubmissionXLSX(submissionId) {
    try {
        const blob = await api.getSubmissionXLSX(submissionId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `submission_${submissionId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Failed to download Excel: ' + error.message);
    }
}

// Inline editing functions for history
window.editingTimesheetId = null;

function startHistoryEdit(timesheetId, submissionId) {
    window.editingTimesheetId = timesheetId;
    const container = document.getElementById(`timesheet-rows-${submissionId}`);
    if (container) {
        // Re-render with edit mode on
        const submissions = [];  // Will be populated from DOM
        initHistory();  // Reload to show edit mode
    }
}

function cancelHistoryEdit(submissionId) {
    window.editingTimesheetId = null;
    initHistory();  // Reload to cancel editing
}

async function saveHistoryEdit(timesheetId, submissionId) {
    try {
        const data = {
            date: document.querySelector(`.history-date-${timesheetId}`).value,
            startTime: document.querySelector(`.history-starttime-${timesheetId}`).value,
            endTime: document.querySelector(`.history-endtime-${timesheetId}`).value,
            startKm: parseFloat(document.querySelector(`.history-startkm-${timesheetId}`).value),
            endKm: parseFloat(document.querySelector(`.history-endkm-${timesheetId}`).value),
            pauseTime: document.querySelector(`.history-pausetime-${timesheetId}`).value,
            ritnumber: document.querySelector(`.history-ritnumber-${timesheetId}`).value
        };
        
        await api.updateTimesheet(timesheetId, data);
        window.editingTimesheetId = null;
        
        // Show success message and reload
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show';
        alertDiv.innerHTML = `
            <i class="bi bi-check-circle"></i> Row updated successfully!
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.getElementById('historyContent').insertBefore(alertDiv, document.getElementById('historyContent').firstChild);
        
        setTimeout(() => {
            initHistory();
        }, 1000);
    } catch (error) {
        alert('Error updating timesheet: ' + error.message);
    }
}

async function resendSubmissionEmail(submissionId) {
    if (!confirm('Send this submission via email?')) {
        return;
    }
    
    try {
        await api.resendSubmissionEmail(submissionId);
        alert('Email sent successfully!');
        initHistory(); // Reload to update status
    } catch (error) {
        alert('Failed to send email: ' + error.message);
    }
}
