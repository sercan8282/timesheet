let timesheets = [];
let timesheetCounter = 0;
let deleteConfirmationData = { index: null, timesheet: null };

function renderDashboard() {
    return `
        <div class="container mt-4">
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-calendar-week"></i> Timesheet Entry</h5>
                        </div>
                        <div class="card-body">
                            <div id="timesheetAlert"></div>
                            <div id="timesheetRows"></div>
                            <button type="button" class="btn btn-success mb-3" onclick="addTimesheetRow()">
                                <i class="bi bi-plus-circle"></i> Add Row
                            </button>
                            <hr>
                            <div class="d-flex gap-2 flex-wrap">
                                <button type="button" class="btn btn-primary" onclick="saveTimesheets()">
                                    <i class="bi bi-save"></i> Save All
                                </button>
                                <button type="button" class="btn btn-danger" onclick="previewPDF()">
                                    <i class="bi bi-file-pdf"></i> Preview PDF
                                </button>
                                <button type="button" class="btn btn-success" onclick="previewXLSX()">
                                    <i class="bi bi-file-earmark-excel"></i> Preview Excel
                                </button>
                                <button type="button" class="btn btn-primary" onclick="submitTimesheets()">
                                    <i class="bi bi-send"></i> Submit & Send Email
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
                            <i class="bi bi-exclamation-triangle text-warning"></i> Confirm Delete
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to delete this timesheet entry?</p>
                        <p class="text-muted small">This action cannot be undone.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" onclick="confirmDelete()">Delete Entry</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initDashboard() {
    timesheets = [];
    timesheetCounter = 0;
    await loadExistingTimesheets();
    if (timesheets.length === 0) {
        addTimesheetRow();
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
            data.slice(0, 5).forEach(ts => {
                timesheets.push({
                    id: ts.id,
                    ritnumber: ts.ritnumber || '',
                    date: ts.date,
                    startTime: ts.start_time,
                    endTime: ts.end_time,
                    startKm: ts.start_km,
                    endKm: ts.end_km,
                    pauseTime: ts.pause_time,
                    saved: true
                });
            });
            renderTimesheetRows();
        }
    } catch (error) {
        console.error('Error loading timesheets:', error);
        addTimesheetRow();
    }
}

function addTimesheetRow() {
    const today = new Date().toISOString().split('T')[0];
    timesheets.push({
        id: null,
        tempId: ++timesheetCounter,
        ritnumber: '',
        date: today,
        startTime: '09:00',
        endTime: '17:00',
        startKm: 0,
        endKm: 0,
        pauseTime: '00:30',
        saved: false
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
        const modal = new bootstrap.Modal(document.getElementById('deleteConfirmationModal'));
        modal.show();
    }
}

function confirmDelete() {
    const { index, timesheet } = deleteConfirmationData;
    if (timesheet && timesheet.id) {
        api.deleteTimesheet(timesheet.id)
            .then(() => {
                timesheets.splice(index, 1);
                renderTimesheetRows();
                showAlert('Timesheet deleted', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmationModal'));
                if (modal) modal.hide();
            })
            .catch(err => {
                showAlert(err.message, 'danger');
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmationModal'));
                if (modal) modal.hide();
            });
    }
    deleteConfirmationData = { index: null, timesheet: null };
}

function renderTimesheetRows() {
    const container = document.getElementById('timesheetRows');
    const user = JSON.parse(localStorage.getItem('user'));

    container.innerHTML = timesheets.map((ts, index) => {
        const weekNumber = getWeekNumber(new Date(ts.date));
        const totalHours = calculateHours(ts.startTime, ts.endTime, ts.pauseTime);
        const totalKm = (ts.endKm - ts.startKm).toFixed(2);

        return `
            <div class="timesheet-row row g-1 mb-2 align-items-end">
                <div class="col-auto" style="width: 60px;">
                    <label class="form-label small mb-1">Week</label>
                    <input type="text" class="form-control form-control-sm" value="${weekNumber}" readonly>
                </div>
                <div class="col-auto" style="width: 90px;">
                    <label class="form-label small mb-1">Ritnumber</label>
                    <input type="text" class="form-control form-control-sm" value="${ts.ritnumber || ''}" 
                           onchange="updateTimesheet(${index}, 'ritnumber', this.value)">
                </div>
                <div class="col-auto" style="width: 140px;">
                    <label class="form-label small mb-1">Name</label>
                    <input type="text" class="form-control form-control-sm" value="${user.fullName}" readonly>
                </div>
                <div class="col-auto" style="width: 130px;">
                    <label class="form-label small mb-1">Date</label>
                    <input type="date" class="form-control form-control-sm" value="${ts.date}" 
                           onchange="updateTimesheet(${index}, 'date', this.value)">
                </div>
                <div class="col-auto" style="width: 85px;">
                    <label class="form-label small mb-1">Start</label>
                    <input type="time" class="form-control form-control-sm" value="${ts.startTime}" 
                           onchange="updateTimesheet(${index}, 'startTime', this.value)">
                </div>
                <div class="col-auto" style="width: 85px;">
                    <label class="form-label small mb-1">End</label>
                    <input type="time" class="form-control form-control-sm" value="${ts.endTime}" 
                           onchange="updateTimesheet(${index}, 'endTime', this.value)">
                </div>
                <div class="col-auto" style="width: 80px;">
                    <label class="form-label small mb-1">Start KM</label>
                    <input type="number" class="form-control form-control-sm" value="${ts.startKm}" step="0.1"
                           onchange="updateTimesheet(${index}, 'startKm', parseFloat(this.value))">
                </div>
                <div class="col-auto" style="width: 80px;">
                    <label class="form-label small mb-1">End KM</label>
                    <input type="number" class="form-control form-control-sm" value="${ts.endKm}" step="0.1"
                           onchange="updateTimesheet(${index}, 'endKm', parseFloat(this.value))">
                </div>
                <div class="col-auto" style="width: 85px;">
                    <label class="form-label small mb-1">Pause</label>
                    <input type="time" class="form-control form-control-sm" value="${ts.pauseTime}" 
                           onchange="updateTimesheet(${index}, 'pauseTime', this.value)">
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
                    <button class="btn btn-sm btn-danger" onclick="removeTimesheetRow(${index})" style="margin-top: 2px;">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function updateTimesheet(index, field, value) {
    timesheets[index][field] = value;
    timesheets[index].saved = false;
    renderTimesheetRows();
}

async function saveTimesheets() {
    const alertDiv = document.getElementById('timesheetAlert');
    
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
                    ritnumber: ts.ritnumber || ''
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

        showAlert('All timesheets saved successfully!', 'success');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function saveTimesheets() {
    const alertDiv = document.getElementById('timesheetAlert');
    
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
                    ritnumber: ts.ritnumber || ''
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

        showAlert('All timesheets saved successfully!', 'success');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function submitTimesheets() {
    // Save first
    await saveTimesheets();

    const timesheetIds = timesheets.filter(ts => ts.id).map(ts => ts.id);

    if (timesheetIds.length === 0) {
        showAlert('No timesheets to submit', 'warning');
        return;
    }

    showConfirmModal(
        'Submit Timesheets',
        `Submit ${timesheetIds.length} timesheet(s) via email?`,
        async () => {
            try {
                await api.submitTimesheets(timesheetIds);
                
                // Clear all timesheets from the display and start fresh
                timesheets = [];
                timesheetCounter = 0;
                addTimesheetRow();  // Add one empty row for new entries - also calls renderTimesheetRows()
                
                // Show success message
                showAlert('Timesheets submitted and sent successfully!', 'success');
                
                // Clear alert after 3 seconds
                setTimeout(() => {
                    const alertDiv = document.getElementById('timesheetAlert');
                    if (alertDiv) {
                        alertDiv.innerHTML = '';
                    }
                }, 3000);
            } catch (error) {
                showAlert(error.message, 'danger');
            }
        }
    );
}

async function previewPDF() {
    await saveTimesheets();

    const timesheetIds = timesheets.filter(ts => ts.id).map(ts => ts.id);

    if (timesheetIds.length === 0) {
        showAlert('No timesheets to preview', 'warning');
        return;
    }

    try {
        const blob = await api.previewPDF(timesheetIds);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function previewXLSX() {
    await saveTimesheets();

    const timesheetIds = timesheets.filter(ts => ts.id).map(ts => ts.id);

    if (timesheetIds.length === 0) {
        showAlert('No timesheets to preview', 'warning');
        return;
    }

    try {
        const blob = await api.previewXLSX(timesheetIds);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timesheet_preview_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert('Excel file downloaded successfully!', 'success');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

function showAlert(message, type) {
    const alertDiv = document.getElementById('timesheetAlert');
    alertDiv.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    setTimeout(() => {
        alertDiv.innerHTML = '';
    }, 5000);
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function calculateHours(startTime, endTime, pauseTime) {
    if (!startTime || !endTime || !pauseTime) {
        return '0.00';
    }
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const [pauseH, pauseM] = pauseTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const pauseMinutes = pauseH * 60 + pauseM;

    const totalMinutes = endMinutes - startMinutes - pauseMinutes;
    return (totalMinutes / 60).toFixed(2);
}
