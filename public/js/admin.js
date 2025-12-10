let currentAdminTab = 'users';

function renderAdmin() {
    return `
        <div class="container mt-4">
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-gear"></i> Admin Portal</h5>
                        </div>
                        <div class="card-body">
                            <ul class="nav nav-tabs mb-3">
                                <li class="nav-item">
                                    <a class="nav-link active" href="#" onclick="switchAdminTab('users')">
                                        <i class="bi bi-people"></i> Users
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" href="#" onclick="switchAdminTab('submissions')">
                                        <i class="bi bi-file-earmark-text"></i> Submissions
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" href="#" onclick="switchAdminTab('hours-report')">
                                        <i class="bi bi-bar-chart"></i> Hours Report
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" href="#" onclick="switchAdminTab('smtp')">
                                        <i class="bi bi-envelope"></i> SMTP Settings
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" href="#" onclick="switchAdminTab('branding')">
                                        <i class="bi bi-palette"></i> Branding
                                    </a>
                                </li>
                            </ul>
                            <div id="adminContent"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initAdmin() {
    currentAdminTab = 'users';
    await loadAdminUsers();
}

function switchAdminTab(tab) {
    currentAdminTab = tab;
    
    // Update active tab
    document.querySelectorAll('.nav-tabs .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.closest('.nav-link').classList.add('active');

    // Load content
    if (tab === 'users') loadAdminUsers();
    else if (tab === 'submissions') loadAdminSubmissions();
    else if (tab === 'hours-report') loadHoursReport();
    else if (tab === 'smtp') loadSMTPSettings();
    else if (tab === 'branding') loadBrandingSettings();
}

async function loadAdminUsers() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';

    try {
        const users = await api.getUsers();
        renderAdminUsers(users);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderAdminUsers(users) {
    const container = document.getElementById('adminContent');
    
    container.innerHTML = `
        <div class="mb-3">
            <button class="btn btn-primary" onclick="showAddUserModal()">
                <i class="bi bi-plus-circle"></i> Add User
            </button>
        </div>
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Full Name</th>
                        <th>Role</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => {
                        const role = user.role || (user.is_admin ? 'admin' : 'user');
                        let badgeClass = 'bg-secondary';
                        if (role === 'admin') badgeClass = 'bg-danger';
                        else if (role === 'user') badgeClass = 'bg-primary';
                        else if (role === 'reader') badgeClass = 'bg-info';
                        
                        return `
                            <tr>
                                <td>${user.id}</td>
                                <td>${user.username}</td>
                                <td>${user.full_name}</td>
                                <td><span class="badge ${badgeClass}">${role.charAt(0).toUpperCase() + role.slice(1)}</span></td>
                                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <!-- Add User Modal -->
        <div class="modal fade" id="addUserModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Add New User</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div id="addUserAlert"></div>
                        <form id="addUserForm">
                            <div class="mb-3">
                                <label class="form-label">Username</label>
                                <input type="text" class="form-control" id="newUsername" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Full Name</label>
                                <input type="text" class="form-control" id="newFullName" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Password</label>
                                <input type="password" class="form-control" id="newPassword" required minlength="6">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Role</label>
                                <select class="form-select" id="newRole" required>
                                    <option value="user">User (Can submit timesheets)</option>
                                    <option value="reader">Reader (View only)</option>
                                    <option value="admin">Admin (Full access)</option>
                                </select>
                                <small class="text-muted">
                                    • User: Can add rows, submit timesheets, manage SMTP settings<br>
                                    • Reader: Can only view history, no edits allowed<br>
                                    • Admin: Can access all submissions, view all users, manage system
                                </small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitAddUser()">Create User</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showAddUserModal() {
    // Clear the form
    document.getElementById('newUsername').value = '';
    document.getElementById('newFullName').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newRole').value = 'user';
    document.getElementById('addUserAlert').innerHTML = '';
    
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

async function submitAddUser() {
    const username = document.getElementById('newUsername').value.trim();
    const fullName = document.getElementById('newFullName').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const alertDiv = document.getElementById('addUserAlert');

    // Validation
    if (!username || !fullName || !password || !role) {
        alertDiv.innerHTML = `<div class="alert alert-warning">Please fill in all fields</div>`;
        return;
    }

    if (password.length < 6) {
        alertDiv.innerHTML = `<div class="alert alert-warning">Password must be at least 6 characters</div>`;
        return;
    }

    try {
        console.log('Submitting user creation:', { username, fullName, role });
        alertDiv.innerHTML = `<div class="alert alert-info">Creating user...</div>`;
        
        const result = await api.createUser({ username, fullName, password, role });
        console.log('User created successfully:', result);
        
        alertDiv.innerHTML = `<div class="alert alert-success">User created successfully! Reloading...</div>`;
        
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
            if (modal) {
                modal.hide();
            }
            loadAdminUsers();
        }, 1500);
    } catch (error) {
        console.error('Error creating user:', error);
        alertDiv.innerHTML = `<div class="alert alert-danger"><strong>Error:</strong> ${error.message}</div>`;
    }
}

async function deleteUser(id, username) {
    if (!confirm(`Delete user "${username}"?`)) return;

    try {
        await api.deleteUser(id);
        loadAdminUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function loadAdminSubmissions() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';

    try {
        const submissions = await api.getAdminSubmissions();
        const users = await api.getUsers();
        renderAdminSubmissions(submissions, users);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderAdminSubmissions(submissions, users) {
    const container = document.getElementById('adminContent');

    if (submissions.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No submissions yet</div>';
        return;
    }

    // Store all submissions globally for filtering
    window.allSubmissions = submissions;

    container.innerHTML = `
        <div class="mb-3">
            <label class="form-label">Filter by User:</label>
            <select class="form-select" id="submissionUserFilter" onchange="filterAdminSubmissions()">
                <option value="">All Users</option>
                ${users.map(u => `<option value="${u.id}">${u.full_name} (${u.username})</option>`).join('')}
            </select>
        </div>
        <div id="submissionsTableContainer">
            ${renderSubmissionsTable(submissions)}
        </div>
    `;
}

function renderSubmissionsTable(submissions) {
    if (submissions.length === 0) {
        return '<div class="alert alert-info">No submissions found for this filter</div>';
    }

    return `
        <div class="table-responsive">
            <table class="table table-striped table-sm">
                <thead>
                    <tr>
                        <th style="width: 50px;">ID</th>
                        <th style="width: 180px;">User</th>
                        <th style="width: 150px;">Date</th>
                        <th style="width: 70px;">Entries</th>
                        <th style="width: 80px;">Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${submissions.map(sub => `
                        <tr>
                            <td>${sub.id}</td>
                            <td>
                                <div class="small">${sub.full_name}</div>
                                <small class="text-muted">${sub.username}</small>
                            </td>
                            <td class="small">${new Date(sub.submission_date).toLocaleString('nl-NL', {dateStyle: 'short', timeStyle: 'short'})}</td>
                            <td class="text-center">${sub.timesheet_ids ? sub.timesheet_ids.split(',').length : 0}</td>
                            <td><span class="badge bg-success">${sub.status}</span></td>
                            <td>
                                <div class="btn-group" role="group">
                                    <button class="btn btn-sm btn-warning" onclick="showEditSubmissionModal(${sub.id}); return false;">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-sm btn-info" onclick="viewAdminSubmissionPDF(${sub.id}); return false;">
                                        <i class="bi bi-file-pdf"></i>
                                    </button>
                                    <button class="btn btn-sm btn-success" onclick="downloadAdminSubmissionXLSX(${sub.id}); return false;">
                                        <i class="bi bi-file-earmark-excel"></i>
                                    </button>
                                    <button class="btn btn-sm btn-primary" onclick="showSendEmailModal(${sub.id}); return false;">
                                        <i class="bi bi-envelope"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteAdminSubmission(${sub.id}); return false;">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function filterAdminSubmissions() {
    const userId = document.getElementById('submissionUserFilter').value;
    const filtered = userId ? window.allSubmissions.filter(s => s.user_id == userId) : window.allSubmissions;
    document.getElementById('submissionsTableContainer').innerHTML = renderSubmissionsTable(filtered);
}

async function viewAdminSubmissionPDF(submissionId) {
    try {
        const blob = await api.getAdminSubmissionPDF(submissionId);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (error) {
        alert('Failed to load PDF: ' + error.message);
    }
}

async function downloadAdminSubmissionXLSX(submissionId) {
    try {
        const blob = await api.getAdminSubmissionXLSX(submissionId);
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

async function deleteAdminSubmission(submissionId) {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
        return;
    }

    try {
        await api.deleteSubmission(submissionId);
        alert('Submission deleted successfully');
        await loadAdminSubmissions();
    } catch (error) {
        alert('Failed to delete submission: ' + error.message);
    }
}

function showSendEmailModal(submissionId) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('sendEmailModal');
    if (!modal) {
        createSendEmailModal();
    }
    
    // Store current submission ID
    window.currentEmailSubmissionId = submissionId;
    
    // Show modal
    const sendEmailModal = new bootstrap.Modal(document.getElementById('sendEmailModal'));
    sendEmailModal.show();
}

function createSendEmailModal() {
    const modalHtml = `
        <div class="modal fade" id="sendEmailModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="bi bi-envelope"></i> Send Submission via Email</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div id="sendEmailAlert"></div>
                        <div class="mb-3">
                            <label for="emailRecipient" class="form-label">Send to:</label>
                            <input type="email" class="form-control" id="emailRecipient" 
                                   placeholder="recipient@example.com" required>
                            <small class="text-muted">Leave empty to use default email from SMTP settings</small>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">File format:</label>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="fileFormat" id="formatPDF" value="pdf">
                                <label class="form-check-label" for="formatPDF">
                                    <i class="bi bi-file-pdf text-danger"></i> PDF
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="fileFormat" id="formatExcel" value="excel" checked>
                                <label class="form-check-label" for="formatExcel">
                                    <i class="bi bi-file-earmark-excel text-success"></i> Excel
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="sendSubmissionEmail()">
                            <i class="bi bi-send"></i> Send Email
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function sendSubmissionEmail() {
    const submissionId = window.currentEmailSubmissionId;
    const recipient = document.getElementById('emailRecipient').value.trim();
    const format = document.querySelector('input[name="fileFormat"]:checked').value;
    
    const alertDiv = document.getElementById('sendEmailAlert');
    alertDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-hourglass-split"></i> Sending email...</div>';
    
    try {
        await api.sendCustomSubmissionEmail(submissionId, recipient, format);
        
        alertDiv.innerHTML = '<div class="alert alert-success"><i class="bi bi-check-circle"></i> Email sent successfully!</div>';
        
        setTimeout(() => {
            bootstrap.Modal.getInstance(document.getElementById('sendEmailModal')).hide();
            alertDiv.innerHTML = '';
        }, 2000);
        
    } catch (error) {
        alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
    }
}

async function loadSMTPSettings() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';

    try {
        const settings = await api.getSMTPSettings();
        renderSMTPSettings(settings);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderSMTPSettings(settings) {
    const container = document.getElementById('adminContent');
    const authType = settings.auth_type || 'basic';

    container.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <div id="smtpAlert"></div>
                <form id="smtpForm">
                    <div class="mb-3">
                        <label class="form-label">Authentication Type</label>
                        <select class="form-select" id="auth_type" onchange="toggleAuthFields()">
                            <option value="basic" ${authType === 'basic' ? 'selected' : ''}>Basic Auth (Username & Password)</option>
                            <option value="oauth2" ${authType === 'oauth2' ? 'selected' : ''}>Microsoft 365 OAuth2 (Recommended)</option>
                        </select>
                        <small class="text-muted">OAuth2 is more secure and doesn't require app passwords</small>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">SMTP Host</label>
                        <input type="text" class="form-control" id="smtp_host" 
                               value="${settings.smtp_host || 'smtp.office365.com'}" required>
                        <small class="text-muted">For Microsoft Exchange Online: smtp.office365.com</small>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">SMTP Port</label>
                        <input type="number" class="form-control" id="smtp_port" 
                               value="${settings.smtp_port || 587}" required>
                        <small class="text-muted">Usually 587 for TLS or 465 for SSL</small>
                    </div>
                    
                    <div class="mb-3">
                        <div class="form-check">
                            <input type="checkbox" class="form-check-input" id="smtp_secure" 
                                   ${settings.smtp_secure ? 'checked' : ''}>
                            <label class="form-check-label" for="smtp_secure">
                                Use SSL/TLS (port 465)
                            </label>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Email Address</label>
                        <input type="email" class="form-control" id="smtp_user" 
                               value="${settings.smtp_user || ''}" required>
                        <small class="text-muted">Your Microsoft 365 email address</small>
                    </div>

                    <!-- Basic Auth Fields -->
                    <div id="basicAuthFields" class="${authType === 'basic' ? '' : 'd-none'}">
                        <div class="mb-3">
                            <label class="form-label">Password</label>
                            <input type="password" class="form-control" id="smtp_pass" 
                                   placeholder="Leave blank to keep current password">
                            <small class="text-muted">For 2FA users: Use your app-specific password</small>
                        </div>
                    </div>

                    <!-- OAuth2 Fields -->
                    <div id="oauth2Fields" class="${authType === 'oauth2' ? '' : 'd-none'}">
                        <div class="alert alert-info small">
                            <strong>Setup Guide:</strong> 
                            <ol class="mb-0 ps-3">
                                <li>Sign in to Azure Portal (portal.azure.com)</li>
                                <li>Go to "App registrations" → Create new app</li>
                                <li>Add Certificates & secrets → Create client secret</li>
                                <li>Grant permissions: Mail.Send</li>
                                <li>Copy your Tenant ID, Client ID, and Client Secret below</li>
                            </ol>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Azure Tenant ID</label>
                            <input type="text" class="form-control" id="oauth_tenant_id" 
                                   value="${settings.oauth_tenant_id || ''}"
                                   placeholder="e.g., 12345678-1234-1234-1234-123456789012">
                            <small class="text-muted">Also called Directory ID</small>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Client ID</label>
                            <input type="text" class="form-control" id="oauth_client_id" 
                                   value="${settings.oauth_client_id || ''}"
                                   placeholder="Application (client) ID from Azure">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Client Secret</label>
                            <input type="password" class="form-control" id="oauth_client_secret" 
                                   placeholder="Leave blank to keep current secret">
                            <small class="text-muted">Only shown once in Azure Portal - copy it immediately</small>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">OAuth Scope</label>
                            <input type="text" class="form-control" id="oauth_scope" 
                                   value="${settings.oauth_scope || 'https://outlook.office365.com/.default'}">
                            <small class="text-muted">Default scope for Microsoft 365</small>
                        </div>
                    </div>

                    <hr />

                    <div class="mb-3">
                        <label class="form-label">From Email Address</label>
                        <input type="email" class="form-control" id="email_from" 
                               value="${settings.email_from || ''}" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">To Email Address</label>
                        <input type="email" class="form-control" id="email_to" 
                               value="${settings.email_to || 'info@eutransport.nl'}" required>
                        <small class="text-muted">Timesheets will be sent to this address</small>
                    </div>
                    
                    <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-save"></i> Save SMTP Settings
                        </button>
                        <button type="button" class="btn btn-success" onclick="testSMTP()">
                            <i class="bi bi-envelope-check"></i> Test Connection
                        </button>
                    </div>
                </form>
            </div>
            <div class="col-md-4">
                <div class="card bg-light">
                    <div class="card-body">
                        <h6 class="card-title"><i class="bi bi-lock"></i> Recommended Setup</h6>
                        <p class="small"><strong>Use OAuth2</strong> for better security:</p>
                        <ul class="small ps-3">
                            <li>No password storage</li>
                            <li>Works with 2FA enabled</li>
                            <li>Can be revoked anytime</li>
                            <li>Fine-grained permissions</li>
                        </ul>
                        <hr />
                        <h6 class="card-title"><i class="bi bi-shield-check"></i> Quick Setup</h6>
                        <ul class="small ps-3">
                            <li><strong>Host:</strong> smtp.office365.com</li>
                            <li><strong>Port:</strong> 587</li>
                            <li><strong>Security:</strong> TLS</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <script>
            function toggleAuthFields() {
                const authType = document.getElementById('auth_type').value;
                document.getElementById('basicAuthFields').classList.toggle('d-none', authType !== 'basic');
                document.getElementById('oauth2Fields').classList.toggle('d-none', authType !== 'oauth2');
            }
        </script>
    `;

    document.getElementById('smtpForm').addEventListener('submit', saveSMTPSettings);
}

async function saveSMTPSettings(e) {
    e.preventDefault();

    const authType = document.getElementById('auth_type').value;

    const data = {
        smtp_host: document.getElementById('smtp_host').value,
        smtp_port: parseInt(document.getElementById('smtp_port').value),
        smtp_secure: document.getElementById('smtp_secure').checked,
        smtp_user: document.getElementById('smtp_user').value,
        email_from: document.getElementById('email_from').value,
        email_to: document.getElementById('email_to').value,
        auth_type: authType
    };

    // Add SMTP password if provided (basic auth)
    const passwordField = document.getElementById('smtp_pass');
    if (passwordField && passwordField.value) {
        data.smtp_pass = passwordField.value;
    }

    // Add OAuth2 fields if using OAuth
    if (authType === 'oauth2') {
        data.oauth_tenant_id = document.getElementById('oauth_tenant_id').value;
        data.oauth_client_id = document.getElementById('oauth_client_id').value;
        data.oauth_scope = document.getElementById('oauth_scope').value || 'https://outlook.office365.com/.default';
        
        const clientSecret = document.getElementById('oauth_client_secret');
        if (clientSecret && clientSecret.value) {
            data.oauth_client_secret = clientSecret.value;
        }

        // Validate required fields for OAuth
        if (!data.oauth_tenant_id || !data.oauth_client_id) {
            const alertDiv = document.getElementById('smtpAlert');
            alertDiv.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show">
                    <i class="bi bi-exclamation-triangle"></i> Tenant ID and Client ID are required for OAuth2
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            return;
        }
    }

    const alertDiv = document.getElementById('smtpAlert');

    try {
        await api.updateSMTPSettings(data);
        alertDiv.innerHTML = `
            <div class="alert alert-success alert-dismissible fade show">
                SMTP settings saved successfully!
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        // Clear password fields
        if (document.getElementById('smtp_pass')) {
            document.getElementById('smtp_pass').value = '';
        }
        if (document.getElementById('oauth_client_secret')) {
            document.getElementById('oauth_client_secret').value = '';
        }
    } catch (error) {
        alertDiv.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show">
                ${error.message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

async function testSMTP() {
    const alertDiv = document.getElementById('smtpAlert');
    
    alertDiv.innerHTML = `
        <div class="alert alert-info">
            <i class="bi bi-hourglass-split"></i> Testing SMTP connection and sending test email...
        </div>
    `;

    try {
        const result = await api.testSMTP();
        alertDiv.innerHTML = `
            <div class="alert alert-success alert-dismissible fade show">
                <i class="bi bi-check-circle"></i> ${result.message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    } catch (error) {
        alertDiv.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show">
                <i class="bi bi-x-circle"></i> ${error.message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

// Hours Report Functions
async function loadHoursReport() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';

    try {
        const users = await api.getUsers();
        const report = await api.getHoursReport();
        renderHoursReport(users, report);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderHoursReport(users, report) {
    const container = document.getElementById('adminContent');
    
    container.innerHTML = `
        <div class="mb-3">
            <label class="form-label">Filter by User:</label>
            <select class="form-select" id="userFilter" onchange="filterHoursReport()">
                <option value="">All Users</option>
                ${users.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('')}
            </select>
        </div>
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Week Number</th>
                        <th>Work Days</th>
                        <th>Total Hours</th>
                        <th>Overworked</th>
                    </tr>
                </thead>
                <tbody id="hoursReportTableBody">
                    ${renderHoursReportRows(report)}
                </tbody>
            </table>
        </div>
    `;
}

function renderHoursReportRows(report) {
    if (report.length === 0 || !report[0].week_number) {
        return '<tr><td colspan="5" class="text-center text-muted">No hours data available</td></tr>';
    }
    
    return report.map(row => {
        const overworkedClass = parseFloat(row.overworked) > 0 ? 'text-danger fw-bold' : 
                               parseFloat(row.overworked) < 0 ? 'text-success' : '';
        return `
            <tr>
                <td>${row.full_name}</td>
                <td>Week ${row.week_number || '-'}</td>
                <td>${row.work_days || 0}</td>
                <td>${row.total_hours}h</td>
                <td class="${overworkedClass}">
                    ${parseFloat(row.overworked) > 0 ? '+' : ''}${row.overworked}h
                </td>
            </tr>
        `;
    }).join('');
}

async function filterHoursReport() {
    const userId = document.getElementById('userFilter').value;
    try {
        const report = await api.getHoursReport(userId);
        document.getElementById('hoursReportTableBody').innerHTML = renderHoursReportRows(report);
    } catch (error) {
        document.getElementById('hoursReportTableBody').innerHTML = 
            `<tr><td colspan="5" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

// Branding Settings Functions
async function loadBrandingSettings() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';

    try {
        const settings = await api.getBrandingSettings();
        renderBrandingSettings(settings);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderBrandingSettings(settings) {
    const container = document.getElementById('adminContent');
    
    container.innerHTML = `
        <div id="brandingAlert"></div>
        <form id="brandingForm">
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Company Name</label>
                        <input type="text" class="form-control" id="company_name" 
                            value="${settings.company_name || 'Timesheet System'}" required>
                        <small class="text-muted">This will appear on the login page and navigation</small>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Login Page Tagline</label>
                        <input type="text" class="form-control" id="tagline" 
                            value="${settings.tagline || 'Please sign in to continue'}">
                        <small class="text-muted">Text shown below company name on login page</small>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Primary Color</label>
                        <input type="color" class="form-control form-control-color" id="primary_color" 
                            value="${settings.primary_color || '#0066CC'}">
                        <small class="text-muted">Main theme color for the application</small>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Current Logo</label>
                        <div class="border rounded p-3 bg-light">
                            ${settings.logo_path ? 
                                `<img src="${settings.logo_path}" alt="Company Logo" style="max-height: 100px; max-width: 100%;">` :
                                `<p class="text-muted mb-0"><i class="bi bi-image"></i> No logo uploaded</p>`
                            }
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Upload New Logo</label>
                        <input type="file" class="form-control" id="logo_file" accept="image/*">
                        <small class="text-muted">Supported formats: JPG, PNG, GIF, SVG (Max 5MB)</small>
                    </div>

                    <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-save"></i> Save Settings
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="uploadLogo()">
                            <i class="bi bi-upload"></i> Upload Logo Only
                        </button>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title"><i class="bi bi-info-circle"></i> Preview</h6>
                            <p class="mb-2"><strong>Company Name:</strong> <span id="preview_name">${settings.company_name || 'Timesheet System'}</span></p>
                            <p class="mb-2"><strong>Primary Color:</strong> 
                                <span class="badge" id="preview_color" style="background-color: ${settings.primary_color || '#0066CC'}">
                                    ${settings.primary_color || '#0066CC'}
                                </span>
                            </p>
                            <hr>
                            <small class="text-muted">
                                <i class="bi bi-lightbulb"></i> <strong>Tips:</strong><br>
                                • Logo should be a square or rectangular image<br>
                                • Recommended size: 200x200px or larger<br>
                                • PNG format with transparency works best<br>
                                • Changes will be visible after page refresh
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    `;

    // Add event listeners for live preview
    document.getElementById('company_name').addEventListener('input', (e) => {
        document.getElementById('preview_name').textContent = e.target.value;
    });

    document.getElementById('primary_color').addEventListener('input', (e) => {
        const colorBadge = document.getElementById('preview_color');
        colorBadge.style.backgroundColor = e.target.value;
        colorBadge.textContent = e.target.value;
    });

    document.getElementById('brandingForm').addEventListener('submit', saveBrandingSettings);
}

async function saveBrandingSettings(e) {
    e.preventDefault();

    const data = {
        company_name: document.getElementById('company_name').value,
        primary_color: document.getElementById('primary_color').value,
        tagline: document.getElementById('tagline').value
    };

    const alertDiv = document.getElementById('brandingAlert');

    try {
        await api.updateBrandingSettings(data);
        alertDiv.innerHTML = `
            <div class="alert alert-success alert-dismissible fade show">
                <i class="bi bi-check-circle"></i> Branding settings saved successfully! Refresh the page to see changes.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    } catch (error) {
        alertDiv.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show">
                <i class="bi bi-exclamation-triangle"></i> ${error.message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

// Edit Submission Modal and Functions
let currentEditSubmissionId = null;

function showEditSubmissionModal(submissionId) {
    currentEditSubmissionId = submissionId;
    
    const modal = document.getElementById('editSubmissionModal');
    if (!modal) {
        // Create modal if it doesn't exist
        createEditSubmissionModal();
    }
    
    // Fetch submission details and load form
    loadEditSubmissionData(submissionId);
    
    const editModal = new bootstrap.Modal(document.getElementById('editSubmissionModal'));
    editModal.show();
}

function createEditSubmissionModal() {
    const modalHtml = `
        <div class="modal fade" id="editSubmissionModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Edit Submission Timesheets</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <div id="editSubmissionAlert"></div>
                        <div class="mb-3">
                            <div class="row">
                                <div class="col-md-4">
                                    <strong>Submission ID:</strong> <span id="editSubmissionId"></span>
                                </div>
                                <div class="col-md-4">
                                    <strong>User:</strong> <span id="editSubmissionUser"></span>
                                </div>
                                <div class="col-md-4">
                                    <strong>Date:</strong> <span id="editSubmissionDate"></span>
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div id="editTimesheetsList">
                            <div class="text-center">
                                <div class="spinner-border text-primary"></div>
                                <p>Loading timesheets...</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitEditSubmission()">Save All Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function loadEditSubmissionData(submissionId) {
    try {
        const submissions = await api.getAdminSubmissions();
        const submission = submissions.find(s => s.id === submissionId);
        
        if (!submission) {
            alert('Submission not found');
            return;
        }
        
        document.getElementById('editSubmissionId').textContent = submission.id;
        document.getElementById('editSubmissionUser').textContent = `${submission.full_name} (${submission.username})`;
        document.getElementById('editSubmissionDate').textContent = new Date(submission.submission_date).toLocaleString();
        
        // Load individual timesheets
        const timesheets = await api.getSubmissionTimesheets(submissionId);
        renderEditableTimesheets(timesheets);
    } catch (error) {
        const alertDiv = document.getElementById('editSubmissionAlert');
        alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderEditableTimesheets(timesheets) {
    const container = document.getElementById('editTimesheetsList');
    
    if (!timesheets || timesheets.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No timesheets found</div>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th style="width: 60px;">Week</th>
                        <th style="width: 80px;">Ritnr</th>
                        <th style="width: 120px;">Date</th>
                        <th style="width: 80px;">Start</th>
                        <th style="width: 80px;">End</th>
                        <th style="width: 90px;">Start KM</th>
                        <th style="width: 90px;">End KM</th>
                        <th style="width: 80px;">Pause</th>
                        <th style="width: 80px;">Hours</th>
                        <th style="width: 70px;">KM</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    timesheets.forEach((ts, index) => {
        const totalHours = parseFloat(ts.total_hours || 0).toFixed(2);
        const totalKm = parseFloat(ts.total_km || 0).toFixed(2);
        
        html += `
            <tr>
                <td><input type="number" class="form-control form-control-sm" value="${ts.week_number}" 
                    onchange="updateEditTimesheet(${index}, 'week_number', this.value)" readonly></td>
                <td><input type="text" class="form-control form-control-sm" value="${ts.ritnumber || ''}" 
                    onchange="updateEditTimesheet(${index}, 'ritnumber', this.value)"></td>
                <td><input type="date" class="form-control form-control-sm" value="${ts.date}" 
                    onchange="updateEditTimesheet(${index}, 'date', this.value)"></td>
                <td><input type="time" class="form-control form-control-sm" value="${ts.start_time}" 
                    onchange="updateEditTimesheet(${index}, 'start_time', this.value)"></td>
                <td><input type="time" class="form-control form-control-sm" value="${ts.end_time}" 
                    onchange="updateEditTimesheet(${index}, 'end_time', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm" value="${ts.start_km}" step="0.1"
                    onchange="updateEditTimesheet(${index}, 'start_km', parseFloat(this.value))"></td>
                <td><input type="number" class="form-control form-control-sm" value="${ts.end_km}" step="0.1"
                    onchange="updateEditTimesheet(${index}, 'end_km', parseFloat(this.value))"></td>
                <td><input type="time" class="form-control form-control-sm" value="${ts.pause_time}" 
                    onchange="updateEditTimesheet(${index}, 'pause_time', this.value)"></td>
                <td><input type="text" class="form-control form-control-sm" value="${totalHours}" readonly></td>
                <td><input type="text" class="form-control form-control-sm" value="${totalKm}" readonly></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <small class="text-muted">
            <i class="bi bi-info-circle"></i> Edit the fields above to update timesheet entries. 
            Hours and KM are auto-calculated. Click "Save All Changes" to apply.
        </small>
    `;
    
    container.innerHTML = html;
    
    // Store timesheets in global variable for editing
    window.editingTimesheets = JSON.parse(JSON.stringify(timesheets));
}

function updateEditTimesheet(index, field, value) {
    if (!window.editingTimesheets) return;
    
    window.editingTimesheets[index][field] = value;
    
    // Recalculate if needed
    const ts = window.editingTimesheets[index];
    if (field === 'start_time' || field === 'end_time' || field === 'pause_time') {
        ts.total_hours = calculateHours(ts.start_time, ts.end_time, ts.pause_time);
    }
    if (field === 'start_km' || field === 'end_km') {
        ts.total_km = (parseFloat(ts.end_km) - parseFloat(ts.start_km)).toFixed(2);
    }
    if (field === 'date') {
        ts.week_number = getWeekNumber(new Date(value));
    }
    
    // Re-render to update calculated fields
    renderEditableTimesheets(window.editingTimesheets);
}

function calculateHours(startTime, endTime, pauseTime) {
    if (!startTime || !endTime || !pauseTime) return '0.00';
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const [pauseHour, pauseMinute] = pauseTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const pauseMinutes = pauseHour * 60 + pauseMinute;
    
    const totalMinutes = endMinutes - startMinutes - pauseMinutes;
    return (totalMinutes / 60).toFixed(2);
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function submitEditSubmission() {
    const alertDiv = document.getElementById('editSubmissionAlert');
    
    if (!window.editingTimesheets || window.editingTimesheets.length === 0) {
        alertDiv.innerHTML = `<div class="alert alert-warning">No timesheets to save</div>`;
        return;
    }
    
    try {
        alertDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-hourglass-split"></i> Saving changes...</div>';
        
        // Update each timesheet
        for (const ts of window.editingTimesheets) {
            await api.updateAdminTimesheet(ts.id, {
                date: ts.date,
                startTime: ts.start_time,
                endTime: ts.end_time,
                startKm: parseFloat(ts.start_km),
                endKm: parseFloat(ts.end_km),
                pauseTime: ts.pause_time,
                ritnumber: ts.ritnumber || ''
            });
        }
        
        alertDiv.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle"></i> All changes saved successfully!</div>`;
        setTimeout(() => {
            bootstrap.Modal.getInstance(document.getElementById('editSubmissionModal')).hide();
            loadAdminSubmissions();
        }, 1500);
    } catch (error) {
        alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
    }
}
async function uploadLogo() {
    const fileInput = document.getElementById('logo_file');
    const alertDiv = document.getElementById('brandingAlert');

    if (!fileInput.files || !fileInput.files[0]) {
        alertDiv.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show">
                <i class="bi bi-exclamation-triangle"></i> Please select a logo file first
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        return;
    }

    const formData = new FormData();
    formData.append('logo', fileInput.files[0]);

    try {
        const result = await api.uploadLogo(formData);
        alertDiv.innerHTML = `
            <div class="alert alert-success alert-dismissible fade show">
                <i class="bi bi-check-circle"></i> Logo uploaded successfully! Refresh the page to see changes.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        // Reload to show new logo
        setTimeout(() => loadBrandingSettings(), 1000);
    } catch (error) {
        alertDiv.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show">
                <i class="bi bi-exclamation-triangle"></i> ${error.message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}
