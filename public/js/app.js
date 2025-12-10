class App {
    constructor() {
        this.user = null;
        this.branding = null;
        this.init();
    }

    async init() {
        // Load branding first
        try {
            this.branding = await api.getPublicBranding();
            this.applyBranding();
        } catch (error) {
            console.log('Using default branding');
            this.branding = { company_name: 'Timesheet System', primary_color: '#0066CC' };
        }

        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
            this.user = JSON.parse(userStr);
            api.setToken(token);
            this.showApp();
            this.loadPage('dashboard');
        } else {
            this.showLogin();
        }
    }

    applyBranding() {
        if (!this.branding) return;

        // Update page title
        if (this.branding.company_name) {
            document.title = this.branding.company_name;
        }

        // Apply primary color to navbar
        if (this.branding.primary_color) {
            const navbar = document.getElementById('mainNav');
            if (navbar) {
                navbar.style.backgroundColor = this.branding.primary_color;
            }
        }

        // Update navbar brand
        const navbarBrand = document.querySelector('.navbar-brand');
        if (navbarBrand && this.branding.company_name) {
            if (this.branding.logo_path) {
                navbarBrand.innerHTML = `
                    <img src="${this.branding.logo_path}" alt="${this.branding.company_name}" 
                         style="height: 30px; margin-right: 8px;">
                    ${this.branding.company_name}
                `;
            } else {
                navbarBrand.innerHTML = `
                    <i class="bi bi-calendar-check"></i> ${this.branding.company_name}
                `;
            }
        }
    }

    async showLogin() {
        document.getElementById('mainNav').style.display = 'none';
        document.getElementById('app').innerHTML = await renderLogin();
        initLogin();
    }

    showApp() {
        document.getElementById('mainNav').style.display = 'block';
        document.getElementById('userName').textContent = this.user.fullName;

        // Show/hide admin menu
        if (this.user.isAdmin) {
            document.getElementById('nav-admin').style.display = 'block';
        } else {
            document.getElementById('nav-admin').style.display = 'none';
        }
    }

    loadPage(page) {
        // Update active nav
        document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const navItem = document.getElementById(`nav-${page}`);
        if (navItem) {
            navItem.querySelector('.nav-link').classList.add('active');
        }

        // Load page content
        switch (page) {
            case 'dashboard':
                document.getElementById('app').innerHTML = renderDashboard();
                initDashboard();
                break;
            case 'history':
                document.getElementById('app').innerHTML = renderHistory();
                initHistory();
                break;
            case 'weekly-hours':
                document.getElementById('app').innerHTML = renderWeeklySummary();
                initWeeklySummary();
                break;
            case 'admin':
                if (this.user.isAdmin) {
                    document.getElementById('app').innerHTML = renderAdmin();
                    initAdmin();
                } else {
                    alert('Access denied');
                }
                break;
            case 'change-password':
                document.getElementById('app').innerHTML = renderChangePassword();
                initChangePassword();
                break;
            default:
                this.loadPage('dashboard');
        }
    }

    logout() {
        showConfirmModal(
            'Logout',
            'Are you sure you want to logout?',
            () => {
                api.clearToken();
                localStorage.removeItem('user');
                this.user = null;
                this.showLogin();
            }
        );
    }
}

// Global confirmation modal system
let globalConfirmCallback = null;

function showConfirmModal(title, message, onConfirm, onCancel = null) {
    globalConfirmCallback = onConfirm;
    
    // Create or update modal
    let modal = document.getElementById('globalConfirmModal');
    if (!modal) {
        const modalHTML = `
            <div class="modal fade" id="globalConfirmModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="confirmModalTitle">
                                <i class="bi bi-question-circle text-warning"></i> Confirm
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="confirmModalMessage"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmModalConfirmBtn" onclick="executeConfirm()">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('globalConfirmModal');
    }
    
    // Update modal content
    document.getElementById('confirmModalTitle').innerHTML = `<i class="bi bi-question-circle text-warning"></i> ${title}`;
    document.getElementById('confirmModalMessage').textContent = message;
    
    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Handle cancel
    if (onCancel) {
        modal.addEventListener('hidden.bs.modal', onCancel, { once: true });
    }
}

function executeConfirm() {
    if (globalConfirmCallback) {
        globalConfirmCallback();
        const modal = bootstrap.Modal.getInstance(document.getElementById('globalConfirmModal'));
        if (modal) modal.hide();
    }
    globalConfirmCallback = null;
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});
