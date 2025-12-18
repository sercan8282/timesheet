// MFA Management Page
function renderMFASettings() {
    return `
        <div class="container mt-4">
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-shield-lock"></i> Two-Factor Authentication</h5>
                        </div>
                        <div class="card-body">
                            <div id="mfaSettingsAlert"></div>
                            
                            <!-- MFA Status -->
                            <div class="mb-4">
                                <h6>Status</h6>
                                <div id="mfaStatusContainer" class="alert alert-info">
                                    Loading...
                                </div>
                            </div>

                            <!-- MFA Actions -->
                            <div id="mfaActionsContainer">
                                <!-- Filled by JavaScript -->
                            </div>

                            <!-- Backup Codes -->
                            <div class="mb-4" id="backupCodesSection" style="display: none;">
                                <h6>Backup Codes</h6>
                                <p class="text-muted small">Keep these codes in a safe place. You can use them to access your account if you lose your device.</p>
                                <div id="backupCodesDisplay" class="p-3 bg-light rounded mb-3" style="font-family: monospace;"></div>
                                <button class="btn btn-sm btn-secondary" onclick="mfaCopyBackupCodes()">
                                    <i class="bi bi-clipboard"></i> Copy All Codes
                                </button>
                            </div>

                            <hr>
                            <button type="button" class="btn btn-secondary" onclick="app.loadPage('dashboard')">
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initMFASettings() {
    const alertDiv = document.getElementById('mfaSettingsAlert');
    const statusContainer = document.getElementById('mfaStatusContainer');
    const actionsContainer = document.getElementById('mfaActionsContainer');
    const backupCodesSection = document.getElementById('backupCodesSection');

    try {
        // Fetch MFA status
        const response = await fetch(`${API_BASE_URL}/mfa/status`, {
            headers: {
                'Authorization': `Bearer ${api.getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch MFA status');
        }

        const status = await response.json();

        // Display status
        if (status.mfaEnabled) {
            statusContainer.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="bi bi-check-circle-fill text-success"></i>
                        <strong>Enabled</strong>
                        <p class="text-muted mb-0 small">Your account is protected with two-factor authentication.</p>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="mfaShowDisableForm()">
                        <i class="bi bi-trash"></i> Disable MFA
                    </button>
                </div>
            `;

            // Show backup codes section
            backupCodesSection.style.display = 'block';

            actionsContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> To re-setup your MFA, disable it first then set it up again.
                </div>
            `;
        } else {
            statusContainer.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="bi bi-exclamation-circle text-warning"></i>
                        <strong>Disabled</strong>
                        <p class="text-muted mb-0 small">Enable two-factor authentication to secure your account.</p>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="mfaShowSetupForm()">
                        <i class="bi bi-plus-circle"></i> Enable MFA
                    </button>
                </div>
            `;

            if (status.setupRequired) {
                actionsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i> MFA setup is now required. You've reached the maximum number of skips. Please set up MFA to continue using your account.
                    </div>
                `;
            } else if (status.skipCount > 0) {
                actionsContainer.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle"></i> You have ${status.skipsRemaining} ${status.skipsRemaining === 1 ? 'skip' : 'skips'} remaining before MFA becomes mandatory.
                    </div>
                `;
            }
        }

        // Load backup codes if MFA enabled
        if (status.mfaEnabled) {
            const codesResponse = await fetch(`${API_BASE_URL}/user/backup-codes`, {
                headers: {
                    'Authorization': `Bearer ${api.getToken()}`
                }
            });

            if (codesResponse.ok) {
                const codesData = await codesResponse.json();
                const codesDisplay = document.getElementById('backupCodesDisplay');
                codesDisplay.innerHTML = codesData.codes.map(code => 
                    `<div>${code}</div>`
                ).join('');
            }
        }

    } catch (error) {
        alertDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> Error: ${error.message}
            </div>
        `;
    }
}

function mfaShowSetupForm() {
    showMFAModal({ setupMode: true, required: false });
}

function mfaShowDisableForm() {
    const actionsContainer = document.getElementById('mfaActionsContainer');
    actionsContainer.innerHTML = `
        <div class="card bg-light">
            <div class="card-body">
                <h6>Disable Two-Factor Authentication</h6>
                <p class="text-muted small">To disable MFA, enter your password and current authentication code.</p>
                <div id="disableMfaAlert"></div>
                <form id="disableMfaForm" onsubmit="mfaDisableSubmit(event)">
                    <div class="mb-3">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-control" id="disableMfaPassword" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Current MFA Code</label>
                        <input type="text" class="form-control text-center" id="disableMfaCode" 
                               placeholder="000000" maxlength="6" pattern="[0-9]{6}" 
                               inputmode="numeric" autocomplete="off" required>
                    </div>
                    <button type="submit" class="btn btn-danger">
                        <i class="bi bi-trash"></i> Disable MFA
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="initMFASettings()">
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    `;
}

async function mfaDisableSubmit(event) {
    event.preventDefault();
    const alertDiv = document.getElementById('disableMfaAlert');
    const password = document.getElementById('disableMfaPassword').value;
    const code = document.getElementById('disableMfaCode').value;

    try {
        const response = await fetch(`${API_BASE_URL}/mfa/disable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api.getToken()}`
            },
            body: JSON.stringify({
                password: password,
                token: code
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to disable MFA');
        }

        alertDiv.innerHTML = `
            <div class="alert alert-success">
                <i class="bi bi-check-circle"></i> MFA disabled successfully
            </div>
        `;

        setTimeout(() => {
            initMFASettings();
        }, 2000);

    } catch (error) {
        alertDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> ${error.message}
            </div>
        `;
    }
}

function mfaCopyBackupCodes() {
    const display = document.getElementById('backupCodesDisplay');
    const text = display.innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Backup codes copied to clipboard');
    }).catch(() => {
        alert('Failed to copy to clipboard');
    });
}
