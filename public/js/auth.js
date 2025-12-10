async function renderLogin() {
    // Fetch branding settings
    let branding = { company_name: 'Timesheet System', logo_path: null, primary_color: '#0066CC', tagline: 'Please sign in to continue' };
    try {
        branding = await api.getPublicBranding();
        if (!branding.tagline) branding.tagline = 'Please sign in to continue';
    } catch (error) {
        console.log('Using default branding');
    }

    return `
        <div class="login-container">
            <div class="login-card card">
                <div class="login-header">
                    ${branding.logo_path ? 
                        `<img src="${branding.logo_path}" alt="${branding.company_name}" style="max-height: 80px; max-width: 200px; margin-bottom: 15px;">` :
                        `<h2><i class="bi bi-calendar-check"></i></h2>`
                    }
                    <h4>${branding.company_name || 'Timesheet System'}</h4>
                    <p class="mb-0">${branding.tagline}</p>
                </div>
                <div class="login-body">
                    <div id="loginAlert"></div>
                    <form id="loginForm">
                        <div class="mb-3">
                            <label class="form-label">Username</label>
                            <input type="text" class="form-control" id="username" required autocomplete="username">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" required autocomplete="current-password">
                        </div>
                        <button type="submit" class="btn btn-primary w-100">
                            <i class="bi bi-box-arrow-in-right"></i> Sign In
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
}

function initLogin() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const alertDiv = document.getElementById('loginAlert');

        try {
            const response = await api.login(username, password);
            api.setToken(response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            window.location.reload();
        } catch (error) {
            alertDiv.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show">
                    <i class="bi bi-exclamation-triangle"></i> ${error.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
    });
}

function renderChangePassword() {
    return `
        <div class="container mt-4">
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-key"></i> Change Password</h5>
                        </div>
                        <div class="card-body">
                            <div id="changePasswordAlert"></div>
                            <form id="changePasswordForm">
                                <div class="mb-3">
                                    <label class="form-label">Current Password</label>
                                    <input type="password" class="form-control" id="currentPassword" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">New Password</label>
                                    <input type="password" class="form-control" id="newPassword" required minlength="6">
                                    <small class="text-muted">Minimum 6 characters</small>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Confirm New Password</label>
                                    <input type="password" class="form-control" id="confirmPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-check-circle"></i> Change Password
                                </button>
                                <button type="button" class="btn btn-secondary" onclick="app.loadPage('dashboard')">
                                    Cancel
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initChangePassword() {
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const alertDiv = document.getElementById('changePasswordAlert');

        if (newPassword !== confirmPassword) {
            alertDiv.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show">
                    Passwords do not match
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            return;
        }

        try {
            await api.changePassword(currentPassword, newPassword);
            alertDiv.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show">
                    Password changed successfully!
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            document.getElementById('changePasswordForm').reset();
        } catch (error) {
            alertDiv.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show">
                    ${error.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
    });
}
