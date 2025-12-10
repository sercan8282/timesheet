const API_BASE_URL = '/api';

class API {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            this.clearToken();
            window.location.reload();
            throw new Error('Unauthorized');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    }

    // Auth endpoints
    async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    // User endpoints
    async getMe() {
        return this.request('/user/me');
    }

    async changePassword(currentPassword, newPassword) {
        return this.request('/user/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }

    async getTimesheets() {
        return this.request('/user/timesheets');
    }

    async createTimesheet(data) {
        return this.request('/user/timesheets', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateTimesheet(id, data) {
        return this.request(`/user/timesheets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteTimesheet(id) {
        return this.request(`/user/timesheets/${id}`, {
            method: 'DELETE'
        });
    }

    async getSubmissions() {
        return this.request('/user/submissions');
    }

    async getTimesheetDetails(timesheetIds) {
        return this.request('/user/timesheets/details', {
            method: 'POST',
            body: JSON.stringify({ ids: timesheetIds })
        });
    }

    async getWeeklySummary(page = 1) {
        return this.request(`/user/weekly-summary?page=${page}`);
    }

    // Submission endpoints
    async submitTimesheets(timesheetIds) {
        return this.request('/submission/submit', {
            method: 'POST',
            body: JSON.stringify({ timesheetIds })
        });
    }

    async getSubmissionPDF(submissionId) {
        const response = await fetch(`${API_BASE_URL}/submission/submissions/${submissionId}/pdf`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch PDF');
        }

        return response.blob();
    }

    async getAdminSubmissionPDF(submissionId) {
        const response = await fetch(`${API_BASE_URL}/admin/submissions/${submissionId}/pdf`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch PDF');
        }

        return response.blob();
    }

    async getAdminSubmissionXLSX(submissionId) {
        const response = await fetch(`${API_BASE_URL}/admin/submissions/${submissionId}/xlsx`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch XLSX');
        }

        return response.blob();
    }

    async getSubmissionXLSX(submissionId) {
        const response = await fetch(`${API_BASE_URL}/submission/submissions/${submissionId}/xlsx`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch XLSX');
        }

        return response.blob();
    }

    async resendSubmissionEmail(submissionId) {
        return this.request(`/submission/submissions/${submissionId}/resend`, {
            method: 'POST'
        });
    }

    async previewPDF(timesheetIds) {
        const response = await fetch(`${API_BASE_URL}/submission/preview-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ timesheetIds })
        });

        if (!response.ok) {
            throw new Error('Failed to generate PDF preview');
        }

        return response.blob();
    }

    async previewXLSX(timesheetIds) {
        const response = await fetch(`${API_BASE_URL}/submission/preview-xlsx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ timesheetIds })
        });

        if (!response.ok) {
            throw new Error('Failed to generate Excel preview');
        }

        return response.blob();
    }

    // Admin endpoints
    async getUsers() {
        return this.request('/admin/users');
    }

    async createUser(data) {
        return this.request('/admin/users', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateUser(id, data) {
        return this.request(`/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteUser(id) {
        return this.request(`/admin/users/${id}`, {
            method: 'DELETE'
        });
    }

    async getAdminSubmissions() {
        return this.request('/admin/submissions');
    }

    async getSubmissionTimesheets(submissionId) {
        return this.request(`/admin/submissions/${submissionId}/timesheets`);
    }

    async deleteSubmission(submissionId) {
        return this.request(`/admin/submissions/${submissionId}`, {
            method: 'DELETE'
        });
    }

    async getHoursReport(page = 1, userId = null) {
        let url = `/admin/hours-report?page=${page}`;
        if (userId) {
            url += `&userId=${userId}`;
        }
        return this.request(url);
    }

    async updateSubmission(submissionId, data) {
        return this.request(`/admin/submissions/${submissionId}`, {
            method: 'PUT',
            body: JSON.stringify({
                timesheet_ids: data.timesheet_ids
            })
        });
    }

    async getSMTPSettings() {
        return this.request('/admin/smtp-settings');
    }

    async updateSMTPSettings(data) {
        return this.request('/admin/smtp-settings', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async testSMTP() {
        return this.request('/admin/smtp-settings/test', {
            method: 'POST'
        });
    }

    async getBrandingSettings() {
        return this.request('/admin/branding-settings');
    }

    async updateBrandingSettings(data) {
        return this.request('/admin/branding-settings', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async uploadLogo(formData) {
        const response = await fetch(`${API_BASE_URL}/admin/branding-settings/logo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload logo');
        }

        return response.json();
    }

    // Public endpoints
    async getPublicBranding() {
        const response = await fetch(`${API_BASE_URL}/branding`);
        return response.json();
    }
}

const api = new API();
