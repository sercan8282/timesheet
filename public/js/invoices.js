// Invoice Management Module
const invoiceManager = {
  currentView: "list", // 'list', 'templates', 'create-template', 'create-invoice'
  currentTemplate: null,
  currentInvoice: null,
  editingInvoiceId: null,
  editingInvoiceStatus: null,
  templates: [],
  invoices: [],

  async init() {
    await this.loadData();
    this.renderInvoiceList();
  },

  async loadData() {
    try {
      this.templates = await api.getInvoiceTemplates();
      this.invoices = await api.getInvoices();
    } catch (error) {
      console.error("Error loading invoice data:", error);
      showToast(t("ui", "invoice.load_error"), "error");
    }
  },

  renderInvoiceList() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="container-fluid mt-4">
        <div class="row mb-4">
          <div class="col">
            <h2><i class="bi bi-receipt"></i> <span data-i18n="ui:invoices.title">Facturen</span></h2>
          </div>
          <div class="col-auto">
            <button class="btn btn-primary" onclick="invoiceManager.showCreateInvoice()">
              <i class="bi bi-plus-circle"></i> <span data-i18n="ui:invoices.new_invoice">Nieuwe Factuur</span>
            </button>
            <button class="btn btn-outline-secondary" onclick="invoiceManager.showTemplates()">
              <i class="bi bi-layout-text-sidebar"></i> <span data-i18n="ui:invoices.templates">Templates</span>
            </button>
            <button class="btn btn-outline-primary" onclick="invoiceManager.showImportPdf()">
              <i class="bi bi-file-earmark-arrow-up"></i> <span data-i18n="ui:invoices.import_pdf">Importeer PDF</span>
            </button>
          </div>
        </div>

        <!-- Bulk Actions Bar -->
        <div id="bulk-actions-bar" class="alert alert-info d-none mb-3">
          <div class="d-flex justify-content-between align-items-center">
            <span><strong><span id="selected-count">0</span></strong> <span data-i18n="ui:invoices_selected">facturen geselecteerd</span></span>
            <div>
              <button class="btn btn-sm btn-danger" onclick="invoiceManager.bulkDelete()">
                <i class="bi bi-trash"></i> <span data-i18n="ui:delete_selected">Verwijder geselecteerde</span>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="invoiceManager.clearSelection()">
                <i class="bi bi-x"></i> <span data-i18n="ui:deselect_all">Deselecteer alles</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="card mb-4">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-3">
                <input type="text" class="form-control" id="invoice-search" 
                       placeholder="Zoek op factuurnummer of klant..." data-i18n="ui:invoices.search_placeholder"
                       onkeyup="invoiceManager.filterInvoices()">
              </div>
              <div class="col-md-2">
                <select class="form-select" id="invoice-status-filter" onchange="invoiceManager.filterInvoices()">
                  <option value="" data-i18n="ui:invoices.all_statuses">Alle statussen</option>
                  <option value="draft" data-i18n="ui:invoices.status_draft">Concept</option>
                  <option value="sent" data-i18n="ui:invoices.status_sent">Verzonden</option>
                  <option value="paid" data-i18n="ui:invoices.status_paid">Betaald</option>
                  <option value="cancelled" data-i18n="ui:invoices.status_cancelled">Geannuleerd</option>
                </select>
              </div>
              <div class="col-md-3">
                <input type="date" class="form-control" id="invoice-date-before" placeholder="Voor datum" onchange="invoiceManager.filterInvoices()">
              </div>
              <div class="col-md-2">
                <button class="btn btn-outline-danger w-100" onclick="invoiceManager.deleteOldInvoices()">
                  <i class="bi bi-trash"></i> <span data-i18n="ui:invoices.delete_old">Verwijder oude facturen</span>
                </button>
              </div>
              <div class="col-md-2">
                <button class="btn btn-outline-warning w-100" onclick="invoiceManager.clearAllInvoices()">
                  <i class="bi bi-exclamation-triangle"></i> <span data-i18n="ui:invoices.clear_all">Alles wissen</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Invoice List -->
        <div class="card">
          <div class="card-body">
            <div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th style="width: 40px;">
                      <input type="checkbox" id="select-all-invoices" onchange="invoiceManager.toggleSelectAll(this.checked)">
                    </th>
                    <th><span data-i18n="ui:invoices.number">Factuurnummer</span></th>
                    <th><span data-i18n="ui:invoices.customer">Klant</span></th>
                    <th><span data-i18n="ui:invoices.date">Datum</span></th>
                    <th><span data-i18n="ui:invoices.total">Bedrag</span></th>
                    <th><span data-i18n="ui:invoices.status">Status</span></th>
                    <th><span data-i18n="ui:actions">Acties</span></th>
                  </tr>
                </thead>
                <tbody id="invoice-table-body">
                  ${this.renderInvoiceRows()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  showImportPdf() {
    const templateOptions = this.templates
      .map((t) => `<option value="${t.id}">${t.name}</option>`)
      .join("");

    const modalHtml = `
      <div class="modal fade" id="importPdfModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-file-earmark-arrow-up"></i> Factuur PDF Importeren</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted small">Upload één of meerdere PDF-facturen (maximaal 20 bestanden). We lezen het totaalbedrag, BTW, klantnaam en datum uit, en maken automatisch facturen aan.</p>
              
              <div class="mb-3">
                <label for="importTemplateSelect" class="form-label">Template voor factuur layout</label>
                <select id="importTemplateSelect" class="form-select">
                  <option value="">-- Selecteer template --</option>
                  ${templateOptions}
                </select>
                <div class="form-text">De template bepaalt het factuuradres en afzender informatie op de PDF</div>
              </div>
              
              <div class="mb-3">
                <label for="importPdfInput" class="form-label">PDF bestanden</label>
                <input type="file" id="importPdfInput" class="form-control" accept="application/pdf" multiple />
                <div class="form-text">Je kunt maximaal 20 bestanden tegelijk uploaden</div>
              </div>
              
              <div id="importProgress" style="display: none;">
                <div class="progress mb-2">
                  <div id="importProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
                </div>
                <div id="importStatus" class="small text-muted"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Sluiten</button>
              <button class="btn btn-primary" id="importPdfConfirm">Importeren</button>
            </div>
          </div>
        </div>
      </div>`;

    // Inject modal into DOM if not present
    let container = document.getElementById("modal-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "modal-container";
      document.body.appendChild(container);
    }
    container.innerHTML = modalHtml;

    const modalEl = document.getElementById("importPdfModal");
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    const confirmBtn = document.getElementById("importPdfConfirm");
    confirmBtn.onclick = async () => {
      const input = document.getElementById("importPdfInput");
      const templateSelect = document.getElementById("importTemplateSelect");

      if (!input.files || input.files.length === 0) {
        showToast(t("ui", "select_min_one_pdf"), "error");
        return;
      }

      if (input.files.length > 20) {
        showToast(t("ui", "max_20_files"), "error");
        return;
      }

      if (!templateSelect.value) {
        showToast(t("ui", "select_template"), "error");
        return;
      }

      // Show progress
      const progressDiv = document.getElementById("importProgress");
      const progressBar = document.getElementById("importProgressBar");
      const statusDiv = document.getElementById("importStatus");
      progressDiv.style.display = "block";
      confirmBtn.disabled = true;

      const files = Array.from(input.files);
      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const errors = [];
      const duplicates = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = Math.round(((i + 1) / files.length) * 100);

        progressBar.style.width = progress + "%";
        statusDiv.textContent = `Bezig met importeren: ${file.name} (${i + 1}/${
          files.length
        })`;

        const formData = new FormData();
        formData.append("pdf", file);
        formData.append("template_id", templateSelect.value);

        try {
          await api.importInvoicePDF(formData);
          successCount++;
        } catch (err) {
          console.error("Import error:", err);
          // Check if it's a duplicate (409 status)
          if (
            err.duplicate ||
            (err.message && err.message.includes("bestaat al"))
          ) {
            duplicateCount++;
            duplicates.push(file.name);
          } else {
            errorCount++;
            errors.push(`${file.name}: ${err.message || "Onbekende fout"}`);
          }
        }
      }

      // Hide progress
      progressDiv.style.display = "none";
      confirmBtn.disabled = false;

      // Show results
      let message = "";
      if (successCount > 0) message += `${successCount} facturen geïmporteerd`;
      if (duplicateCount > 0)
        message +=
          (message ? ", " : "") + `${duplicateCount} overgeslagen (bestaan al)`;
      if (errorCount > 0)
        message += (message ? ", " : "") + `${errorCount} mislukt`;

      if (errorCount === 0 && duplicateCount === 0) {
        showToast(
          `Alle ${successCount} facturen succesvol geïmporteerd!`,
          "success"
        );
      } else if (successCount === 0 && errorCount > 0) {
        showToast(`Importeren mislukt voor alle bestanden`, "error");
        console.error("Errors:", errors);
      } else {
        showToast(
          message,
          duplicateCount > 0 && errorCount === 0 ? "info" : "warning"
        );
        if (errors.length > 0) console.error("Errors:", errors);
        if (duplicates.length > 0)
          console.info("Duplicates overgeslagen:", duplicates);
      }

      bsModal.hide();
      await this.loadData();
      this.renderInvoiceList();
    };
  },

  async loadImportTemplatesForModal() {
    try {
      const importTemplates = await api.getImportTemplates();
      const parserSelect = document.getElementById("importPdfParserSelect");

      if (!parserSelect) return;

      if (importTemplates.length === 0) {
        parserSelect.innerHTML = `<option value="">${t(
          "ui",
          "no_import_templates"
        )}</option>`;
        parserSelect.disabled = true;
      } else {
        parserSelect.innerHTML =
          `<option value="">-- ${t("ui", "select_import_format")} --</option>` +
          importTemplates
            .map(
              (t) =>
                `<option value="${t.id}">${t.name} (${t.parser_type})</option>`
            )
            .join("");
        parserSelect.disabled = false;
      }
    } catch (error) {
      console.error("Error loading import templates:", error);
      const parserSelect = document.getElementById("importPdfParserSelect");
      if (parserSelect) {
        parserSelect.innerHTML = `<option value="">${t(
          "ui",
          "invoice.templates_load_error_option"
        )}</option>`;
      }
    }
  },

  renderInvoiceRows() {
    if (this.invoices.length === 0) {
      return `<tr><td colspan="7" class="text-center text-muted">${t(
        "ui",
        "invoice.none_found",
        "No invoices found"
      )}</td></tr>`;
    }

    return this.invoices
      .map((invoice) => {
        const statusBadge = this.getStatusBadge(invoice.status);
        return `
        <tr>
          <td>
            <input type="checkbox" class="invoice-checkbox" value="${
              invoice.id
            }" onchange="invoiceManager.updateBulkActions()">
          </td>
          <td><strong>${invoice.invoice_number}</strong></td>
          <td>${invoice.customer_name || "-"}</td>
          <td>${invoice.invoice_date}</td>
          <td>€ ${parseFloat(invoice.total_amount).toFixed(2)}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="invoiceManager.viewInvoice(${
                invoice.id
              })" title="${t("ui", "view")}">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-secondary" onclick="invoiceManager.showEditInvoice(${
                invoice.id
              })" title="${t("ui", "edit")}">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-success" onclick="invoiceManager.downloadPDF(${
                invoice.id
              })" title="PDF">
                <i class="bi bi-file-pdf"></i>
              </button>
              <button class="btn btn-outline-info" onclick="invoiceManager.showEmailModal(${
                invoice.id
              })" title="Email">
                <i class="bi bi-envelope"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="invoiceManager.deleteInvoice(${
                invoice.id
              })" title="${t("ui", "delete")}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
  },

  getStatusBadge(status) {
    const badges = {
      draft: '<span class="badge bg-secondary">Concept</span>',
      sent: '<span class="badge bg-info">Verzonden</span>',
      paid: '<span class="badge bg-success">Betaald</span>',
      cancelled: '<span class="badge bg-danger">Geannuleerd</span>',
    };
    return badges[status] || '<span class="badge bg-secondary">Onbekend</span>';
  },

  filterInvoices() {
    const searchTerm = document
      .getElementById("invoice-search")
      .value.toLowerCase();
    const statusFilter = document.getElementById("invoice-status-filter").value;

    const rows = document.querySelectorAll("#invoice-table-body tr");
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = text.includes(searchTerm);
      const status = row.querySelector(".badge")
        ? row.querySelector(".badge").textContent.toLowerCase()
        : "";
      const matchesStatus = !statusFilter || status.includes(statusFilter);

      row.style.display = matchesSearch && matchesStatus ? "" : "none";
    });
  },

  // ============================================
  // TEMPLATES
  // ============================================

  showTemplates() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="container-fluid mt-4">
        <div class="row mb-4">
          <div class="col">
            <h2><i class="bi bi-layout-text-sidebar"></i> Factuur Templates</h2>
          </div>
          <div class="col-auto">
            <button class="btn btn-primary" onclick="invoiceManager.showCreateTemplate()">
              <i class="bi bi-plus-circle"></i> Nieuw Template
            </button>
            <button class="btn btn-outline-secondary" onclick="invoiceManager.renderInvoiceList()">
              <i class="bi bi-arrow-left"></i> Terug naar Facturen
            </button>
          </div>
        </div>

        <div class="row">
          ${this.templates
            .map((template) => this.renderTemplateCard(template))
            .join("")}
        </div>
      </div>
    `;
  },

  renderTemplateCard(template) {
    return `
      <div class="col-md-4 mb-4">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">
              ${template.name}
              ${
                template.is_default
                  ? '<span class="badge bg-success ms-2">Default</span>'
                  : ""
              }
            </h5>
            <p class="card-text text-muted">${
              template.description || "Geen beschrijving"
            }</p>
          </div>
          <div class="card-footer bg-transparent">
            <button class="btn btn-sm btn-primary" onclick="invoiceManager.editTemplate(${
              template.id
            })">
              <i class="bi bi-pencil"></i> Bewerken
            </button>
            <button class="btn btn-sm btn-outline-info" onclick="invoiceManager.duplicateTemplate(${
              template.id
            })">
              <i class="bi bi-files"></i> Dupliceren
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="invoiceManager.deleteTemplate(${
              template.id
            })">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  showCreateTemplate() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="container-fluid mt-4">
        <div class="row mb-4">
          <div class="col">
            <h2><i class="bi bi-plus-circle"></i> Nieuw Template Maken</h2>
          </div>
          <div class="col-auto">
            <button class="btn btn-outline-secondary" onclick="invoiceManager.showTemplates()">
              <i class="bi bi-x"></i> Annuleren
            </button>
          </div>
        </div>

        <div class="row">
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5>Template Instellingen</h5>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">Template Naam *</label>
                  <input type="text" class="form-control" id="template-name" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Beschrijving</label>
                  <textarea class="form-control" id="template-description" rows="3"></textarea>
                </div>
                <div class="row mb-3">
                  <div class="col-md-4">
                    <label class="form-label">Uurtarief (€)</label>
                    <input type="number" class="form-control" id="template-hourly-rate" value="0" min="0" step="0.01">
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">KM Tarief (€)</label>
                    <input type="number" class="form-control" id="template-km-rate" value="0" min="0" step="0.01">
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">DOT Tarief (€)</label>
                    <input type="number" class="form-control" id="template-dot-rate" value="0" min="0" step="0.01">
                  </div>
                </div>
                <div class="mb-3 form-check">
                  <input type="checkbox" class="form-check-input" id="template-dot-rate-percent">
                  <label class="form-check-label" for="template-dot-rate-percent">DOT tarief is percentage van subtotal (excl. BTW)</label>
                </div>
                <div class="mb-3 form-check">
                  <input type="checkbox" class="form-check-input" id="template-default">
                  <label class="form-check-label" for="template-default">
                    Dit is het standaard template
                  </label>
                </div>
                <button class="btn btn-primary" onclick="invoiceManager.saveTemplate()">
                  <i class="bi bi-save"></i> Template Opslaan
                </button>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card bg-light">
              <div class="card-body">
                <h6 class="text-muted">Let op:</h6>
                <p class="small">Na het opslaan van het template kun je elementen toevoegen zoals:</p>
                <ul class="small">
                  <li>Tekstvelden met opmaak</li>
                  <li>Afbeeldingen en logo's</li>
                  <li>Berekende velden voor subtotalen, BTW en totalen</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async saveTemplate() {
    const name = document.getElementById("template-name").value.trim();
    const description = document
      .getElementById("template-description")
      .value.trim();
    const is_default = document.getElementById("template-default").checked;
    const hourly_rate =
      parseFloat(document.getElementById("template-hourly-rate").value) || 0;
    const km_rate =
      parseFloat(document.getElementById("template-km-rate").value) || 0;
    const dot_rate =
      parseFloat(document.getElementById("template-dot-rate").value) || 0;
    const dot_rate_is_percent = document.getElementById(
      "template-dot-rate-percent"
    ).checked;

    if (!name) {
      showToast(t("ui", "invoice.template_name_required"), "error");
      return;
    }

    try {
      const template = await api.createInvoiceTemplate({
        name,
        description,
        is_default: is_default ? 1 : 0,
        hourly_rate,
        km_rate,
        dot_rate,
        dot_rate_is_percent: dot_rate_is_percent ? 1 : 0,
      });

      showToast(t("ui", "invoice.template_created"), "success");
      await this.loadData();
      this.editTemplate(template.id);
    } catch (error) {
      console.error("Error creating template:", error);
      showToast(
        `${t("ui", "invoice.template_create_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async editTemplate(templateId) {
    try {
      this.currentTemplate = await api.getInvoiceTemplate(templateId);
      this.renderTemplateEditor();
    } catch (error) {
      console.error("Error loading template:", error);
      showToast(t("ui", "invoice.template_load_failed"), "error");
    }
  },

  renderTemplateEditor() {
    const template = this.currentTemplate;
    const content = document.getElementById("content");

    content.innerHTML = `
      <div class="container-fluid mt-4">
        <div class="row mb-4">
          <div class="col">
            <h2><i class="bi bi-pencil"></i> Template Bewerken: ${
              template.name
            }</h2>
          </div>
          <div class="col-auto">
            <button class="btn btn-outline-secondary" onclick="invoiceManager.showTemplates()">
              <i class="bi bi-arrow-left"></i> Terug
            </button>
          </div>
        </div>

        <!-- Template Settings Card -->
        <div class="row mb-4">
          <div class="col-12">
            <div class="card">
              <div class="card-header">
                <h5>Template Instellingen</h5>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Template Naam</label>
                      <input type="text" class="form-control" id="edit-template-name" value="${
                        template.name || ""
                      }">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3 form-check">
                      <input type="checkbox" class="form-check-input" id="edit-template-default" ${
                        template.is_default ? "checked" : ""
                      }>
                      <label class="form-check-label" for="edit-template-default">
                        Dit is het standaard template
                      </label>
                    </div>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Beschrijving</label>
                  <textarea class="form-control" id="edit-template-description" rows="2">${
                    template.description || ""
                  }</textarea>
                </div>
                <div class="row mb-3">
                  <div class="col-md-4">
                    <label class="form-label">Uurtarief (€)</label>
                    <input type="number" class="form-control" id="edit-template-hourly-rate" value="${
                      template.hourly_rate || 0
                    }" min="0" step="0.01">
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">KM Tarief (€)</label>
                    <input type="number" class="form-control" id="edit-template-km-rate" value="${
                      template.km_rate || 0
                    }" min="0" step="0.01">
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">DOT Tarief (€)</label>
                    <input type="number" class="form-control" id="edit-template-dot-rate" value="${(
                      template.dot_rate || 0
                    ).toFixed(2)}" min="0" step="0.01">
                  </div>
                </div>
                <div class="mb-3 form-check">
                  <input type="checkbox" class="form-check-input" id="edit-template-dot-rate-percent" ${
                    template.dot_rate_is_percent ? "checked" : ""
                  }>
                  <label class="form-check-label" for="edit-template-dot-rate-percent">DOT tarief is percentage van subtotal (excl. BTW)</label>
                </div>
                <button class="btn btn-primary" onclick="invoiceManager.updateTemplateSettings()">
                  <i class="bi bi-save"></i> Instellingen Opslaan
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <!-- Template Preview met 3-koloms layout -->
          <div class="col-md-5">
            <div class="card mb-4">
              <div class="card-header">
                <h5>Template Preview</h5>
              </div>
              <div class="card-body" style="background: #f8f9fa; padding: 20px; border-radius: 4px;">
                <!-- Bovenste sectie (Top 3 columns) -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; padding: 10px; background: #e8f4f8; border: 2px dashed #0066cc; border-radius: 4px;">
                  <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                    <strong style="color: #666;">📦 Top Links</strong>
                    <div style="margin-top: 5px; font-size: 10px;" id="preview-top-left"></div>
                  </div>
                  <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                    <strong style="color: #666;">📦 Top Midden</strong>
                    <div style="margin-top: 5px; font-size: 10px;" id="preview-top-center"></div>
                  </div>
                  <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                    <strong style="color: #666;">📦 Top Rechts</strong>
                    <div style="margin-top: 5px; font-size: 10px;" id="preview-top-right"></div>
                  </div>
                </div>

                <!-- Adres sectie (Address 3 columns) -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 10px; background: #f0e8f8; border: 2px dashed #9933cc; border-radius: 4px;">
                  <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                    <strong style="color: #666;">📍 Adres Links</strong>
                    <div style="margin-top: 5px; font-size: 10px;" id="preview-addr-left"></div>
                  </div>
                  <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                    <strong style="color: #666;">📍 Adres Midden</strong>
                    <div style="margin-top: 5px; font-size: 10px;" id="preview-addr-center"></div>
                  </div>
                  <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                    <strong style="color: #666;">📍 Adres Rechts</strong>
                    <div style="margin-top: 5px; font-size: 10px;" id="preview-addr-right"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Element toevoegen -->
          <div class="col-md-4">
            <div class="card mb-4">
              <div class="card-header">
                <h5>Element Toevoegen</h5>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">Element Type</label>
                  <select class="form-select" id="element-type" onchange="invoiceManager.updateElementForm()">
                    <optgroup label="Bovenste Sectie (3 kolommen)">
                      <option value="top_left">Boven Links</option>
                      <option value="top_center">Boven Midden</option>
                      <option value="top_right">Boven Rechts</option>
                    </optgroup>
                    <optgroup label="Adres Sectie (3 kolommen)">
                      <option value="address_left">Adres Links (Factuuradres)</option>
                      <option value="address_center">Adres Midden</option>
                      <option value="address_right">Adres Rechts (Afzender)</option>
                    </optgroup>
                    <optgroup label="Klassieke Types">
                      <option value="title">Titel (bovenaan PDF)</option>
                      <option value="text">Tekst</option>
                      <option value="sender">Afzender Info (klassiek)</option>
                      <option value="image">Afbeelding</option>
                      <option value="line_item">Regel Item</option>
                      <option value="subtotal">Subtotaal</option>
                      <option value="vat">BTW (21%)</option>
                      <option value="total">Totaal</option>
                    </optgroup>
                  </select>
                </div>

                <div id="element-form">
                  ${this.renderElementForm("text")}
                </div>

                <button class="btn btn-primary w-100" onclick="invoiceManager.addElement()">
                  <i class="bi bi-plus"></i> Element Toevoegen
                </button>
              </div>
            </div>
          </div>

          <!-- Template elementen lijst -->
          <div class="col-md-3">
            <div class="card">
              <div class="card-header">
                <h5>Elementen</h5>
              </div>
              <div class="card-body" style="max-height: 600px; overflow-y: auto;">
                <div id="template-elements-list">
                  ${this.renderTemplateElements()}
                </div>
              </div>
              <div class="card-footer">
                <button class="btn btn-sm btn-info w-100" onclick="invoiceManager.previewTemplatePDF()" title="Preview PDF genereren">
                  <i class="bi bi-eye"></i> PDF Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Update preview after rendering
    this.updateTemplatePreview();
  },

  updateTemplatePreview() {
    const elements = this.currentTemplate.elements || [];
    const positions = {
      top_left: "#preview-top-left",
      top_center: "#preview-top-center",
      top_right: "#preview-top-right",
      address_left: "#preview-addr-left",
      address_center: "#preview-addr-center",
      address_right: "#preview-addr-right",
    };

    // Clear all preview areas
    Object.values(positions).forEach((id) => {
      const el = document.querySelector(id);
      if (el) el.innerHTML = "";
    });

    // Populate preview areas
    elements.forEach((el) => {
      const selector = positions[el.element_type];
      if (selector) {
        const previewEl = document.querySelector(selector);
        if (previewEl) {
          const label = el.label || el.element_type;
          const content = el.content
            ? el.content.substring(0, 20) +
              (el.content.length > 20 ? "..." : "")
            : "";
          previewEl.innerHTML += `<div style="margin: 5px 0; padding: 4px; background: #f0f0f0; border-radius: 2px; font-weight: 500;">${label}${
            content ? ": " + content : ""
          }</div>`;
        }
      }
    });
  },

  updateElementForm() {
    const type = document.getElementById("element-type").value;
    document.getElementById("element-form").innerHTML =
      this.renderElementForm(type);
  },

  renderElementForm(type) {
    const baseFields = `
      <div class="mb-3">
        <label class="form-label">Label / Omschrijving</label>
        <input type="text" class="form-control" id="element-label">
      </div>
      <div class="mb-3">
        <label class="form-label">Volgorde</label>
        <input type="number" class="form-control" id="element-order" value="0">
      </div>
    `;

    if (
      type === "text" ||
      type === "sender" ||
      type === "title" ||
      type.startsWith("top_") ||
      type.startsWith("address_")
    ) {
      let labelText = "Tekst Inhoud *";
      let placeholder = "";
      let helpText = "";
      let rows = 3;

      if (type === "sender") {
        labelText = "Afzender Tekst (meerdere regels mogelijk) *";
        placeholder =
          "Bijv:\nBedrijfsnaam B.V.\nStraatnaam 123\n1234 AB Plaats";
        helpText =
          '<small class="text-muted">Deze tekst komt rechts naast "Factuuradres:"</small>';
      } else if (type === "title") {
        labelText = "Titel Tekst (bovenaan PDF) *";
        placeholder = "Bijv: FACTUUR";
        helpText =
          '<small class="text-muted">Deze tekst komt bovenaan de PDF (groot en prominent)</small>';
        rows = 1;
      } else if (type === "top_left") {
        labelText = "Inhoud Boven Links *";
        placeholder = "Bijv: Logo of bedrijfsnaam";
        helpText = '<small class="text-muted">Linkerkolom bovenaan PDF</small>';
      } else if (type === "top_center") {
        labelText = "Inhoud Boven Midden *";
        placeholder = "Bijv: FACTUUR of bedrijfsgegevens";
        helpText = '<small class="text-muted">Middenkolom bovenaan PDF</small>';
      } else if (type === "top_right") {
        labelText = "Inhoud Boven Rechts *";
        placeholder = "Bijv: Factuurnummer, datum";
        helpText =
          '<small class="text-muted">Rechterkolom bovenaan PDF</small>';
      } else if (type === "address_left") {
        labelText = "Inhoud Adres Links (Factuuradres) *";
        placeholder = "Bijv: Klantnaam en adres";
        helpText =
          '<small class="text-muted">Linkerkolom in adressectie</small>';
      } else if (type === "address_center") {
        labelText = "Inhoud Adres Midden *";
        placeholder = "Bijv: Factuuradreslabel";
        helpText =
          '<small class="text-muted">Middenkolom in adressectie</small>';
      } else if (type === "address_right") {
        labelText = "Inhoud Adres Rechts (Afzender) *";
        placeholder = "Bijv: Bedrijfsnaam en adres";
        helpText =
          '<small class="text-muted">Rechterkolom in adressectie (afzender)</small>';
      }

      return (
        baseFields +
        `
        <div class="mb-3">
          <label class="form-label">${labelText}</label>
          <textarea class="form-control" id="element-content" rows="${rows}" placeholder="${placeholder}"></textarea>
          ${helpText}
        </div>
        <div class="mb-3">
          <label class="form-label">Afbeelding (optioneel)</label>
          <input type="file" class="form-control" id="element-image" accept="image/*">
        </div>
        <div class="mb-3">
          <label class="form-label">Tekstgrootte</label>
          <input type="number" class="form-control" id="element-font-size" value="14" min="8" max="72">
        </div>
        <div class="mb-3">
          <label class="form-label">Tekstkleur</label>
          <input type="color" class="form-control form-control-color" id="element-font-color" value="#000000">
        </div>
        <div class="mb-3">
          <label class="form-label">Tekstgewicht</label>
          <select class="form-select" id="element-font-weight">
            <option value="normal">Normaal</option>
            <option value="bold">Vet</option>
          </select>
        </div>
      `
      );
    } else if (type === "image") {
      return (
        baseFields +
        `
        <div class="mb-3">
          <label class="form-label">Afbeelding *</label>
          <input type="file" class="form-control" id="element-image" accept="image/*">
        </div>
      `
      );
    } else {
      return (
        baseFields +
        `
        <div class="alert alert-info">
          Dit veld wordt automatisch berekend bij het genereren van een factuur.
        </div>
      `
      );
    }
  },

  async updateTemplateSettings() {
    const name = document.getElementById("edit-template-name").value.trim();
    const description = document
      .getElementById("edit-template-description")
      .value.trim();
    const is_default = document.getElementById("edit-template-default").checked;
    const hourly_rate =
      parseFloat(document.getElementById("edit-template-hourly-rate").value) ||
      0;
    const km_rate =
      parseFloat(document.getElementById("edit-template-km-rate").value) || 0;
    const dot_rate =
      parseFloat(document.getElementById("edit-template-dot-rate").value) || 0;
    const dot_rate_is_percent = document.getElementById(
      "edit-template-dot-rate-percent"
    ).checked;

    if (!name) {
      showToast(t("ui", "invoice.template_name_required"), "error");
      return;
    }

    try {
      await api.updateInvoiceTemplate(this.currentTemplate.id, {
        name,
        description,
        is_default: is_default ? 1 : 0,
        hourly_rate,
        km_rate,
        dot_rate,
        dot_rate_is_percent: dot_rate_is_percent ? 1 : 0,
      });

      showToast(t("ui", "invoice.template_updated", "Template settings updated"), "success");
      await this.loadData();
      await this.editTemplate(this.currentTemplate.id);
    } catch (error) {
      console.error("Error updating template:", error);
      showToast(
        `${t("ui", "invoice.template_update_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async addElement() {
    const templateId = this.currentTemplate.id;
    const type = document.getElementById("element-type").value;
    const label = document.getElementById("element-label").value;
    const order = document.getElementById("element-order").value;

    const formData = new FormData();
    formData.append("element_type", type);
    formData.append("label", label);
    formData.append("position_order", order);

    // Handle text-based types (including new layout types)
    if (
      type === "text" ||
      type.startsWith("top_") ||
      type.startsWith("address_")
    ) {
      const content = document.getElementById("element-content").value;
      const fontSize = document.getElementById("element-font-size").value;
      const fontColor = document.getElementById("element-font-color").value;
      const fontWeight = document.getElementById("element-font-weight").value;

      if (!content) {
        showToast(t("ui", "invoice.text_required"), "error");
        return;
      }

      formData.append("content", content);
      formData.append("font_size", fontSize);
      formData.append("font_color", fontColor);
      formData.append("font_weight", fontWeight);
    } else if (type === "sender" || type === "title") {
      const content = document.getElementById("element-content").value;
      const fontSize = document.getElementById("element-font-size").value;
      const fontColor = document.getElementById("element-font-color").value;
      const fontWeight = document.getElementById("element-font-weight").value;

      if (!content) {
        showToast(t("ui", "invoice.text_required"), "error");
        return;
      }

      formData.append("content", content);
      formData.append("font_size", fontSize);
      formData.append("font_color", fontColor);
      formData.append("font_weight", fontWeight);
    } else if (type === "image") {
      const imageFile = document.getElementById("element-image").files[0];
      if (!imageFile) {
        showToast(t("ui", "invoice.select_image"), "error");
        return;
      }
      formData.append("image", imageFile);
    }

    try {
      await api.addTemplateElement(templateId, formData);
      showToast(t("ui", "invoice.element_added"), "success");
      await this.editTemplate(templateId);
    } catch (error) {
      console.error("Error adding element:", error);
      showToast(
        `${t("ui", "invoice.element_add_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  renderTemplateElements() {
    const elements = this.currentTemplate.elements || [];

    if (elements.length === 0) {
      return `<p class="text-muted text-center">${t(
        "ui",
        "invoice.no_elements"
      )}</p>`;
    }

    return elements
      .map((el, index) => {
        let preview = "";

        // Handle text-based types (including new layout types)
        if (
          el.element_type === "text" ||
          el.element_type === "sender" ||
          el.element_type === "title" ||
          el.element_type.startsWith("top_") ||
          el.element_type.startsWith("address_")
        ) {
          preview = `<p style="font-size: ${el.font_size}px; color: ${el.font_color}; font-weight: ${el.font_weight};">${el.content}</p>`;
        } else if (el.element_type === "image" && el.image_path) {
          preview = `<img src="${el.image_path}" alt="Template image" style="max-width: 200px; max-height: 100px;">`;
        } else {
          preview = `<span class="badge bg-secondary">${el.element_type.toUpperCase()}</span>`;
        }

        return `
        <div class="card mb-2">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <strong>#${el.position_order}</strong>
              </div>
              <div class="col">
                <small class="text-muted">${el.label || el.element_type}</small>
                <div>${preview}</div>
              </div>
              <div class="col-auto">
                <button class="btn btn-sm btn-outline-primary" onclick="invoiceManager.editElement(${
                  el.id
                })">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="invoiceManager.deleteElement(${
                  el.id
                })">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  },

  async editElement(elementId) {
    const element = (this.currentTemplate.elements || []).find(
      (e) => e.id === elementId
    );
    if (!element) {
      showToast(t("ui", "invoice.element_not_found"), "error");
      return;
    }

    // Show modal for editing
    const modalHtml = `
      <div class="modal fade" id="editElementModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Element Bewerken</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Element Type</label>
                <input type="text" class="form-control" value="${
                  element.element_type
                }" disabled>
              </div>
              <div class="mb-3">
                <label class="form-label">Label / Omschrijving</label>
                <input type="text" class="form-control" id="edit-element-label" value="${
                  element.label || ""
                }">
              </div>
              <div class="mb-3">
                <label class="form-label">Volgorde</label>
                <input type="number" class="form-control" id="edit-element-order" value="${
                  element.position_order || 0
                }">
              </div>
              
              ${
                element.element_type === "image"
                  ? `
                <div class="mb-3">
                  <label class="form-label">Afbeelding</label>
                  ${
                    element.image_path
                      ? `<img src="${element.image_path}" style="max-width: 200px; max-height: 100px; display: block; margin-bottom: 10px;">`
                      : ""
                  }
                  <input type="file" class="form-control" id="edit-element-image" accept="image/*">
                  <small class="form-text text-muted">Laat leeg om huidige afbeelding te behouden</small>
                </div>
              `
                  : `
                <div class="mb-3">
                  <label class="form-label">Tekst Inhoud</label>
                  <textarea class="form-control" id="edit-element-content" rows="3">${
                    element.content || ""
                  }</textarea>
                </div>
                
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Lettergrootte</label>
                      <input type="number" class="form-control" id="edit-element-font-size" value="${
                        element.font_size || 14
                      }">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Kleur</label>
                      <input type="color" class="form-control form-control-color" id="edit-element-font-color" value="${
                        element.font_color || "#000000"
                      }">
                    </div>
                  </div>
                </div>
                
                <div class="mb-3">
                  <label class="form-label">Vetgedrukt</label>
                  <select class="form-select" id="edit-element-font-weight">
                    <option value="normal" ${
                      element.font_weight === "normal" ? "selected" : ""
                    }>Normaal</option>
                    <option value="bold" ${
                      element.font_weight === "bold" ? "selected" : ""
                    }>Vet</option>
                  </select>
                </div>
              `
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
              <button type="button" class="btn btn-primary" onclick="invoiceManager.saveElementChanges(${elementId})">
                <i class="bi bi-save"></i> Opslaan
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to DOM
    let modalContainer = document.getElementById(
      "edit-element-modal-container"
    );
    if (!modalContainer) {
      modalContainer = document.createElement("div");
      modalContainer.id = "edit-element-modal-container";
      document.body.appendChild(modalContainer);
    }
    modalContainer.innerHTML = modalHtml;

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("editElementModal")
    );
    modal.show();
  },

  async saveElementChanges(elementId) {
    const element = (this.currentTemplate.elements || []).find(
      (e) => e.id === elementId
    );
    if (!element) {
      showToast("Element niet gevonden", "error");
      return;
    }

    const label = document.getElementById("edit-element-label").value;
    const order = document.getElementById("edit-element-order").value;

    const formData = new FormData();
    formData.append("label", label);
    formData.append("position_order", order);

    if (element.element_type === "image") {
      const imageFile = document.getElementById("edit-element-image").files[0];
      if (imageFile) {
        formData.append("image", imageFile);
      }
    } else {
      const content = document.getElementById("edit-element-content").value;
      const fontSize = document.getElementById("edit-element-font-size").value;
      const fontColor = document.getElementById(
        "edit-element-font-color"
      ).value;
      const fontWeight = document.getElementById(
        "edit-element-font-weight"
      ).value;

      if (!content) {
        showToast("Tekst inhoud is verplicht", "error");
        return;
      }

      formData.append("content", content);
      formData.append("font_size", fontSize);
      formData.append("font_color", fontColor);
      formData.append("font_weight", fontWeight);
    }

    try {
      await api.updateTemplateElement(
        this.currentTemplate.id,
        elementId,
        formData
      );
      showToast(t("ui", "invoice.element_updated"), "success");

      // Close modal
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("editElementModal")
      );
      if (modal) modal.hide();

      // Reload template
      await this.editTemplate(this.currentTemplate.id);
    } catch (error) {
      console.error("Error updating element:", error);
      showToast(
        `${t("ui", "invoice.element_update_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async deleteElement(elementId) {
    if (!confirm(t("ui", "confirm_delete_element"))) {
      return;
    }

    try {
      await api.deleteTemplateElement(this.currentTemplate.id, elementId);
      showToast(t("ui", "invoice.element_deleted"), "success");
      await this.editTemplate(this.currentTemplate.id);
    } catch (error) {
      console.error("Error deleting element:", error);
      showToast(t("ui", "invoice.element_delete_failed"), "error");
    }
  },

  async duplicateTemplate(templateId) {
    try {
      const sourceTemplate = this.templates.find((t) => t.id === templateId);
      if (!sourceTemplate) {
        showToast(t("ui", "invoice.template_not_found"), "error");
        return;
      }

      // Get full template with elements
      const fullTemplate = await api.getInvoiceTemplate(templateId);

      // Create new template with "Copy" suffix
      const newName = `${sourceTemplate.name} (kopie)`;
      const newTemplate = await api.createInvoiceTemplate({
        name: newName,
        description: sourceTemplate.description,
        is_default: 0, // Never set copy as default
      });

      // Duplicate all elements
      if (fullTemplate.elements && fullTemplate.elements.length > 0) {
        for (const element of fullTemplate.elements) {
          const formData = new FormData();
          formData.append("element_type", element.element_type);
          formData.append("label", element.label || "");
          formData.append("content", element.content || "");
          formData.append("position_order", element.position_order || 0);
          formData.append("font_size", element.font_size || 14);
          formData.append("font_color", element.font_color || "#000000");
          formData.append("font_weight", element.font_weight || "normal");
          formData.append(
            "calculation_formula",
            element.calculation_formula || ""
          );

          // Note: images won't be duplicated (would need file download), but that's OK
          await api.addTemplateElement(newTemplate.id, formData);
        }
      }

      showToast(
        `${t("ui", "invoice.template_created")}: ${newName}`,
        "success"
      );
      await this.loadData();
      this.showTemplates();
    } catch (error) {
      console.error("Error duplicating template:", error);
      showToast(
        `${t("ui", "invoice.template_duplicate_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async deleteTemplate(templateId) {
    if (!confirm(t("ui", "confirm_delete_template"))) {
      return;
    }

    try {
      await api.deleteInvoiceTemplate(templateId);
      showToast(t("ui", "invoice.template_deleted"), "success");
      await this.loadData();
      this.showTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      showToast(
        `${t("ui", "invoice.template_delete_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async previewTemplatePDF() {
    try {
      const templateId = this.currentTemplate.id;
      if (!templateId) {
        showToast(t("ui", "invoice.template_id_missing"), "error");
        return;
      }

      const pdfUrl = `/api/invoices/template/${templateId}/preview-pdf`;
      console.log("Fetching PDF preview:", pdfUrl);

      showToast(t("ui", "invoice.pdf_generating"), "info");

      // Fetch PDF as blob
      const response = await fetch(pdfUrl);
      console.log("Response status:", response.status, response.statusText);
      console.log(
        "Response headers:",
        response.headers.get("content-type"),
        response.headers.get("content-length")
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", errorText);
        throw new Error("Failed to generate PDF: " + response.status);
      }

      const blob = await response.blob();
      console.log("Blob received:", blob.size, "bytes, type:", blob.type);

      if (blob.size === 0) {
        throw new Error("PDF is leeg (0 bytes)");
      }

      const blobUrl = URL.createObjectURL(blob);

      // Open blob URL in new window
      window.open(blobUrl, "_blank");
      showToast("PDF preview geopend", "success");
    } catch (error) {
      console.error("Error generating preview:", error);
      showToast(
        `${t("ui", "invoice.preview_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  // ============================================
  // CREATE INVOICE
  // ============================================

  async showCreateInvoice() {
    if (this.templates.length === 0) {
      showToast("Maak eerst een template aan", "error");
      this.showTemplates();
      return;
    }

    try {
      this.editingInvoiceId = null;
      this.editingInvoiceStatus = null;
      const nextNumber = await api.getNextInvoiceNumber();

      const content = document.getElementById("content");
      content.innerHTML = `
        <div class="container-fluid mt-4">
          <div class="row mb-4">
            <div class="col">
              <h2><i class="bi bi-plus-circle"></i> Nieuwe Factuur Maken</h2>
            </div>
            <div class="col-auto">
              <button class="btn btn-outline-secondary" onclick="invoiceManager.renderInvoiceList()">
                <i class="bi bi-x"></i> Annuleren
              </button>
            </div>
          </div>

          <div class="row">
            <div class="col-md-8">
              <div class="card mb-4">
                <div class="card-header">
                  <h5>Factuur Gegevens</h5>
                </div>
                <div class="card-body">
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label class="form-label">Template *</label>
                      <select class="form-select" id="invoice-template" onchange="invoiceManager.onTemplateSelected()">
                        ${this.templates
                          .map(
                            (t) => `
                          <option value="${t.id}" ${
                              t.is_default ? "selected" : ""
                            }>${t.name}</option>
                        `
                          )
                          .join("")}
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Factuurnummer *</label>
                      <input type="text" class="form-control" id="invoice-number" value="${
                        nextNumber.invoice_number
                      }">
                    </div>
                  </div>

                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label class="form-label">Factuurdatum *</label>
                      <input type="date" class="form-control" id="invoice-date" value="${
                        new Date().toISOString().split("T")[0]
                      }">
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Vervaldatum</label>
                      <input type="date" class="form-control" id="invoice-due-date">
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Klant Naam (optioneel)</label>
                    <div class="input-group">
                      <input type="text" class="form-control" id="customer-name">
                      <button class="btn btn-outline-secondary" type="button" onclick="invoiceManager.fillCustomerFromTemplate()" title="Vul in vanuit template">
                        <i class="bi bi-arrow-repeat"></i>
                      </button>
                    </div>
                    <small class="text-muted">Kan automatisch ingevuld worden vanuit het template</small>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Klant Adres (optioneel)</label>
                    <textarea class="form-control" id="customer-address" rows="3"></textarea>
                    <small class="text-muted">Kan automatisch ingevuld worden vanuit het template</small>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Opmerkingen</label>
                    <textarea class="form-control" id="invoice-notes" rows="2"></textarea>
                  </div>
                </div>
              </div>

              <!-- Line Items -->
              <div class="card">
                <div class="card-header">
                  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h5 class="mb-0">Factuurregels</h5>
                    <div class="d-flex gap-2 flex-wrap">
                      <button class="btn btn-sm btn-outline-info" onclick="invoiceManager.showSubmissionHistoryModal()">
                        <i class="bi bi-clock-history"></i> Importeer uit History
                      </button>
                      <button class="btn btn-sm btn-primary" onclick="invoiceManager.addLineItem()">
                        <i class="bi bi-plus"></i> Regel Toevoegen
                      </button>
                    </div>
                  </div>
                </div>
                <div class="card-body">
                  <div id="line-items-container">
                    <!-- Line items will be added here -->
                  </div>
                  
                  <div class="text-end mt-4">
                    <div class="row">
                      <div class="col-8 text-end">
                        <strong>Subtotaal:</strong>
                      </div>
                      <div class="col-4 text-end">
                        <span id="invoice-subtotal">€ 0.00</span>
                      </div>
                    </div>
                    <div class="row mt-2">
                      <div class="col-8 text-end">
                        <strong>BTW (21%):</strong>
                      </div>
                      <div class="col-4 text-end">
                        <span id="invoice-vat">€ 0.00</span>
                      </div>
                    </div>
                    <div class="row mt-2">
                      <div class="col-8 text-end">
                        <h5>Totaal:</h5>
                      </div>
                      <div class="col-4 text-end">
                        <h5 id="invoice-total">€ 0.00</h5>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-4">
              <div class="card sticky-top" style="top: 20px;">
                <div class="card-header">
                  <h5>Acties</h5>
                </div>
                <div class="card-body">
                  <button class="btn btn-primary w-100 mb-2" onclick="invoiceManager.saveInvoice()">
                    <i class="bi bi-save"></i> Factuur Opslaan
                  </button>
                  <button class="btn btn-outline-primary w-100 mb-2" onclick="invoiceManager.saveAndGeneratePDF()">
                    <i class="bi bi-file-pdf"></i> Opslaan & PDF Genereren
                  </button>
                  <button class="btn btn-outline-success w-100" onclick="invoiceManager.saveAndEmail()">
                    <i class="bi bi-envelope"></i> Opslaan & Mailen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Add one default line item
      this.addLineItem();
    } catch (error) {
      console.error("Error showing create invoice:", error);
      showToast(t("ui", "invoice.prepare_failed"), "error");
    }
  },

  async showEditInvoice(invoiceId) {
    try {
      const invoice = await api.getInvoice(invoiceId);
      this.editingInvoiceId = invoice.id;
      this.editingInvoiceStatus = invoice.status || "draft";

      const content = document.getElementById("content");
      content.innerHTML = `
        <div class="container-fluid mt-4">
          <div class="row mb-4">
            <div class="col">
              <h2><i class="bi bi-pencil"></i> Factuur Bewerken</h2>
              <div class="text-muted">Factuurnummer: ${
                invoice.invoice_number
              }</div>
            </div>
            <div class="col-auto">
              <button class="btn btn-outline-secondary" onclick="invoiceManager.renderInvoiceList()">
                <i class="bi bi-arrow-left"></i> Terug naar facturen
              </button>
            </div>
          </div>

          <div class="row">
            <div class="col-md-8">
              <div class="card mb-4">
                <div class="card-header">
                  <h5>Factuur Gegevens</h5>
                </div>
                <div class="card-body">
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label class="form-label">Template *</label>
                      <select class="form-select" id="invoice-template" onchange="invoiceManager.onTemplateSelected()">
                        ${this.templates
                          .map(
                            (t) => `
                          <option value="${t.id}" ${
                              t.id === invoice.template_id ? "selected" : ""
                            }>${t.name}</option>
                        `
                          )
                          .join("")}
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Factuurnummer *</label>
                      <input type="text" class="form-control" id="invoice-number" value="${
                        invoice.invoice_number
                      }" readonly>
                      <small class="text-muted">Factuurnummer blijft gelijk bij bewerken</small>
                    </div>
                  </div>

                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label class="form-label">Factuurdatum *</label>
                      <input type="date" class="form-control" id="invoice-date" value="${
                        invoice.invoice_date || ""
                      }">
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Vervaldatum</label>
                      <input type="date" class="form-control" id="invoice-due-date" value="${
                        invoice.due_date || ""
                      }">
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Klant Naam (optioneel)</label>
                    <div class="input-group">
                      <input type="text" class="form-control" id="customer-name" value="${
                        invoice.customer_name || ""
                      }">
                      <button class="btn btn-outline-secondary" type="button" onclick="invoiceManager.fillCustomerFromTemplate()" title="Vul in vanuit template">
                        <i class="bi bi-arrow-repeat"></i>
                      </button>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Klant Adres (optioneel)</label>
                    <textarea class="form-control" id="customer-address" rows="3">${
                      invoice.customer_address || ""
                    }</textarea>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Opmerkingen</label>
                    <textarea class="form-control" id="invoice-notes" rows="2">${
                      invoice.notes || ""
                    }</textarea>
                  </div>
                </div>
              </div>

              <!-- Line Items -->
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Factuurregels</h5>
                  <div>
                    <button class="btn btn-sm btn-outline-info me-2" onclick="invoiceManager.showSubmissionHistoryModal()">
                      <i class="bi bi-clock-history"></i> Importeer uit History
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="invoiceManager.addLineItem()">
                      <i class="bi bi-plus"></i> Regel Toevoegen
                    </button>
                  </div>
                </div>
                <div class="card-body">
                  <div id="line-items-container"></div>
                  
                  <div class="text-end mt-4">
                    <div class="row">
                      <div class="col-8 text-end">
                        <strong>Subtotaal:</strong>
                      </div>
                      <div class="col-4 text-end">
                        <span id="invoice-subtotal">€ 0.00</span>
                      </div>
                    </div>
                    <div class="row mt-2">
                      <div class="col-8 text-end">
                        <strong>BTW (21%):</strong>
                      </div>
                      <div class="col-4 text-end">
                        <span id="invoice-vat">€ 0.00</span>
                      </div>
                    </div>
                    <div class="row mt-2">
                      <div class="col-8 text-end">
                        <h5>Totaal:</h5>
                      </div>
                      <div class="col-4 text-end">
                        <h5 id="invoice-total">€ 0.00</h5>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-4">
              <div class="card sticky-top" style="top: 20px;">
                <div class="card-header">
                  <h5>Acties</h5>
                </div>
                <div class="card-body">
                  <button class="btn btn-primary w-100 mb-2" onclick="invoiceManager.saveInvoice()">
                    <i class="bi bi-save"></i> Wijzigingen Opslaan
                  </button>
                  <button class="btn btn-outline-primary w-100 mb-2" onclick="invoiceManager.saveAndGeneratePDF()">
                    <i class="bi bi-file-pdf"></i> Opslaan & PDF Genereren
                  </button>
                  <button class="btn btn-outline-success w-100" onclick="invoiceManager.saveAndEmail()">
                    <i class="bi bi-envelope"></i> Opslaan & Mailen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.setLineItems(invoice.line_items || []);
      this.calculateTotals();
    } catch (error) {
      console.error("Error showing edit invoice:", error);
      showToast(t("ui", "invoice.load_for_edit_failed"), "error");
    }
  },

  async showSubmissionHistoryModal() {
    try {
      const submissions = await api.getSubmissions();

      if (!submissions || submissions.length === 0) {
        showToast(t("ui", "invoice.no_submission_history"), "info");
        return;
      }

      // Fetch timesheet details for each submission and group by week
      const weekGroups = {};
      const allTimesheets = [];

      for (const submission of submissions) {
        if (submission.timesheet_ids) {
          const ids = submission.timesheet_ids
            .split(",")
            .map((id) => parseInt(id.trim()));

          // Fetch all timesheet details at once
          const timesheetDetails = await api.getTimesheetDetails(ids);

          for (const ts of timesheetDetails) {
            const fullTimesheet = {
              ...ts,
              submission_date: submission.submission_date,
              submission_status: submission.status,
            };

            allTimesheets.push(fullTimesheet);

            // Group by week
            if (!weekGroups[ts.week_number]) {
              weekGroups[ts.week_number] = [];
            }
            weekGroups[ts.week_number].push(fullTimesheet);
          }
        }
      }

      if (allTimesheets.length === 0) {
        showToast("Geen timesheet data gevonden", "info");
        return;
      }

      // Build individual timesheets table
      const individualTableHtml = `
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th><input type="checkbox" id="select-all-timesheets" onchange="invoiceManager.toggleAllTimesheets(this)"></th>
                <th>Week</th>
                <th>Bedrijf</th>
                <th>Ritnummer</th>
                <th>Datum</th>
                <th>KM</th>
                <th>Uren</th>
              </tr>
            </thead>
            <tbody>
              ${allTimesheets
                .sort(
                  (a, b) => parseInt(b.week_number) - parseInt(a.week_number)
                )
                .map(
                  (ts, idx) => `
                <tr>
                  <td>
                    <input type="checkbox" class="timesheet-checkbox" data-index="${idx}" 
                           data-ritnumber="${ts.ritnumber || ""}" 
                           data-date="${ts.date || ""}" 
                           data-km="${
                             ts.total_km || ts.end_km - ts.start_km || 0
                           }" 
                           data-hours="${ts.total_hours || 0}">
                  </td>
                  <td>${ts.week_number || "-"}</td>
                  <td>${ts.company_name || "Unknown"}</td>
                  <td>${ts.ritnumber || "-"}</td>
                  <td>${ts.date || "-"}</td>
                  <td>${(ts.total_km || ts.end_km - ts.start_km || 0).toFixed(
                    2
                  )}</td>
                  <td>${(ts.total_hours || 0).toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;

      // Build weekly summary table
      const sortedWeeks = Object.keys(weekGroups).sort(
        (a, b) => parseInt(b) - parseInt(a)
      );
      const weeklyTableHtml = `
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th><input type="checkbox" id="select-all-weeks" onchange="invoiceManager.toggleAllWeeks(this)"></th>
                <th>Week</th>
                <th>Bedrijf</th>
                <th>Aantal Regels</th>
                <th>Totaal KM</th>
                <th>Totaal Uren</th>
              </tr>
            </thead>
            <tbody>
              ${sortedWeeks
                .map((weekNum) => {
                  const weeksInThisWeek = weekGroups[weekNum];
                  const totalKm = weeksInThisWeek.reduce(
                    (sum, ts) =>
                      sum + (ts.total_km || ts.end_km - ts.start_km || 0),
                    0
                  );
                  const totalHours = weeksInThisWeek.reduce(
                    (sum, ts) => sum + (ts.total_hours || 0),
                    0
                  );
                  const companies = [
                    ...new Set(
                      weeksInThisWeek.map((ts) => ts.company_name || "Unknown")
                    ),
                  ].join(", ");

                  return `
                <tr>
                  <td>
                    <input type="checkbox" class="week-checkbox" data-week="${weekNum}" 
                           data-company="${companies}">
                  </td>
                  <td>Week ${weekNum}</td>
                  <td>${companies}</td>
                  <td>${weeksInThisWeek.length}</td>
                  <td>${totalKm.toFixed(2)}</td>
                  <td>${totalHours.toFixed(2)}</td>
                </tr>
              `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `;

      // Create modal with tabs
      const modalHtml = `
        <div class="modal fade" id="submissionHistoryModal" tabindex="-1">
          <div class="modal-dialog modal-xl">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Selecteer uit Submission History</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <ul class="nav nav-tabs mb-3" role="tablist">
                  <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="individual-tab" data-bs-toggle="tab" 
                            data-bs-target="#individual-pane" type="button" role="tab">
                      <i class="bi bi-list"></i> Losse Regels
                    </button>
                  </li>
                  <li class="nav-item" role="presentation">
                    <button class="nav-link" id="weekly-tab" data-bs-toggle="tab" 
                            data-bs-target="#weekly-pane" type="button" role="tab">
                      <i class="bi bi-calendar-week"></i> Per Week
                    </button>
                  </li>
                </ul>

                <div class="tab-content">
                  <div class="tab-pane fade show active" id="individual-pane" role="tabpanel">
                    ${individualTableHtml}
                  </div>
                  <div class="tab-pane fade" id="weekly-pane" role="tabpanel">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <div class="input-group input-group-sm" style="max-width: 420px;">
                        <span class="input-group-text"><i class="bi bi-gear"></i></span>
                        <select class="form-select" id="weekly-import-mode">
                          <option value="per-timesheet" selected>Per regel (timesheet)</option>
                          <option value="aggregate-company">Samengevoegd per week/bedrijf</option>
                        </select>
                      </div>
                    </div>
                    ${weeklyTableHtml}
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
                <button type="button" class="btn btn-primary" id="import-history-btn" onclick="invoiceManager.importFromHistory()">
                  <i class="bi bi-download"></i> Importeer
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Remove existing modal if any
      const existingModal = document.getElementById("submissionHistoryModal");
      if (existingModal) {
        existingModal.remove();
      }

      // Add modal to body
      document.body.insertAdjacentHTML("beforeend", modalHtml);

      // Store week groups for later use
      window.invoiceWeekGroups = weekGroups;

      // Show modal
      const modal = new bootstrap.Modal(
        document.getElementById("submissionHistoryModal")
      );
      modal.show();
    } catch (error) {
      console.error("Error loading submission history:", error);
      showToast(t("ui", "invoice.submission_history_load_failed"), "error");
    }
  },

  toggleAllTimesheets(checkbox) {
    const checkboxes = document.querySelectorAll(".timesheet-checkbox");
    checkboxes.forEach((cb) => (cb.checked = checkbox.checked));
  },

  toggleAllWeeks(checkbox) {
    const checkboxes = document.querySelectorAll(".week-checkbox");
    checkboxes.forEach((cb) => (cb.checked = checkbox.checked));
  },

  importFromHistory() {
    // Check which tab is active
    const activeTab = document.querySelector(".tab-pane.active");

    if (activeTab && activeTab.id === "weekly-pane") {
      this.importWeeks();
    } else {
      this.importSelectedTimesheets();
    }
  },

  importWeeks() {
    const checkboxes = document.querySelectorAll(".week-checkbox:checked");

    if (checkboxes.length === 0) {
      showToast("Selecteer minimaal één week", "warning");
      return;
    }

    const selectedWeeks = Array.from(checkboxes).map((cb) =>
      parseInt(cb.dataset.week)
    );

    // Get all timesheets for selected weeks
    const weeksData = window.invoiceWeekGroups || {};
    let importedCount = 0;

    const mode =
      document.getElementById("weekly-import-mode")?.value || "per-timesheet";

    for (const weekNum of selectedWeeks) {
      const weekTs = weeksData[weekNum];
      if (!weekTs || !weekTs.length) continue;

      if (mode === "aggregate-company") {
        // Group by company and import one line per company per week
        const byCompany = {};
        weekTs.forEach((ts) => {
          const key = ts.company_name || "Unknown";
          if (!byCompany[key]) byCompany[key] = [];
          byCompany[key].push(ts);
        });

        for (const [company, rows] of Object.entries(byCompany)) {
          const totalKm = rows.reduce(
            (sum, ts) => sum + (ts.total_km ?? ts.end_km - ts.start_km ?? 0),
            0
          );
          const totalHours = rows.reduce(
            (sum, ts) =>
              sum +
              (ts.total_hours != null
                ? parseFloat(ts.total_hours)
                : this.computeHours(ts.start_time, ts.end_time, ts.pause_time)),
            0
          );

          this.addLineItem({
            description: `Week ${weekNum} - ${company}`,
            item_date: rows[0].date,
            item_km: totalKm,
            item_hours: parseFloat(totalHours.toFixed(2)),
            quantity: 1,
            unit_price: 0,
          });
          importedCount++;
        }
      } else {
        // Per timesheet: one line per row, description only ritnummer
        weekTs.forEach((ts) => {
          const km = ts.total_km ?? ts.end_km - ts.start_km ?? 0;
          const hours =
            ts.total_hours != null
              ? parseFloat(ts.total_hours)
              : this.computeHours(ts.start_time, ts.end_time, ts.pause_time);
          const rit = ts.ritnumber || "Geen ritnummer";

          this.addLineItem({
            description: rit,
            item_date: ts.date,
            item_km: km,
            item_hours: hours,
            item_rate: 65, // Default rate for transport
            quantity: 1,
            unit_price: 0,
          });
          importedCount++;
        });
      }
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("submissionHistoryModal")
    );
    if (modal) {
      modal.hide();
    }

    showToast(`${importedCount} regel(s) toegevoegd`, "success");
  },

  computeHours(startTime, endTime, pauseTime) {
    if (!startTime || !endTime || !pauseTime) return 0;
    const [sh, sm] = String(startTime).split(":").map(Number);
    const [eh, em] = String(endTime).split(":").map(Number);
    const [ph, pm] = String(pauseTime).split(":").map(Number);
    if ([sh, sm, eh, em, ph, pm].some((v) => Number.isNaN(v))) return 0;
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const pauseMin = ph * 60 + pm;
    const totalMin = endMin - startMin - pauseMin;
    return Math.max(0, parseFloat((totalMin / 60).toFixed(2)));
  },

  importSelectedTimesheets() {
    const checkboxes = document.querySelectorAll(".timesheet-checkbox:checked");

    if (checkboxes.length === 0) {
      showToast("Selecteer minimaal één timesheet", "warning");
      return;
    }

    // Import each selected timesheet as a line item
    checkboxes.forEach((checkbox) => {
      const ritnumber = checkbox.dataset.ritnumber;
      const date = checkbox.dataset.date;
      const km = parseFloat(checkbox.dataset.km) || 0;
      const hours = parseFloat(checkbox.dataset.hours) || 0;

      // Add line item with submission data
      this.addLineItem({
        description: ritnumber || "Geen ritnummer",
        item_date: date,
        item_km: km,
        item_hours: hours,
        quantity: 1,
        unit_price: 0,
      });
    });

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("submissionHistoryModal")
    );
    if (modal) {
      modal.hide();
    }

    showToast(`${checkboxes.length} regel(s) toegevoegd`, "success");
  },

  addLineItem(defaults = {}) {
    const container = document.getElementById("line-items-container");
    const index = container.children.length;

    const descriptionVal = defaults.description || "";
    const quantityVal = defaults.quantity ?? 1;
    const priceVal = defaults.unit_price ?? 0;

    const dateVal = defaults.item_date ?? "";
    const kmVal = defaults.item_km ?? "";
    const hoursVal = defaults.item_hours ?? "";

    // Get template rates
    const templateId = document.getElementById("invoice-template")?.value;
    const template = this.templates.find((t) => t.id == templateId);
    const defaultRate = template?.hourly_rate || 0;

    const rateVal = defaults.item_rate ?? defaultRate;

    const lineItem = document.createElement("div");
    lineItem.className = "card mb-2";
    lineItem.innerHTML = `
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label class="form-label small">Omschrijving</label>
            <input type="text" class="form-control form-control-sm line-description" data-index="${index}" value="${descriptionVal}">
          </div>
          <div class="col-md-2">
            <label class="form-label small">Datum</label>
            <input type="date" class="form-control form-control-sm line-date" data-index="${index}" value="${dateVal}">
          </div>
          <div class="col-md-1">
            <label class="form-label small">KM</label>
            <input type="number" class="form-control form-control-sm line-km" data-index="${index}" 
                   value="${kmVal}" min="0" step="1">
          </div>
          <div class="col-md-1">
            <label class="form-label small">Uren</label>
            <input type="number" class="form-control form-control-sm line-hours" data-index="${index}" 
                   value="${hoursVal}" min="0" step="0.01" onchange="invoiceManager.calculateLineTotal(${index})">
          </div>
          <div class="col-md-1">
            <label class="form-label small">Tarief</label>
            <input type="number" class="form-control form-control-sm line-rate" data-index="${index}" 
                   value="${rateVal}" min="0" step="0.01" onchange="invoiceManager.calculateLineTotal(${index})">
          </div>
          <div class="col-md-1">
            <label class="form-label small">Aantal</label>
            <input type="number" class="form-control form-control-sm line-quantity" data-index="${index}" 
                   value="${quantityVal}" min="0" step="0.01" onchange="invoiceManager.calculateTotals()">
          </div>
          <div class="col-md-2">
            <label class="form-label small">Exclusief BTW</label>
            <input type="number" class="form-control form-control-sm line-price" data-index="${index}" 
                   value="${priceVal}" min="0" step="0.01" readonly style="background-color: #f0f0f0;">
          </div>
          <div class="col-md-1 text-end">
            <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.card').remove(); invoiceManager.calculateTotals()">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(lineItem);

    // Calculate initial line total
    this.calculateLineTotal(index);
  },

  setLineItems(items) {
    const container = document.getElementById("line-items-container");
    container.innerHTML = "";

    if (items && items.length) {
      items.forEach((item) => this.addLineItem(item));
    } else {
      this.addLineItem();
    }

    this.calculateTotals();
  },

  calculateLineTotal(index) {
    // Calculate: Hours * Rate = Price (Exclusief BTW)
    const hoursInputs = document.querySelectorAll(".line-hours");
    const rateInputs = document.querySelectorAll(".line-rate");
    const priceInputs = document.querySelectorAll(".line-price");

    if (hoursInputs[index] && rateInputs[index] && priceInputs[index]) {
      const hours = parseFloat(hoursInputs[index].value) || 0;
      const rate = parseFloat(rateInputs[index].value) || 0;
      const lineTotal = hours * rate;

      priceInputs[index].value = lineTotal.toFixed(2);
    }

    this.calculateTotals();
  },

  calculateTotals() {
    const quantities = document.querySelectorAll(".line-quantity");
    const prices = document.querySelectorAll(".line-price");

    let subtotal = 0;
    quantities.forEach((qtyInput, index) => {
      const qty = parseFloat(qtyInput.value) || 0;
      const price = parseFloat(prices[index].value) || 0;
      subtotal += qty * price;
    });

    const vat = subtotal * 0.21;
    const total = subtotal + vat;

    document.getElementById(
      "invoice-subtotal"
    ).textContent = `€ ${subtotal.toFixed(2)}`;
    document.getElementById("invoice-vat").textContent = `€ ${vat.toFixed(2)}`;
    document.getElementById("invoice-total").textContent = `€ ${total.toFixed(
      2
    )}`;
  },

  getLineItems() {
    const lineItems = [];
    const descriptions = document.querySelectorAll(".line-description");
    const dates = document.querySelectorAll(".line-date");
    const kms = document.querySelectorAll(".line-km");
    const hours = document.querySelectorAll(".line-hours");
    const rates = document.querySelectorAll(".line-rate");
    const quantities = document.querySelectorAll(".line-quantity");
    const prices = document.querySelectorAll(".line-price");

    descriptions.forEach((desc, index) => {
      const description = desc.value.trim();
      if (description) {
        const item = {
          description,
          quantity: parseFloat(quantities[index].value) || 1,
          unit_price: parseFloat(prices[index].value) || 0,
        };

        // Always include optional fields (even if empty/0)
        if (dates[index]) {
          item.item_date = dates[index].value || null;
        }
        if (kms[index]) {
          const kmVal = kms[index].value;
          item.item_km = kmVal ? parseFloat(kmVal) : null;
        }
        if (hours[index]) {
          const hoursVal = hours[index].value;
          item.item_hours = hoursVal ? parseFloat(hoursVal) : null;
        }
        if (rates[index]) {
          const rateVal = rates[index].value;
          item.item_rate = rateVal ? parseFloat(rateVal) : null;
        }

        lineItems.push(item);
      }
    });

    return lineItems;
  },

  async saveInvoice(returnInvoice = false) {
    const templateId = document.getElementById("invoice-template").value;
    const invoiceNumber = document
      .getElementById("invoice-number")
      .value.trim();
    const invoiceDate = document.getElementById("invoice-date").value;
    const dueDate = document.getElementById("invoice-due-date").value;
    const customerName = document.getElementById("customer-name").value.trim();
    const customerAddress = document
      .getElementById("customer-address")
      .value.trim();
    const notes = document.getElementById("invoice-notes").value.trim();
    const lineItems = this.getLineItems();

    if (!invoiceNumber || !invoiceDate) {
      showToast("Factuurnummer en datum zijn verplicht", "error");
      return null;
    }

    if (lineItems.length === 0) {
      showToast(t("ui", "invoice.add_at_least_one_line"), "error");
      return null;
    }

    try {
      const payload = {
        template_id: templateId,
        invoice_number: invoiceNumber,
        customer_name: customerName || null,
        customer_address: customerAddress || null,
        invoice_date: invoiceDate,
        due_date: dueDate,
        line_items: lineItems,
        notes: notes,
      };

      let invoice;
      if (this.editingInvoiceId) {
        payload.status = this.editingInvoiceStatus || "draft";
        invoice = await api.updateInvoice(this.editingInvoiceId, payload);
        if (!returnInvoice) {
          showToast(t("ui", "invoice.updated"), "success");
        }
      } else {
        invoice = await api.createInvoice(payload);
        if (!returnInvoice) {
          showToast(t("ui", "invoice.saved"), "success");
        }
      }

      if (!returnInvoice) {
        this.editingInvoiceId = null;
        this.editingInvoiceStatus = null;
        await this.loadData();
        this.renderInvoiceList();
      } else {
        // keep editing state so follow-up actions (PDF/email) use same invoice id
        await this.loadData();
      }

      return invoice;
    } catch (error) {
      console.error("Error saving invoice:", error);
      showToast(`${t("ui", "invoice.save_failed")}: ${error.message}`, "error");
      return null;
    }
  },

  async onTemplateSelected() {
    // This can be used to update preview or fetch template data
    // Currently just a placeholder for future enhancements
  },

  async fillCustomerFromTemplate() {
    try {
      const templateId = document.getElementById("invoice-template").value;
      const template = this.templates.find((t) => t.id == templateId);

      if (!template) return;

      // Fetch template elements to find address_left content
      const templateData = await api.getInvoiceTemplate(templateId);
      const elements = templateData.elements || [];

      // Find address_left element which contains the customer address
      const addressElement = elements.find(
        (el) => el.element_type === "address_left"
      );

      if (addressElement && addressElement.content) {
        document.getElementById("customer-address").value =
          addressElement.content;
        showToast(t("ui", "invoice.customer_filled_from_template"), "success");
      } else {
        showToast(t("ui", "invoice.customer_missing_in_template"), "info");
      }
    } catch (error) {
      console.error("Error filling customer from template:", error);
      showToast(t("ui", "invoice.template_data_load_failed"), "error");
    }
  },

  async saveAndGeneratePDF() {
    const invoice = await this.saveInvoice(true);
    if (!invoice) return;

    try {
      const result = await api.generateInvoicePDF(invoice.id);
      showToast(t("ui", "invoice.pdf_generated"), "success");

      // Download PDF
      const blob = await api.downloadInvoicePDF(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error generating PDF:", error);
      showToast(
        `${t("ui", "invoice.pdf_generate_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async saveAndEmail() {
    const invoice = await this.saveInvoice(true);
    if (!invoice) return;

    this.showEmailModal(invoice.id);
  },

  // ============================================
  // ACTIONS
  // ============================================

  async viewInvoice(invoiceId) {
    try {
      const invoice = await api.getInvoice(invoiceId);

      const content = document.getElementById("content");
      content.innerHTML = `
        <div class="container-fluid mt-4">
          <div class="row mb-4">
            <div class="col">
              <h2>Factuur ${invoice.invoice_number}</h2>
            </div>
            <div class="col-auto">
              <button class="btn btn-outline-secondary" onclick="invoiceManager.renderInvoiceList()">
                <i class="bi bi-arrow-left"></i> Terug
              </button>
            </div>
          </div>

          <div class="row">
            <div class="col-md-8">
              <div class="card mb-4">
                <div class="card-header">
                  <h5>Factuurgegevens</h5>
                </div>
                <div class="card-body">
                  <div class="row mb-3">
                    <div class="col-6">
                      <strong>Factuurnummer:</strong><br>
                      ${invoice.invoice_number}
                    </div>
                    <div class="col-6">
                      <strong>Status:</strong><br>
                      ${this.getStatusBadge(invoice.status)}
                    </div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-6">
                      <strong>Factuurdatum:</strong><br>
                      ${invoice.invoice_date}
                    </div>
                    <div class="col-6">
                      <strong>Vervaldatum:</strong><br>
                      ${invoice.due_date || "-"}
                    </div>
                  </div>
                  ${
                    invoice.customer_name
                      ? `
                    <div class="mb-3">
                      <strong>Klant:</strong><br>
                      ${invoice.customer_name}
                      ${
                        invoice.customer_address
                          ? `<br>${invoice.customer_address.replace(
                              /\n/g,
                              "<br>"
                            )}`
                          : ""
                      }
                    </div>
                  `
                      : ""
                  }
                </div>
              </div>

              <div class="card">
                <div class="card-header">
                  <h5>Factuurregels</h5>
                </div>
                <div class="card-body">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Omschrijving</th>
                        <th class="text-end">Aantal</th>
                        <th class="text-end">Prijs</th>
                        <th class="text-end">Totaal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${invoice.line_items
                        .map(
                          (item) => `
                        <tr>
                          <td>${item.description}</td>
                          <td class="text-end">${item.quantity}</td>
                          <td class="text-end">€ ${parseFloat(
                            item.unit_price
                          ).toFixed(2)}</td>
                          <td class="text-end">€ ${parseFloat(
                            item.line_total
                          ).toFixed(2)}</td>
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="3" class="text-end"><strong>Subtotaal:</strong></td>
                        <td class="text-end">€ ${parseFloat(
                          invoice.subtotal
                        ).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colspan="3" class="text-end"><strong>BTW (21%):</strong></td>
                        <td class="text-end">€ ${parseFloat(
                          invoice.vat_amount
                        ).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colspan="3" class="text-end"><h5>Totaal:</h5></td>
                        <td class="text-end"><h5>€ ${parseFloat(
                          invoice.total_amount
                        ).toFixed(2)}</h5></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div class="col-md-4">
              <div class="card">
                <div class="card-header">
                  <h5>Acties</h5>
                </div>
                <div class="card-body">
                  <button class="btn btn-secondary w-100 mb-2" onclick="invoiceManager.showEditInvoice(${
                    invoice.id
                  })">
                    <i class="bi bi-pencil"></i> Bewerken
                  </button>
                  <button class="btn btn-success w-100 mb-2" onclick="invoiceManager.downloadPDF(${
                    invoice.id
                  })">
                    <i class="bi bi-file-pdf"></i> Download PDF
                  </button>
                  ${
                    invoice.original_pdf_path
                      ? `
                  <button class="btn btn-warning w-100 mb-2" onclick="invoiceManager.downloadOriginalPDF(${
                    invoice.id
                  })">
                    <i class="bi bi-file-earmark-pdf"></i> ${t(
                      "ui",
                      "invoice.download_original_pdf",
                      "Download Original PDF"
                    )}
                  </button>
                  `
                      : ""
                  }
                  <button class="btn btn-info w-100 mb-2" onclick="invoiceManager.showEmailModal(${
                    invoice.id
                  })">
                    <i class="bi bi-envelope"></i> Verstuur per Email
                  </button>
                  <hr>
                  <button class="btn btn-outline-danger w-100" onclick="invoiceManager.deleteInvoice(${
                    invoice.id
                  })">
                    <i class="bi bi-trash"></i> ${t("ui", "delete")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error viewing invoice:", error);
      showToast(t("ui", "invoice.load_failed"), "error");
    }
  },

  async downloadPDF(invoiceId) {
    try {
      showToast(t("ui", "invoice.pdf_generating"), "info");
      const blob = await api.downloadInvoicePDF(invoiceId);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(t("ui", "invoice.pdf_downloaded"), "success");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      showToast(t("ui", "invoice.download_pdf_failed"), "error");
    }
  },

  async downloadOriginalPDF(invoiceId) {
    try {
      showToast(t("ui", "invoice.original_pdf_downloading"), "info");

      const response = await fetch(
        `${API_BASE_URL}/admin/invoices/invoices/${invoiceId}/original-pdf`,
        {
          headers: {
            Authorization: `Bearer ${api.token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download mislukt");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceId}-origineel.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(t("ui", "invoice.original_pdf_downloaded"), "success");
    } catch (error) {
      console.error("Error downloading original PDF:", error);
      showToast(
        `${t("ui", "invoice.download_original_pdf_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async showEmailModal(invoiceId) {
    try {
      // Fetch invoice data to get invoice number
      const invoice = await api.getInvoice(invoiceId);

      const modalHtml = `
        <div class="modal fade" id="emailInvoiceModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Factuur ${invoice.invoice_number} Versturen</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Ontvanger Email *</label>
                  <input type="email" class="form-control" id="email-recipient" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Onderwerp</label>
                  <input type="text" class="form-control" id="email-subject" value="Factuur ${invoice.invoice_number}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Bericht</label>
                  <textarea class="form-control" id="email-message" rows="5">Beste,

In de bijlage vindt u factuur ${invoice.invoice_number}.

Met vriendelijke groet</textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
                <button type="button" class="btn btn-primary" onclick="invoiceManager.sendEmail(${invoiceId})">
                  <i class="bi bi-send"></i> Versturen
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Remove existing modal if any
      const existingModal = document.getElementById("emailInvoiceModal");
      if (existingModal) existingModal.remove();

      document.body.insertAdjacentHTML("beforeend", modalHtml);
      const modal = new bootstrap.Modal(
        document.getElementById("emailInvoiceModal")
      );
      modal.show();
    } catch (error) {
      console.error("Error showing email modal:", error);
      showToast(t("ui", "invoice.invoice_data_load_failed"), "error");
    }
  },

  async sendEmail(invoiceId) {
    const recipient = document.getElementById("email-recipient").value.trim();
    const subject = document.getElementById("email-subject").value.trim();
    const message = document.getElementById("email-message").value.trim();

    if (!recipient) {
      showToast(t("ui", "invoice.email_required"), "error");
      return;
    }

    try {
      await api.sendInvoiceEmail(invoiceId, {
        recipient_email: recipient,
        subject: subject,
        message: message,
      });

      showToast(t("ui", "invoice.email_sent"), "success");

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("emailInvoiceModal")
      );
      modal.hide();

      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error sending email:", error);
      showToast(
        `${t("ui", "invoice.email_send_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async deleteInvoice(invoiceId) {
    if (!confirm(t("ui", "confirm_delete_invoice"))) {
      return;
    }

    try {
      await api.deleteInvoice(invoiceId);
      showToast(t("ui", "invoice.deleted"), "success");
      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      showToast(
        `${t("ui", "invoice.invoice_delete_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll(".invoice-checkbox");
    checkboxes.forEach((cb) => (cb.checked = checked));
    this.updateBulkActions();
  },

  updateBulkActions() {
    const checkboxes = document.querySelectorAll(".invoice-checkbox:checked");
    const count = checkboxes.length;
    const bulkBar = document.getElementById("bulk-actions-bar");
    const countSpan = document.getElementById("selected-count");

    if (count > 0) {
      bulkBar.classList.remove("d-none");
      countSpan.textContent = count;
    } else {
      bulkBar.classList.add("d-none");
    }

    // Update select-all checkbox state
    const allCheckboxes = document.querySelectorAll(".invoice-checkbox");
    const selectAllCheckbox = document.getElementById("select-all-invoices");
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = count === allCheckboxes.length && count > 0;
    }
  },

  clearSelection() {
    const checkboxes = document.querySelectorAll(".invoice-checkbox");
    checkboxes.forEach((cb) => (cb.checked = false));
    document.getElementById("select-all-invoices").checked = false;
    this.updateBulkActions();
  },

  async bulkDelete() {
    const checkboxes = document.querySelectorAll(".invoice-checkbox:checked");
    const ids = Array.from(checkboxes).map((cb) => cb.value);

    if (ids.length === 0) {
      showToast(t("ui", "invoice.none_selected"), "error");
      return;
    }

    const confirmMessage = t("ui", "invoice.confirm_delete_selected").replace(
      "{count}",
      ids.length
    );
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of ids) {
        try {
          await api.deleteInvoice(id);
          successCount++;
        } catch (err) {
          console.error(`Error deleting invoice ${id}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showToast(t("ui", "invoice.selected_deleted"), "success");
      } else {
        showToast(
          `${successCount} ${t(
            "ui",
            "invoice.deleted_short"
          )}, ${errorCount} ${t("ui", "invoice.failed_short")}`,
          "warning"
        );
      }

      this.clearSelection();
      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error bulk deleting:", error);
      showToast(
        `${t("ui", "invoice.delete_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async deleteOldInvoices() {
    const dateInput = document.getElementById("invoice-date-before");
    const beforeDate = dateInput.value;

    if (!beforeDate) {
      showToast("Selecteer eerst een datum", "error");
      return;
    }

    const oldInvoices = this.invoices.filter(
      (inv) => inv.invoice_date < beforeDate
    );

    if (oldInvoices.length === 0) {
      showToast(
        t("ui", "invoice.none_found_before_date").replace("{date}", beforeDate),
        "info"
      );
      return;
    }

    const confirmMessage = t("ui", "invoice.confirm_delete_before_date")
      .replace("{count}", oldInvoices.length)
      .replace("{date}", beforeDate);
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const invoice of oldInvoices) {
        try {
          await api.deleteInvoice(invoice.id);
          successCount++;
        } catch (err) {
          console.error(`Error deleting invoice ${invoice.id}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showToast(
          t("ui", "invoice.deleted_before_date")
            .replace("{count}", successCount)
            .replace("{date}", beforeDate),
          "success"
        );
      } else {
        showToast(
          `${successCount} ${t(
            "ui",
            "invoice.deleted_short"
          )}, ${errorCount} ${t("ui", "invoice.failed_short")}`,
          "warning"
        );
      }

      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error deleting old invoices:", error);
      showToast(
        `${t("ui", "invoice.delete_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async clearAllInvoices() {
    if (
      !confirm(
        t("ui", "invoice.clear_all_warning").replace(
          "{count}",
          this.invoices.length
        )
      )
    ) {
      return;
    }

    if (!confirm(t("ui", "invoice.clear_all_final_confirm"))) {
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const invoice of this.invoices) {
        try {
          await api.deleteInvoice(invoice.id);
          successCount++;
        } catch (err) {
          console.error(`Error deleting invoice ${invoice.id}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showToast(
          t("ui", "invoice.all_deleted").replace("{count}", successCount),
          "success"
        );
      } else {
        showToast(
          `${successCount} ${t(
            "ui",
            "invoice.deleted_short"
          )}, ${errorCount} ${t("ui", "invoice.failed_short")}`,
          "warning"
        );
      }

      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error clearing all invoices:", error);
      showToast(
        `${t("ui", "invoice.delete_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  // IMPORT SETTINGS
  // ============================================

  async showImportSettings() {
    const content = document.getElementById("content");

    try {
      const importTemplates = await api.getImportTemplates();

      content.innerHTML = `
        <div class="container-fluid mt-4">
          <div class="row mb-4">
            <div class="col">
              <h2><i class="bi bi-gear"></i> Import Instellingen</h2>
              <p class="text-muted">Beheer verschillende PDF import templates voor verschillende factuur formaten</p>
            </div>
            <div class="col-auto">
              <button class="btn btn-primary" onclick="invoiceManager.showCreateImportTemplate()">
                <i class="bi bi-plus-circle"></i> Nieuw Import Template
              </button>
              <button class="btn btn-outline-secondary" onclick="invoiceManager.renderInvoiceList()">
                <i class="bi bi-arrow-left"></i> Terug
              </button>
            </div>
          </div>

          <div class="row">
            <div class="col-12">
              <div class="card">
                <div class="card-header">
                  <h5>Beschikbare Import Templates</h5>
                </div>
                <div class="card-body">
                  ${
                    importTemplates.length === 0
                      ? `
                    <p class="text-muted text-center py-4">Geen import templates gevonden. Maak er een aan om PDF's te kunnen importeren.</p>
                  `
                      : `
                    <div class="list-group">
                      ${importTemplates
                        .map(
                          (t) => `
                        <div class="list-group-item">
                          <div class="d-flex justify-content-between align-items-start">
                            <div>
                              <h6 class="mb-1">${t.name}</h6>
                              <p class="mb-1 text-muted small">${
                                t.description || "Geen beschrijving"
                              }</p>
                              <small class="text-secondary">Parser: <code>${
                                t.parser_type
                              }</code></small>
                            </div>
                            <div>
                              <button class="btn btn-sm btn-outline-danger" onclick="invoiceManager.deleteImportTemplate(${
                                t.id
                              })">
                                <i class="bi bi-trash"></i> Verwijderen
                              </button>
                            </div>
                          </div>
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                  `
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="row mt-4">
            <div class="col-12">
              <div class="card bg-light">
                <div class="card-header">
                  <h5>Beschikbare Parser Types</h5>
                </div>
                <div class="card-body">
                  <div class="row">
                    <div class="col-md-6">
                      <h6>mainfreight</h6>
                      <p class="small text-muted">Mainfreight factuurformaat met KM en uren kolommen</p>
                    </div>
                    <div class="col-md-6">
                      <h6>generic</h6>
                      <p class="small text-muted">Generiek formaat met regex patterns voor extractie</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error loading import settings:", error);
      showToast("Fout bij laden import instellingen", "error");
    }
  },

  showCreateImportTemplate() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="container-fluid mt-4">
        <div class="row mb-4">
          <div class="col">
            <h2><i class="bi bi-plus-circle"></i> ${t(
              "ui",
              "invoice.import_template_new"
            )}</h2>
          </div>
          <div class="col-auto">
            <button class="btn btn-outline-secondary" onclick="invoiceManager.showImportSettings()">
              <i class="bi bi-arrow-left"></i> ${t("ui", "back")}
            </button>
          </div>
        </div>

        <div class="row">
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5>${t("ui", "invoice.template_details")}</h5>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">${t(
                    "ui",
                    "invoice.template_name"
                  )} *</label>
                  <input type="text" class="form-control" id="import-template-name" placeholder="${t(
                    "ui",
                    "invoice.template_name_placeholder"
                  )}">
                </div>
                <div class="mb-3">
                  <label class="form-label">${t(
                    "ui",
                    "invoice.description"
                  )}</label>
                  <textarea class="form-control" id="import-template-desc" rows="2" placeholder="${t(
                    "ui",
                    "invoice.description_placeholder"
                  )}"></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">${t(
                    "ui",
                    "invoice.parser_type"
                  )} *</label>
                  <select class="form-select" id="import-template-parser">
                    <option value="">-- ${t(
                      "ui",
                      "invoice.select_parser_type"
                    )} --</option>
                    <option value="mainfreight">Mainfreight</option>
                    <option value="generic">Generic (Regex)</option>
                  </select>
                </div>
                <button class="btn btn-primary" onclick="invoiceManager.saveImportTemplate()">
                  <i class="bi bi-save"></i> ${t("ui", "save")}
                </button>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card bg-light">
              <div class="card-header">
                <h5>${t("ui", "info")}</h5>
              </div>
              <div class="card-body">
                <p><strong>Parser Types:</strong></p>
                <ul class="small">
                  <li><strong>Mainfreight:</strong> Specifiek formaat voor Mainfreight facturen met KM/uren</li>
                  <li><strong>Generic:</strong> Flexibel formaat met regex patterns</li>
                </ul>
                <p class="mt-3 small text-muted">Na het opslaan kan je het template configureren met specifieke extractie regels.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async saveImportTemplate() {
    const name = document.getElementById("import-template-name").value.trim();
    const description = document
      .getElementById("import-template-desc")
      .value.trim();
    const parser_type = document.getElementById("import-template-parser").value;

    if (!name || !parser_type) {
      showToast(t("ui", "invoice.import_template_required"), "error");
      return;
    }

    try {
      await api.createImportTemplate({
        name,
        description,
        parser_type,
        config: {},
      });

      showToast(t("ui", "invoice.import_template_created"), "success");
      await this.showImportSettings();
    } catch (error) {
      console.error("Error saving import template:", error);
      showToast(
        `${t("ui", "invoice.import_template_save_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async deleteImportTemplate(templateId) {
    if (!confirm(t("ui", "invoice.import_template_delete_confirm"))) {
      return;
    }

    try {
      // TODO: implement delete endpoint
      showToast(t("ui", "invoice.feature_not_available"), "info");
    } catch (error) {
      console.error("Error deleting import template:", error);
      showToast(
        `${t("ui", "invoice.import_template_delete_failed")}: ${error.message}`,
        "error"
      );
    }
  },
};

// Make accessible globally
window.invoiceManager = invoiceManager;
