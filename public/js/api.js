const API_BASE_URL = "/api";

class API {
  constructor() {
    this.token = localStorage.getItem("token");
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem("token", token);
  }

  // Expose current JWT for callers that need raw token (e.g., manual fetch)
  getToken() {
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("token");
  }

  async request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearToken();
      window.location.reload();
      throw new Error("Unauthorized");
    }

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response:", text);
      throw new Error(
        `Server error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!response.ok) {
      // Log error for debugging
      console.error("API Error Response:", data);

      // Handle MFA setup required
      if (data.mfaSetupRequired && window.showMFAModal) {
        window.showMFAModal({
          setupMode: true,
          required: true,
        });
        throw new Error(data.error || "MFA setup required");
      }

      // Handle validation errors
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessages = data.errors
          .map((err) => err.msg || err.message)
          .join(", ");
        throw new Error(errorMessages);
      }

      throw new Error(data.error || data.message || "Request failed");
    }

    return data;
  }

  // Auth endpoints
  async login(username, password) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  // User endpoints
  async getMe() {
    return this.request("/user/me");
  }

  async changePassword(currentPassword, newPassword) {
    return this.request("/user/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getTimesheets() {
    return this.request("/user/timesheets");
  }

  async createTimesheet(data) {
    return this.request("/user/timesheets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTimesheet(id, data) {
    return this.request(`/user/timesheets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTimesheet(id) {
    return this.request(`/user/timesheets/${id}`, {
      method: "DELETE",
    });
  }

  async getSubmissions() {
    return this.request("/user/submissions");
  }

  async getWeeklySummary(page = 1) {
    return this.request(`/user/weekly-summary?page=${page}`);
  }

  async getLeaveBalance() {
    return this.request("/user/leave/balance");
  }

  async getLeaveRequests() {
    return this.request("/user/leave/requests");
  }

  async getLeaveRequestsCalendar() {
    return this.request("/user/leave/calendar");
  }

  async submitLeaveRequest(payload) {
    return this.request("/user/leave/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateLeaveRequest(id, payload) {
    return this.request(`/user/leave/requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteLeaveRequest(id) {
    return this.request(`/user/leave/requests/${id}`, {
      method: "DELETE",
    });
  }

  async getTimesheetDetails(timesheetIds) {
    return this.request("/user/timesheets/details", {
      method: "POST",
      body: JSON.stringify({ ids: timesheetIds }),
    });
  }

  // Submission endpoints
  async submitTimesheets(timesheetIds, sendEmail = true) {
    return this.request("/submission/submit", {
      method: "POST",
      body: JSON.stringify({ timesheetIds, sendEmail }),
    });
  }

  async getSubmissionPDF(submissionId) {
    const response = await fetch(
      `${API_BASE_URL}/submission/submissions/${submissionId}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch PDF");
    }

    return response.blob();
  }

  async getAdminSubmissionPDF(submissionId) {
    const response = await fetch(
      `${API_BASE_URL}/admin/submissions/${submissionId}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch PDF");
    }

    return response.blob();
  }

  async getAdminSubmissionXLSX(submissionId) {
    const response = await fetch(
      `${API_BASE_URL}/admin/submissions/${submissionId}/xlsx`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch XLSX");
    }

    return response.blob();
  }

  async getSubmissionXLSX(submissionId) {
    const response = await fetch(
      `${API_BASE_URL}/submission/submissions/${submissionId}/xlsx`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch XLSX");
    }

    return response.blob();
  }

  async resendSubmissionEmail(submissionId) {
    return this.request(`/submission/submissions/${submissionId}/resend`, {
      method: "POST",
    });
  }

  async previewPDF(timesheetIds) {
    const response = await fetch(`${API_BASE_URL}/submission/preview-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ timesheetIds }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate PDF preview");
    }

    return response.blob();
  }

  async previewXLSX(timesheetIds) {
    const response = await fetch(`${API_BASE_URL}/submission/preview-xlsx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ timesheetIds }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate Excel preview");
    }

    return response.blob();
  }

  // Admin endpoints
  async getUsers() {
    return this.request("/admin/users");
  }

  async createUser(data) {
    return this.request("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateUser(id, data) {
    return this.request(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id) {
    return this.request(`/admin/users/${id}`, {
      method: "DELETE",
    });
  }

  // Admin: reset user MFA (requires admin MFA token)
  async resetUserMfa(id, mfaToken) {
    return this.request(`/admin/users/${id}/reset-mfa`, {
      method: "POST",
      body: JSON.stringify({ mfaToken }),
    });
  }

  // Admin: reset user password (requires admin MFA token)
  async resetUserPassword(id, payload) {
    return this.request(`/admin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async toggleBlockUser(id, isBlocked) {
    return this.request(`/admin/users/${id}/block`, {
      method: "PUT",
      body: JSON.stringify({ is_blocked: isBlocked }),
    });
  }

  async getUserCompanies(userId) {
    return this.request(`/admin/users/${userId}/companies`);
  }

  async updateUserCompanies(userId, companyIds, primaryCompanyId) {
    return this.request(`/admin/users/${userId}/companies`, {
      method: "PUT",
      body: JSON.stringify({
        companyIds,
        primaryCompanyId,
      }),
    });
  }

  async getAdminSubmissions() {
    return this.request("/admin/submissions");
  }

  async getHoursReport(userId = "") {
    return this.request(
      `/admin/hours-report${userId ? "?userId=" + userId : ""}`
    );
  }

  async getLeaveBalances() {
    return this.request("/admin/leave-balances");
  }

  async updateLeaveBalance(userId, data) {
    return this.request(`/admin/leave-balances/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getLeaveRequestsAdmin() {
    return this.request("/admin/leave-requests");
  }

  async decideLeaveRequest(requestId, status, adminNote = "") {
    return this.request(`/admin/leave-requests/${requestId}/decision`, {
      method: "POST",
      body: JSON.stringify({ status, adminNote }),
    });
  }

  async adminUpdateLeaveRequest(id, payload) {
    return this.request(`/admin/leave-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async adminDeleteLeaveRequest(id) {
    return this.request(`/admin/leave-requests/${id}`, {
      method: "DELETE",
    });
  }

  // Fleet endpoints
  async getFleetVehicles() {
    return this.request("/admin/fleet/vehicles");
  }

  async getFleetVehicle(id) {
    return this.request(`/admin/fleet/vehicles/${id}`);
  }

  // UI Menu endpoints
  async getUiMenu() {
    return this.request("/ui/menu");
  }

  async getUiMenuForLocale(locale) {
    return this.request(`/ui/menu?locale=${encodeURIComponent(locale)}`);
  }

  async updateUiMenu(items) {
    return this.request("/admin/ui/menu", {
      method: "PUT",
      body: JSON.stringify(items),
    });
  }

  async getFleetTypes() {
    return this.request(`/admin/fleet/types`);
  }

  // Translations
  async getTranslations(locale, namespace) {
    const qs = [];
    if (locale) qs.push(`locale=${encodeURIComponent(locale)}`);
    if (namespace) qs.push(`namespace=${encodeURIComponent(namespace)}`);
    const q = qs.length ? `?${qs.join("&")}` : "";
    return this.request(`/ui/i18n${q}`);
  }

  async updateTranslations(items) {
    return this.request("/admin/i18n", {
      method: "PUT",
      body: JSON.stringify(items),
    });
  }

  async getTranslationKeys(namespace) {
    return this.request(
      `/admin/i18n/keys?namespace=${encodeURIComponent(namespace)}`
    );
  }

  async translateText({ text, target, source, provider }) {
    return this.request(`/translate`, {
      method: "POST",
      body: JSON.stringify({ text, target, source, provider }),
    });
  }

  async getTranslationImports(limit = 50) {
    return this.request(`/admin/i18n/imports?limit=${limit}`);
  }

  async createFleetVehicle(data) {
    return this.request("/admin/fleet/vehicles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateFleetVehicle(id, data) {
    return this.request(`/admin/fleet/vehicles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteFleetVehicle(id) {
    return this.request(`/admin/fleet/vehicles/${id}`, {
      method: "DELETE",
    });
  }

  async addFleetMaintenance(id, data) {
    return this.request(`/admin/fleet/vehicles/${id}/maintenance`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateFleetMaintenance(maintenanceId, data) {
    return this.request(`/admin/fleet/maintenance/${maintenanceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteFleetMaintenance(maintenanceId) {
    return this.request(`/admin/fleet/maintenance/${maintenanceId}`, {
      method: "DELETE",
    });
  }

  async getSubmissionTimesheets(submissionId) {
    return this.request(`/admin/submissions/${submissionId}/timesheets`);
  }

  async updateAdminTimesheet(timesheetId, data) {
    return this.request(`/admin/timesheets/${timesheetId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteSubmission(submissionId) {
    return this.request(`/admin/submissions/${submissionId}`, {
      method: "DELETE",
    });
  }

  async sendCustomSubmissionEmail(submissionId, recipient, format) {
    return this.request(`/admin/submissions/${submissionId}/send-email`, {
      method: "POST",
      body: JSON.stringify({ recipient, format }),
    });
  }

  async updateSubmission(submissionId, data) {
    return this.request(`/admin/submissions/${submissionId}`, {
      method: "PUT",
      body: JSON.stringify({
        timesheet_ids: data.timesheet_ids,
      }),
    });
  }

  async getSMTPSettings() {
    return this.request("/admin/smtp-settings");
  }

  async updateSMTPSettings(data) {
    return this.request("/admin/smtp-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async testSMTP() {
    return this.request("/admin/smtp-settings/test", {
      method: "POST",
    });
  }

  async getBrandingSettings() {
    return this.request("/admin/branding-settings");
  }

  async updateBrandingSettings(data) {
    return this.request("/admin/branding-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async uploadLogo(formData) {
    const response = await fetch(
      `${API_BASE_URL}/admin/branding-settings/logo`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload logo");
    }

    return response.json();
  }

  // Company endpoints
  async getCompanies() {
    return this.request("/admin/companies");
  }

  async getCompany(id) {
    return this.request(`/admin/companies/${id}`);
  }

  async createCompany(data) {
    return this.request("/admin/companies", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCompany(id, data) {
    return this.request(`/admin/companies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteCompany(id) {
    return this.request(`/admin/companies/${id}`, {
      method: "DELETE",
    });
  }

  // Vehicle endpoints
  async getVehicles() {
    return this.request("/admin/vehicles");
  }

  async getVehicle(id) {
    return this.request(`/admin/vehicles/${id}`);
  }

  async createVehicle(data) {
    return this.request("/admin/vehicles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateVehicle(id, data) {
    return this.request(`/admin/vehicles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteVehicle(id) {
    return this.request(`/admin/vehicles/${id}`, {
      method: "DELETE",
    });
  }

  // Vehicle Maintenance endpoints
  async getVehicleMaintenance(vehicleId) {
    return this.request(`/admin/vehicles/${vehicleId}/maintenance`);
  }

  async addVehicleMaintenance(vehicleId, data) {
    return this.request(`/admin/vehicles/${vehicleId}/maintenance`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateVehicleMaintenance(maintenanceId, data) {
    return this.request(`/admin/vehicles/maintenance/${maintenanceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteVehicleMaintenance(maintenanceId) {
    return this.request(`/admin/vehicles/maintenance/${maintenanceId}`, {
      method: "DELETE",
    });
  }

  // Vehicle APK Alerts endpoints
  async getVehicleAPKAlerts(vehicleId) {
    return this.request(`/admin/vehicles/${vehicleId}/apk-alerts`);
  }

  async updateVehicleAPKAlerts(vehicleId, data) {
    return this.request(`/admin/vehicles/${vehicleId}/apk-alerts`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteVehicleAPKAlerts(vehicleId) {
    return this.request(`/admin/vehicles/apk-alerts/${vehicleId}`, {
      method: "DELETE",
    });
  }

  // Planning endpoints
  async getPlanningWeek(weekNumber) {
    return this.request(`/admin/planning/week/${weekNumber}`);
  }

  async getRoutes() {
    return this.request(`/admin/planning/routes`);
  }

  async getDriversByCompany(companyId) {
    return this.request(`/admin/planning/drivers/${companyId}`);
  }

  async createPlanningEntry(data) {
    return this.request(`/admin/planning`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePlanningEntry(id, data) {
    return this.request(`/admin/planning/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deletePlanningEntry(id) {
    return this.request(`/admin/planning/${id}`, {
      method: "DELETE",
    });
  }

  async clearWeekPlanning(weekNumber, companyId) {
    return this.request(
      `/admin/planning/week/${weekNumber}/clear${
        companyId ? "?companyId=" + companyId : ""
      }`,
      {
        method: "DELETE",
      }
    );
  }

  async generateWeeklyPlanning(weekNumber) {
    return this.request(`/admin/planning/generate/${weekNumber}`, {
      method: "POST",
    });
  }

  async generateCompanyWeeklyPlanning(weekNumber, companyId) {
    return this.request(
      `/admin/planning/generate/${weekNumber}/company/${companyId}`,
      {
        method: "POST",
      }
    );
  }

  async generatePlanningByVehicles(weekNumber, companyId) {
    return this.request(
      `/admin/planning/generate-by-vehicles/${weekNumber}/company/${companyId}`,
      {
        method: "POST",
      }
    );
  }

  async exportPlanningPDF(weekNumber) {
    const response = await fetch(
      `${API_BASE_URL}/admin/planning/week/${weekNumber}/export-pdf`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "PDF export failed");
    }

    return response.blob();
  }

  async emailPlanningPDF(weekNumber, recipients, subject, message) {
    return this.request(`/admin/planning/week/${weekNumber}/email`, {
      method: "POST",
      body: JSON.stringify({ recipients, subject, message }),
    });
  }

  // SMTP Settings
  async getSMTPSettings() {
    return this.request(`/admin/smtp-settings`);
  }

  async updateSMTPSettings(payload) {
    return this.request(`/admin/smtp-settings`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async testSMTPConnection() {
    return this.request(`/admin/smtp-settings/test`, {
      method: "POST",
    });
  }

  // Branding Settings
  async getBrandingSettings() {
    return this.request(`/admin/branding-settings`);
  }

  async updateBrandingSettings(payload) {
    return this.request(`/admin/branding-settings`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async uploadBrandingLogo(formData) {
    const response = await fetch(
      `${API_BASE_URL}/admin/branding-settings/logo`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Logo upload failed");
    }

    return response.json();
  }

  async getBrandingCustomCss() {
    return this.request(`/admin/branding-settings/custom-css`);
  }

  async updateBrandingCustomCss(payload) {
    return this.request(`/admin/branding-settings/custom-css`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // Public endpoints
  async getPublicBranding() {
    const response = await fetch(`${API_BASE_URL}/branding`);
    return response.json();
  }

  // ============================================
  // INVOICE API
  // ============================================

  // Invoice Templates
  async getInvoiceTemplates() {
    return this.request("/admin/invoices/templates");
  }

  async getInvoiceTemplate(id) {
    return this.request(`/admin/invoices/templates/${id}`);
  }

  async createInvoiceTemplate(data) {
    return this.request("/admin/invoices/templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateInvoiceTemplate(id, data) {
    return this.request(`/admin/invoices/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteInvoiceTemplate(id) {
    return this.request(`/admin/invoices/templates/${id}`, {
      method: "DELETE",
    });
  }

  // Invoice Fonts
  async getInvoiceFonts() {
    return this.request("/admin/invoices/fonts");
  }

  async uploadInvoiceFont(formData) {
    const response = await fetch(`${API_BASE_URL}/admin/invoices/fonts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });
    const data = await response.json().catch(() => ({ error: "Server error" }));
    if (!response.ok) throw new Error(data.error || "Upload mislukt");
    return data;
  }

  // Template Elements
  async addTemplateElement(templateId, formData) {
    const response = await fetch(
      `${API_BASE_URL}/admin/invoices/templates/${templateId}/elements`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add element");
    }

    return response.json();
  }

  async updateTemplateElement(templateId, elementId, formData) {
    const response = await fetch(
      `${API_BASE_URL}/admin/invoices/templates/${templateId}/elements/${elementId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update element");
    }

    return response.json();
  }

  async deleteTemplateElement(templateId, elementId) {
    return this.request(
      `/admin/invoices/templates/${templateId}/elements/${elementId}`,
      {
        method: "DELETE",
      }
    );
  }

  // Invoices
  async getInvoices() {
    return this.request("/admin/invoices/invoices");
  }

  async getInvoice(id) {
    return this.request(`/admin/invoices/invoices/${id}`);
  }

  async createInvoice(data) {
    return this.request("/admin/invoices/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateInvoice(id, data) {
    return this.request(`/admin/invoices/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteInvoice(id) {
    return this.request(`/admin/invoices/invoices/${id}`, {
      method: "DELETE",
    });
  }

  async getNextInvoiceNumber() {
    return this.request("/admin/invoices/invoices/next-number");
  }

  // PDF Generation
  async generateInvoicePDF(id) {
    return this.request(`/admin/invoices/invoices/${id}/generate-pdf`, {
      method: "POST",
    });
  }

  async downloadInvoicePDF(id) {
    const response = await fetch(
      `${API_BASE_URL}/admin/invoices/invoices/${id}/download-pdf`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to download PDF");
    }

    return response.blob();
  }

  // Email
  async sendInvoiceEmail(id, data) {
    return this.request(`/admin/invoices/invoices/${id}/send-email`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Invoice Template Line Fields
  async getTemplateLineFields(templateId) {
    return this.request(`/admin/invoices/templates/${templateId}/line-fields`);
  }

  async updateTemplateLineField(templateId, fieldName, data) {
    return this.request(
      `/admin/invoices/templates/${templateId}/line-fields/${fieldName}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  }

  // Import Templates
  async getImportTemplates() {
    try {
      return await this.request("/admin/invoices/import-templates");
    } catch (err) {
      // Fallback to public endpoint if auth/token issues
      try {
        return await this.request("/admin/invoices/public/import-templates");
      } catch (e2) {
        throw err;
      }
    }
  }

  async createImportTemplate(data) {
    return this.request("/admin/invoices/import-templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getImportTemplate(id) {
    return this.request(`/admin/invoices/import-templates/${id}`);
  }

  async uploadImportTemplateSample(id, formData) {
    const response = await fetch(
      `${API_BASE_URL}/admin/invoices/import-templates/${id}/sample`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      }
    );
    const data = await response.json().catch(() => ({ error: "Server error" }));
    if (!response.ok) throw new Error(data.error || "Upload mislukt");
    return data;
  }

  async saveImportTemplateMappings(id, mappings) {
    return this.request(`/admin/invoices/import-templates/${id}/mappings`, {
      method: "PUT",
      body: JSON.stringify({ mappings }),
    });
  }

  async getImportTemplateMappings(id) {
    const tpl = await this.getImportTemplate(id);
    return tpl.mappings || [];
  }

  async deleteImportTemplate(id) {
    return this.request(`/admin/invoices/import-templates/${id}`, {
      method: "DELETE",
    });
  }

  async cleanupImportTemplates() {
    return this.request(`/admin/invoices/import-templates/cleanup`, {
      method: "POST",
    });
  }

  async autoDetectImportPdf(formData) {
    // allow caller to append template_id before calling
    const response = await fetch(
      `${API_BASE_URL}/admin/invoices/import-templates/auto-detect`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      }
    );

    const data = await response.json().catch(() => ({ error: "Server error" }));
    if (!response.ok) {
      throw new Error(data.error || "Auto-detect mislukt");
    }
    return data;
  }

  // Invoice PDF Import
  async importInvoicePDF(formData) {
    const response = await fetch(`${API_BASE_URL}/admin/invoices/import-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });

    // Expect JSON response
    const data = await response.json().catch(() => ({ error: "Server error" }));
    if (!response.ok) {
      throw new Error(data.error || "Importeren van PDF mislukt");
    }
    return data;
  }

  // =========================
  // System Update (Admin)
  // =========================
  async startSystemUpdate() {
    return this.request(`/admin/system/update`, { method: "POST" });
  }

  subscribeUpdateStatus(onMessage) {
    const token = localStorage.getItem("token");
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${API_BASE_URL}/admin/system/update/status${qs}`;
    const es = new EventSource(url);
    es.onmessage = (evt) => {
      if (!evt || typeof onMessage !== "function") return;
      let payload = evt.data;
      try {
        payload = JSON.parse(evt.data);
      } catch (e) {
        // keep as string
      }
      onMessage(payload);
    };
    return es;
  }
}

const api = new API();
