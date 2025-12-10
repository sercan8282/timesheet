let currentAdminTab = 'users';
let currentHoursReportPage = 1;
let currentHoursReportUserId = null;

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
    else if (tab === 'hours-report') loadHoursReport(1);
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
        renderAdminSubmissions(submissions);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderAdminSubmissions(submissions) {
    const container = document.getElementById('adminContent');

    if (submissions.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No submissions yet</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Submission Date</th>
                        <th>Entries</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${submissions.map(sub => `
                        <tr>
                            <td>${sub.id}</td>
                            <td>
                                <div>${sub.full_name} (${sub.username})</div>
                                <small class="text-muted">${sub.user_name || 'N/A'}</small>
                            </td>
                            <td>${new Date(sub.submission_date).toLocaleString()}</td>
                            <td>${sub.timesheet_ids ? sub.timesheet_ids.split(',').length : 0}</td>
                            <td><span class="badge bg-success">${sub.status}</span></td>
                            <td>
                                <div class="btn-group" role="group">
                                    <button class="btn btn-sm btn-warning" onclick="showEditSubmissionModal(${sub.id})">
                                        <i class="bi bi-pencil"></i> Edit
                                    </button>
                                    <button class="btn btn-sm btn-info" onclick="viewAdminSubmissionPDF(${sub.id})">
                                        <i class="bi bi-file-pdf"></i> PDF
                                    </button>
                                    <button class="btn btn-sm btn-success" onclick="downloadAdminSubmissionXLSX(${sub.id})">
                                        <i class="bi bi-file-earmark-excel"></i> Excel
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteAdminSubmission(${sub.id})">
                                        <i class="bi bi-trash"></i> Delete
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
        <div class="modal fade" id="editSubmissionModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Edit Submission</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div id="editSubmissionAlert"></div>
                        <div class="mb-3">
                            <label class="form-label">Submission ID</label>
                            <input type="text" class="form-control" id="editSubmissionId" disabled>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">User</label>
                            <input type="text" class="form-control" id="editSubmissionUser" disabled>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Submission Date</label>
                            <input type="text" class="form-control" id="editSubmissionDate" disabled>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Timesheet IDs (comma-separated)</label>
                            <textarea class="form-control" id="editSubmissionTimesheetIds" rows="3" required></textarea>
                            <small class="text-muted">Enter the timesheet IDs separated by commas</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitEditSubmission()">Save Changes</button>
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
        
        document.getElementById('editSubmissionId').value = submission.id;
        document.getElementById('editSubmissionUser').value = `${submission.full_name} (${submission.username})`;
        document.getElementById('editSubmissionDate').value = new Date(submission.submission_date).toLocaleString();
        document.getElementById('editSubmissionTimesheetIds').value = submission.timesheet_ids;
    } catch (error) {
        const alertDiv = document.getElementById('editSubmissionAlert');
        alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

async function submitEditSubmission() {
    const submissionId = currentEditSubmissionId;
    const timesheetIds = document.getElementById('editSubmissionTimesheetIds').value.trim();
    const alertDiv = document.getElementById('editSubmissionAlert');
    
    if (!timesheetIds) {
        alertDiv.innerHTML = `<div class="alert alert-warning">Please enter at least one timesheet ID</div>`;
        return;
    }
    
    try {
        await api.updateSubmission(submissionId, {
            timesheet_ids: timesheetIds
        });
        
        alertDiv.innerHTML = `<div class="alert alert-success">Submission updated successfully</div>`;
        setTimeout(() => {
            bootstrap.Modal.getInstance(document.getElementById('editSubmissionModal')).hide();
            loadAdminSubmissions();
        }, 1000);
    } catch (error) {
        alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
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

// Hours Report Functions
async function loadHoursReport(page = 1, userId = null) {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';

    try {
        const data = await api.getHoursReport(page, userId);
        renderHoursReport(data);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
    }
}

function renderHoursReport(data) {
    const container = document.getElementById('adminContent');
    const { data: records, users, pagination } = data;

    let html = `
        <div class="mb-3">
            <div class="row">
                <div class="col-md-4">
                    <label class="form-label">Filter by Employee:</label>
                    <select class="form-select" id="userFilter" onchange="filterHoursReport()">
                        <option value="">All Employees</option>
    `;

    users.forEach(user => {
        html += `<option value="${user.id}">${user.full_name} (${user.username})</option>`;
    });

    html += `
                    </select>
                </div>
            </div>
        </div>

        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Employee</th>
                        <th>Week #</th>
                        <th>Date Range</th>
                        <th>Worked Hours</th>
                        <th>Expected Hours</th>
                        <th>Overworked</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (records.length === 0) {
        html += `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">No data available</td>
                </tr>
        `;
    } else {
        records.forEach(record => {
            const workingHours = record.workingHours || 40;
            const totalHours = record.totalHours || 0;
            const overworked = record.overworked || 0;

            // Calculate date range for the week
            const dateRange = getWeekDateRangeAdmin(record.weekNumber, new Date(record.weekStartDate).getFullYear());
            const startStr = dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const overworkedClass = overworked > 0 ? 'text-success' : '';
            const hoursStatus = totalHours >= workingHours ? 'text-success fw-bold' : totalHours < workingHours * 0.8 ? 'text-danger' : 'text-warning';

            html += `
                <tr>
                    <td><strong>${record.fullName}</strong><br><small class="text-muted">${record.username}</small></td>
                    <td>Week ${record.weekNumber}</td>
                    <td>${startStr} - ${endStr}</td>
                    <td class="${hoursStatus}">${totalHours.toFixed(2)}h</td>
                    <td>${workingHours}h</td>
                    <td class="${overworkedClass}">${overworked > 0 ? '+' : ''}${overworked.toFixed(2)}h</td>
                </tr>
            `;
        });
    }

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
                        <a class="page-link" href="#" onclick="loadHoursReport(1, getCurrentFilterUserId()); return false;">
                            <i class="bi bi-chevron-double-left"></i> First
                        </a>
                    </li>
                    <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="loadHoursReport(${pagination.page - 1}, getCurrentFilterUserId()); return false;">
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
                    <a class="page-link" href="#" onclick="loadHoursReport(${i}, getCurrentFilterUserId()); return false;">${i}</a>
                </li>
            `;
        }

        if (endPage < pagination.totalPages) {
            html += `<li class="page-item disabled"><a class="page-link">...</a></li>`;
        }

        html += `
                    <li class="page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="loadHoursReport(${pagination.page + 1}, getCurrentFilterUserId()); return false;">
                            Next <i class="bi bi-chevron-right"></i>
                        </a>
                    </li>
                    <li class="page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="loadHoursReport(${pagination.totalPages}, getCurrentFilterUserId()); return false;">
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
                Showing ${records.length} records (Page ${pagination.page} of ${pagination.totalPages}).
                Total records available: ${pagination.totalRecords}
            </small>
        </div>
    `;

    container.innerHTML = html;
    currentHoursReportPage = pagination.page;
}

function getCurrentFilterUserId() {
    const filter = document.getElementById('userFilter');
    return filter ? (filter.value ? parseInt(filter.value) : null) : null;
}

function filterHoursReport() {
    const userId = getCurrentFilterUserId();
    loadHoursReport(1, userId);
}

function getWeekDateRangeAdmin(weekNumber, year) {
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
