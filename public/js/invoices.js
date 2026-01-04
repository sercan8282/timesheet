// Invoice Management Module
const invoiceManager = {
  currentView: "list", // 'list', 'templates', 'create-template', 'create-invoice'
  currentTemplate: null,
  currentInvoice: null,
  editingInvoiceId: null,
  editingInvoiceStatus: null,
  templates: [],
  invoices: [],
  filteredInvoices: [],
  pageSize: 50,
  currentPage: 1,
  filterSearch: "",
  filterStatus: "",
  filterDateBefore: "",

  async init() {
    await this.loadData();
    this.renderInvoiceList();
  },

  async loadData() {
    try {
      this.templates = await api.getInvoiceTemplates();
      this.invoices = await api.getInvoices();
      this.filteredInvoices = [...this.invoices];
      this.currentPage = 1;
    } catch (error) {
      console.error("Error loading invoice data:", error);
      showToast(t("ui", "invoice.load_error"), "error");
    }
  },

  renderInvoiceList() {
    const { pageInvoices, totalPages, totalFiltered } = this.getPaginatedInvoices();
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="container-fluid mt-4">
        <div class="row mb-4 align-items-center">
          <div class="col-12 col-md-auto">
            <h2><i class="bi bi-receipt"></i> <span data-i18n="ui:invoices.title">Facturen</span></h2>
          </div>
          <div class="col-12">
            <div class="row g-2">
              <div class="col-6 col-md-auto">
                <button class="btn btn-primary w-100 w-md-auto" onclick="invoiceManager.showCreateInvoice()">
                  <i class="bi bi-plus-circle"></i> <span data-i18n="ui:invoices.new_invoice">Nieuwe Factuur</span>
                </button>
              </div>
              <div class="col-6 col-md-auto">
                <button class="btn btn-outline-secondary w-100 w-md-auto" onclick="invoiceManager.showTemplates()">
                  <i class="bi bi-layout-text-sidebar"></i> <span data-i18n="ui:invoices.templates">Templates</span>
                </button>
              </div>
              <div class="col-6 col-md-auto">
                <button class="btn btn-outline-primary w-100 w-md-auto" onclick="invoiceManager.showImportPdf()">
                  <i class="bi bi-file-earmark-arrow-up"></i> <span data-i18n="ui:invoices.import_pdf">Importeer PDF</span>
                </button>
              </div>
              <div class="col-6 col-md-auto">
                <button class="btn btn-outline-info w-100 w-md-auto" onclick="invoiceManager.showImportSettings()">
                  <i class="bi bi-gear"></i> Import Instellingen
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Bulk Actions Bar -->
        <div id="bulk-actions-bar" class="alert alert-info d-none mb-3">
          <div class="d-flex justify-content-between align-items-center">
            <span><strong><span id="selected-count">0</span></strong> <span data-i18n="ui:invoices_selected">facturen geselecteerd</span></span>
            <div>
              <button class="btn btn-sm btn-primary me-2" onclick="invoiceManager.showBulkEmailModal()">
                <i class="bi bi-send"></i> E-mail geselecteerde
              </button>
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
                       value="${this.filterSearch}"
                       onkeyup="invoiceManager.filterInvoices()">
              </div>
              <div class="col-md-2">
                <select class="form-select" id="invoice-status-filter" onchange="invoiceManager.filterInvoices()">
                  <option value="" ${this.filterStatus === "" ? "selected" : ""} data-i18n="ui:invoices.all_statuses">Alle statussen</option>
                  <option value="draft" ${this.filterStatus === "draft" ? "selected" : ""} data-i18n="ui:invoices.status_draft">Concept</option>
                  <option value="sent" ${this.filterStatus === "sent" ? "selected" : ""} data-i18n="ui:invoices.status_sent">Verzonden</option>
                  <option value="paid" ${this.filterStatus === "paid" ? "selected" : ""} data-i18n="ui:invoices.status_paid">Betaald</option>
                  <option value="cancelled" ${this.filterStatus === "cancelled" ? "selected" : ""} data-i18n="ui:invoices.status_cancelled">Geannuleerd</option>
                </select>
              </div>
              <div class="col-md-3">
                <input type="date" class="form-control" id="invoice-date-before" placeholder="Voor datum" value="${this.filterDateBefore}" onchange="invoiceManager.filterInvoices()">
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
        <div class="card d-none d-lg-block">
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
                    <th>Type</th>
                    <th><span data-i18n="ui:invoices.date">Datum</span></th>
                    <th><span data-i18n="ui:invoices.total">Bedrag</span></th>
                    <th><span data-i18n="ui:invoices.status">Status</span></th>
                    <th><span data-i18n="ui:actions">Acties</span></th>
                  </tr>
                </thead>
                <tbody id="invoice-table-body">
                  ${this.renderInvoiceRows(pageInvoices)}
                </tbody>
              </table>
            </div>
            ${this.renderPagination(totalPages, totalFiltered)}
          </div>
        </div>

        <div class="d-lg-none">
          <div class="accordion" id="invoiceAccordion">
            ${this.renderInvoiceCards(pageInvoices)}
          </div>
          ${this.renderPagination(totalPages, totalFiltered)}
        </div>
      </div>
    `;
  },

  async showImportPdf() {
    try {
      const [templates, importTemplates] = await Promise.all([
        api.getInvoiceTemplates(),
        api.getImportTemplates(),
      ]);

      const templateOptions = (templates || [])
        .map((tpl) => {
          const label = tpl.is_default ? `${tpl.name} (default)` : tpl.name;
          return `<option value="${tpl.id}">${label}</option>`;
        })
        .join("");

      const importTemplateOptions = (importTemplates || []).length
        ? importTemplates
            .map(
              (t) =>
                `<option value="${t.id}">${t.name} (${t.parser_type || ""})</option>`
            )
            .join("")
        : `<option value="">Geen import templates beschikbaar</option>`;

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
                <label class="form-label">AI import template (veld-mapping)</label>
                <select id="importAiTemplateSelect" class="form-select">
                  ${importTemplateOptions}
                </select>
                <div class="form-text">Optioneel: kies een import template met regex-mapping zodat factuurnummer en totaal worden gevonden.</div>
              </div>

              <div class="mb-3">
                <label for="importInvoiceType" class="form-label">Type factuur</label>
                <select id="importInvoiceType" class="form-select">
                  <option value="Verkoop" selected>Verkoop (Inkomsten)</option>
                  <option value="Inkoop">Inkoop (Uitgaven)</option>
                </select>
                <div class="form-text">Verkoop = inkomsten (facturen naar klanten), Inkoop = uitgaven (facturen van leveranciers)</div>
              </div>
              
              <div class="mb-3">
                <label for="importPdfInput" class="form-label">PDF bestanden</label>
                <input type="file" id="importPdfInput" class="form-control" accept="application/pdf" multiple />
                <div class="form-text">Je kunt maximaal 20 bestanden tegelijk uploaden</div>
              </div>

              <div class="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <button class="btn btn-sm btn-outline-primary" id="autoDetectBtn">
                    <i class="bi bi-magic"></i> Auto-detecteer voorbeeld
                  </button>
                </div>
                <div class="small text-muted">Controleert het eerste PDF bestand op factuurnummer en totaal</div>
              </div>

              <div id="autoDetectResult" class="border rounded p-2 bg-light mb-3 small">
                <div class="text-muted">Nog niet geanalyseerd</div>
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

      let lastAutoDetect = null;

      const renderAutoDetectResult = (data) => {
        const target = document.getElementById("autoDetectResult");
        if (!target) return;
        if (!data) {
          target.innerHTML = `<div class="text-muted">Nog niet geanalyseerd</div>`;
          return;
        }

        const labels = {
          invoice_number: "Factuurnummer",
          invoice_date: "Datum",
          customer_name: "Klant",
          subtotal: "Subtotaal",
          vat_amount: "BTW",
          total_amount: "Totaal",
        };

        const badgeFor = (key) => {
          const field = data.fields?.[key];
          const missing = !field || field.missing;
          const confidence = Math.round((field?.confidence || 0) * 100);
          const val = field?.value;
          let cls = "bg-success";
          if (missing) cls = "bg-danger";
          else if ((field?.confidence || 0) < 0.75) cls = "bg-warning text-dark";
          const text = missing ? "Ontbreekt" : val ?? "-";
          return `<span class="badge ${cls} me-1 mb-1">${labels[key]}: ${text} (${confidence}%)</span>`;
        };

        const missingRequired = data.summary?.missing_fields || [];
        const notes = data.summary?.notes || [];

      target.innerHTML = `
        <div class="fw-semibold mb-1">Analyse: ${
          data.file?.filename || "(bestand)"
        }</div>
        <div class="mb-2">${badgeFor("invoice_number")}${badgeFor(
        "total_amount"
      )}${badgeFor("invoice_date")}${badgeFor("customer_name")}${badgeFor(
        "subtotal"
      )}${badgeFor("vat_amount")}</div>
        ${
          missingRequired.length
            ? `<div class="text-danger">Ontbreekt: ${missingRequired.join(
                ", "
              )}</div>`
            : ""
        }
        ${
          notes.length
            ? `<div class="text-warning">${notes.join(" ")}</div>`
            : ""
        }
      `;
    };

    const runAutoDetect = async (silent = false) => {
      const input = document.getElementById("importPdfInput");
      if (!input.files || input.files.length === 0) {
        if (!silent) showToast(t("ui", "select_min_one_pdf"), "error");
        return null;
      }

      const file = input.files[0];
      console.log('[INVOICES] Auto-detect file selected:', {
        name: file?.name,
        size: file?.size,
        type: file?.type,
        exists: !!file
      });

      if (!file) {
        console.error('[INVOICES] File is null/undefined!');
        if (!silent) showToast("Geen bestand geselecteerd", "error");
        return null;
      }

      const formData = new FormData();
      formData.append("pdf", file);
      console.log('[INVOICES] FormData created, checking contents...');
      console.log('[INVOICES] FormData has pdf field:', formData.has("pdf"));

      // pass optional AI import template id
      const aiTemplateId = document.getElementById(
        "importAiTemplateSelect"
      )?.value;
      if (aiTemplateId) {
        formData.append("template_id", aiTemplateId);
        console.log('[INVOICES] Added template_id:', aiTemplateId);
      }

      const btn = document.getElementById("autoDetectBtn");
      if (btn) {
        btn.disabled = true;
        btn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Bezig...';
      }

      try {
        const result = await api.autoDetectImportPdf(formData);
        lastAutoDetect = result;
        renderAutoDetectResult(result);
        if (!silent) {
          showToast("Auto-detect afgerond", "success");
        }
        return result;
      } catch (err) {
        console.error("Auto-detect error:", err);
        if (!silent) showToast(err.message || "Auto-detect mislukt", "error");
        renderAutoDetectResult(null);
        return null;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML =
            '<i class="bi bi-magic"></i> Auto-detecteer voorbeeld';
        }
      }
    };

    document.getElementById("autoDetectBtn").onclick = () =>
      runAutoDetect(false);

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

      // Validate required fields using auto-detect on the first file
      const detectResult = lastAutoDetect || (await runAutoDetect(true));
      if (!detectResult) {
        showToast("Auto-detect mislukt, kan niet importeren", "error");
        return;
      }

      const missingRequired = detectResult.summary?.missing_fields || [];
      if (
        missingRequired.includes("invoice_number") ||
        missingRequired.includes("total_amount")
      ) {
        showToast(
          "Factuurnummer of totaal ontbreekt in PDF, vul deze eerst handmatig in",
          "error"
        );
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
        // pass optional AI import template id for field mappings
        const aiTplSel = document.getElementById("importAiTemplateSelect");
        if (aiTplSel && aiTplSel.value) {
          formData.append("ai_template_id", aiTplSel.value);
        }
        // pass invoice_type (Verkoop or Inkoop)
        const invoiceTypeSel = document.getElementById("importInvoiceType");
        if (invoiceTypeSel && invoiceTypeSel.value) {
          formData.append("invoice_type", invoiceTypeSel.value);
        }

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
    } catch (error) {
      console.error("Error showing import PDF modal:", error);
      showToast("Kon import modal niet openen", "error");
    }
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

  renderInvoiceRows(invoices) {
    if (!invoices || invoices.length === 0) {
      return `<tr><td colspan="8" class="text-center text-muted">${t(
        "ui",
        "invoice.none_found",
        "No invoices found"
      )}</td></tr>`;
    }

    return invoices
      .map((invoice) => {
        const statusBadge = this.getStatusBadge(invoice.status);
        return `
        <tr>
          <td>
            <input type="checkbox" class="invoice-checkbox" value="${
              invoice.id
            }" onchange="invoiceManager.handleInvoiceCheckboxChange(this)">
          </td>
          <td><strong>${invoice.invoice_number}</strong></td>
          <td>${invoice.customer_name || "-"}</td>
          <td>${invoice.invoice_type || 'Verkoop'}</td>
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

  renderInvoiceCards(invoices) {
    if (!invoices || invoices.length === 0) {
      return `<div class="alert alert-light text-center text-muted mb-0">${t(
        "ui",
        "invoice.none_found",
        "No invoices found"
      )}</div>`;
    }

    return invoices
      .map((invoice) => {
        const statusBadge = this.getStatusBadge(invoice.status);
        const collapseId = `invoice-collapse-${invoice.id}`;
        const headingId = `invoice-heading-${invoice.id}`;
        const total = parseFloat(invoice.total_amount || 0).toFixed(2);
        const customer = invoice.customer_name || "-";
        const invoiceDate = invoice.invoice_date || "-";

        return `
        <div class="accordion-item mb-2 shadow-sm invoice-accordion-item">
          <h2 class="accordion-header" id="${headingId}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
              <div class="w-100">
                <div class="d-flex justify-content-between align-items-center">
                  <span class="fw-semibold">${invoice.invoice_number}</span>
                  <span>${statusBadge}</span>
                </div>
                <div class="d-flex justify-content-between text-muted small mt-1">
                  <span>${customer}</span>
                  <span>€ ${total}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center text-muted small mt-1">
                  <span>${invoiceDate}</span>
                  <div class="form-check m-0">
                    <input type="checkbox" class="form-check-input invoice-checkbox" value="${
                      invoice.id
                    }" onchange="invoiceManager.handleInvoiceCheckboxChange(this)">
                  </div>
                </div>
              </div>
            </button>
          </h2>
          <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#invoiceAccordion">
            <div class="accordion-body">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div class="fw-semibold">${customer}</div>
                  <div class="text-muted small">${t(
                    "ui",
                    "invoices.number",
                    "Factuurnummer"
                  )}: ${invoice.invoice_number}</div>
                </div>
                <div class="text-end">
                  <div class="fw-semibold">€ ${total}</div>
                  <div class="text-muted small">${invoiceDate}</div>
                </div>
              </div>
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-outline-primary btn-sm flex-fill" onclick="invoiceManager.viewInvoice(${
                  invoice.id
                })">
                  <i class="bi bi-eye"></i> ${t("ui", "view", "Bekijk")}
                </button>
                <button class="btn btn-outline-secondary btn-sm flex-fill" onclick="invoiceManager.showEditInvoice(${
                  invoice.id
                })">
                  <i class="bi bi-pencil"></i> ${t("ui", "edit", "Bewerk")}
                </button>
                <button class="btn btn-outline-success btn-sm flex-fill" onclick="invoiceManager.downloadPDF(${
                  invoice.id
                })">
                  <i class="bi bi-file-pdf"></i> PDF
                </button>
                <button class="btn btn-outline-info btn-sm flex-fill" onclick="invoiceManager.showEmailModal(${
                  invoice.id
                })">
                  <i class="bi bi-envelope"></i> Email
                </button>
                <button class="btn btn-outline-danger btn-sm flex-fill" onclick="invoiceManager.deleteInvoice(${
                  invoice.id
                })">
                  <i class="bi bi-trash"></i> ${t("ui", "delete", "Verwijder")}
                </button>
              </div>
            </div>
          </div>
        </div>
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

  getFilteredInvoices() {
    const search = (this.filterSearch || "").toLowerCase();
    const status = this.filterStatus || "";
    const dateBefore = this.filterDateBefore;

    return this.invoices.filter((inv) => {
      const text = `${inv.invoice_number || ""} ${(inv.customer_name || "").toLowerCase()}`.toLowerCase();
      const matchesSearch = !search || text.includes(search);
      const matchesStatus = !status || (inv.status || "").toLowerCase() === status.toLowerCase();
      const matchesDate = !dateBefore || (inv.invoice_date && new Date(inv.invoice_date) <= new Date(dateBefore));
      return matchesSearch && matchesStatus && matchesDate;
    });
  },

  getPaginatedInvoices() {
    const filtered = this.getFilteredInvoices();
    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / this.pageSize));
    this.currentPage = Math.min(this.currentPage, totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    const pageInvoices = filtered.slice(start, start + this.pageSize);
    return { pageInvoices, totalPages, totalFiltered };
  },

  renderPagination(totalPages, totalFiltered) {
    if (!totalFiltered) return "";

    const prevDisabled = this.currentPage <= 1 ? "disabled" : "";
    const nextDisabled = this.currentPage >= totalPages ? "disabled" : "";

    // windowed page buttons (max 5)
    const pages = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let p = start; p <= end; p++) {
      pages.push(
        `<button class="btn btn-sm ${
          p === this.currentPage ? "btn-primary" : "btn-outline-primary"
        }" onclick="invoiceManager.goToPage(${p})">${p}</button>`
      );
    }

    return `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
        <div class="text-muted small">Pagina ${this.currentPage} / ${totalPages} • ${totalFiltered} facturen</div>
        <div class="btn-group" role="group" aria-label="Paginatie">
          <button class="btn btn-sm btn-outline-primary" ${prevDisabled} onclick="invoiceManager.goToPage(${this.currentPage - 1})">Vorige</button>
          ${pages.join("")}
          <button class="btn btn-sm btn-outline-primary" ${nextDisabled} onclick="invoiceManager.goToPage(${this.currentPage + 1})">Volgende</button>
        </div>
      </div>`;
  },

  goToPage(page) {
    if (!page || page < 1) return;
    const filtered = this.getFilteredInvoices();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    this.currentPage = Math.max(1, Math.min(page, totalPages));
    this.renderInvoiceList();
  },

  filterInvoices() {
    this.filterSearch = document.getElementById("invoice-search").value;
    this.filterStatus = document.getElementById("invoice-status-filter").value;
    this.filterDateBefore = document.getElementById("invoice-date-before").value;
    this.currentPage = 1;
    this.renderInvoiceList();
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
            <button class="btn btn-outline-success" onclick="invoiceManager.showImportTemplateModal()">
              <i class="bi bi-upload"></i> Template importeren
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
            <button class="btn btn-sm btn-outline-success" onclick="invoiceManager.exportTemplate(${
              template.id
            })">
              <i class="bi bi-download"></i> Exporteren
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
                <div class="mb-3">
                  <label class="form-label">Standaard lettertype</label>
                  <select class="form-select" id="template-font-family">
                    <option value="Helvetica" selected>Helvetica</option>
                    <option value="Times-Roman">Times New Roman</option>
                    <option value="Courier">Courier</option>
                  </select>
                </div>
                <div class="row g-3 mb-3">
                  <div class="col-md-4">
                    <label class="form-label">Header achtergrond</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="template-table-header-bg" value="#0080ff" style="max-width: 60px;">
                      <input type="text" class="form-control" id="template-table-header-bg-text" value="#0080ff" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#0080ff">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Header tekst</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="template-table-header-text" value="#ffffff" style="max-width: 60px;">
                      <input type="text" class="form-control" id="template-table-header-text-text" value="#ffffff" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#ffffff">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Rij 1 achtergrond</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="template-table-row-bg1" value="#f4f8ff" style="max-width: 60px;">
                      <input type="text" class="form-control" id="template-table-row-bg1-text" value="#f4f8ff" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#f4f8ff">
                    </div>
                  </div>
                </div>
                <div class="row g-3 mb-3">
                  <div class="col-md-4">
                    <label class="form-label">Rij 2 achtergrond</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="template-table-row-bg2" value="#e7f2ff" style="max-width: 60px;">
                      <input type="text" class="form-control" id="template-table-row-bg2-text" value="#e7f2ff" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#e7f2ff">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Randkleur</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="template-table-border-color" value="#c7ddff" style="max-width: 60px;">
                      <input type="text" class="form-control" id="template-table-border-color-text" value="#c7ddff" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#c7ddff">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Tekstkleur</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="template-table-text-color" value="#000000" style="max-width: 60px;">
                      <input type="text" class="form-control" id="template-table-text-color-text" value="#000000" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#000000">
                    </div>
                  </div>
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
    
    // Sync color picker and text input
    setTimeout(() => {
      const colorFields = [
        'template-table-header-bg',
        'template-table-header-text',
        'template-table-row-bg1',
        'template-table-row-bg2',
        'template-table-border-color',
        'template-table-text-color'
      ];
      
      colorFields.forEach(fieldId => {
        const colorInput = document.getElementById(fieldId);
        const textInput = document.getElementById(fieldId + '-text');
        
        if (colorInput && textInput) {
          // Sync color picker -> text input
          colorInput.addEventListener('input', (e) => {
            textInput.value = e.target.value;
          });
          
          // Sync text input -> color picker
          textInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
              colorInput.value = value;
            }
          });
        }
      });
    }, 100);
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
    const default_font_family =
      document.getElementById("template-font-family").value || "Helvetica";
    const table_header_bg =
      document.getElementById("template-table-header-bg-text").value || "#0080ff";
    const table_header_text =
      document.getElementById("template-table-header-text-text").value || "#ffffff";
    const table_row_bg1 =
      document.getElementById("template-table-row-bg1-text").value || "#f4f8ff";
    const table_row_bg2 =
      document.getElementById("template-table-row-bg2-text").value || "#e7f2ff";
    const table_border_color =
      document.getElementById("template-table-border-color-text").value || "#c7ddff";
    const table_text_color =
      document.getElementById("template-table-text-color-text").value || "#000000";

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
        default_font_family,
        table_header_bg,
        table_header_text,
        table_row_bg1,
        table_row_bg2,
        table_border_color,
        table_text_color,
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
      // Load available fonts for selectors
      try {
        this.fonts = await api.getInvoiceFonts();
      } catch (e) {
        this.fonts = [];
      }
      this.renderTemplateEditor();
      
      // Sync color pickers with text inputs for edit template
      setTimeout(() => {
        const colorFields = [
          'edit-template-table-header-bg',
          'edit-template-table-header-text',
          'edit-template-table-row-bg1',
          'edit-template-table-row-bg2',
          'edit-template-table-border-color',
          'edit-template-table-text-color'
        ];
        
        colorFields.forEach(fieldId => {
          const colorInput = document.getElementById(fieldId);
          const textInput = document.getElementById(fieldId + '-text');
          
          if (colorInput && textInput) {
            // Sync color picker -> text input
            colorInput.addEventListener('input', (e) => {
              textInput.value = e.target.value;
            });
            
            // Sync text input -> color picker
            textInput.addEventListener('input', (e) => {
              const value = e.target.value.trim();
              if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                colorInput.value = value;
              }
            });
          }
        });
      }, 100);
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
                <div class="mb-3">
                  <label class="form-label">Standaard lettertype</label>
                  <select class="form-select" id="edit-template-font-family">
                    <option value="Helvetica" ${
                      (template.default_font_family || "Helvetica") === "Helvetica" ? "selected" : ""
                    }>Helvetica</option>
                    <option value="Times-Roman" ${
                      template.default_font_family === "Times-Roman" ? "selected" : ""
                    }>Times New Roman</option>
                    <option value="Courier" ${
                      template.default_font_family === "Courier" ? "selected" : ""
                    }>Courier</option>
                  </select>
                </div>
                <div class="row g-3 mb-3">
                  <div class="col-md-4">
                    <label class="form-label">Header achtergrond</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="edit-template-table-header-bg" value="${
                        template.table_header_bg || "#0080ff"
                      }" style="max-width: 60px;">
                      <input type="text" class="form-control" id="edit-template-table-header-bg-text" value="${
                        template.table_header_bg || "#0080ff"
                      }" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#0080ff">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Header tekst</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="edit-template-table-header-text" value="${
                        template.table_header_text || "#ffffff"
                      }" style="max-width: 60px;">
                      <input type="text" class="form-control" id="edit-template-table-header-text-text" value="${
                        template.table_header_text || "#ffffff"
                      }" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#ffffff">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Rij 1 achtergrond</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="edit-template-table-row-bg1" value="${
                        template.table_row_bg1 || "#f4f8ff"
                      }" style="max-width: 60px;">
                      <input type="text" class="form-control" id="edit-template-table-row-bg1-text" value="${
                        template.table_row_bg1 || "#f4f8ff"
                      }" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#f4f8ff">
                    </div>
                  </div>
                </div>
                <div class="row g-3 mb-3">
                  <div class="col-md-4">
                    <label class="form-label">Rij 2 achtergrond</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="edit-template-table-row-bg2" value="${
                        template.table_row_bg2 || "#e7f2ff"
                      }" style="max-width: 60px;">
                      <input type="text" class="form-control" id="edit-template-table-row-bg2-text" value="${
                        template.table_row_bg2 || "#e7f2ff"
                      }" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#e7f2ff">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Randkleur</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="edit-template-table-border-color" value="${
                        template.table_border_color || "#c7ddff"
                      }" style="max-width: 60px;">
                      <input type="text" class="form-control" id="edit-template-table-border-color-text" value="${
                        template.table_border_color || "#c7ddff"
                      }" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#c7ddff">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Tekstkleur</label>
                    <div class="input-group">
                      <input type="color" class="form-control form-control-color" id="edit-template-table-text-color" value="${
                        template.table_text_color || "#000000"
                      }" style="max-width: 60px;">
                      <input type="text" class="form-control" id="edit-template-table-text-color-text" value="${
                        template.table_text_color || "#000000"
                      }" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#000000">
                    </div>
                  </div>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-secondary" onclick="invoiceManager.openFontManager()">
                    <i class="bi bi-fonts"></i> Lettertypes beheren
                  </button>
                  <button class="btn btn-primary" onclick="invoiceManager.updateTemplateSettings()">
                  <i class="bi bi-save"></i> Instellingen Opslaan
                  </button>
                </div>
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

                <!-- Footer sectie (1 sectie met keuze tussen 3 kolommen of full width) -->
                <div style="margin-top: 20px; padding: 10px; background: #f8e8e8; border: 2px dashed #cc3300; border-radius: 4px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                    <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                      <strong style="color: #666;">🔻 Footer Links</strong>
                      <div style="margin-top: 5px; font-size: 10px;" id="preview-footer-left"></div>
                    </div>
                    <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                      <strong style="color: #666;">🔻 Footer Midden</strong>
                      <div style="margin-top: 5px; font-size: 10px;" id="preview-footer-center"></div>
                    </div>
                    <div style="padding: 10px; background: #fff; border: 1px solid #bbb; min-height: 60px; border-radius: 3px; font-size: 11px;">
                      <strong style="color: #666;">🔻 Footer Rechts</strong>
                      <div style="margin-top: 5px; font-size: 10px;" id="preview-footer-right"></div>
                    </div>
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
                    <optgroup label="Footer Sectie">
                      <option value="footer_left">Footer Links</option>
                      <option value="footer_center">Footer Midden</option>
                      <option value="footer_right">Footer Rechts</option>
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

    // Populate font selects with built-ins + uploaded
    this.populateFontSelect(document.getElementById("edit-template-font-family"), this.currentTemplate.default_font_family || "Helvetica", false);
    const elFontSelect = document.getElementById("element-font-family");
    if (elFontSelect) this.populateFontSelect(elFontSelect, "inherit", true);
  },

  openFontManager() {
    const modalHtml = `
      <div class="modal fade" id="fontManagerModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Lettertypes beheren</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Lettertype naam (family)</label>
                <input type="text" class="form-control" id="font-family-input" placeholder="Bijv. Open Sans">
              </div>
              <div class="mb-3">
                <label class="form-label">Gewicht</label>
                <select class="form-select" id="font-weight-input">
                  <option value="normal" selected>Normaal</option>
                  <option value="bold">Vet</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Bestand (TTF/OTF)</label>
                <input type="file" class="form-control" id="font-file-input" accept=".ttf,.otf">
              </div>
              <div class="border rounded p-2" style="max-height:180px; overflow:auto;">
                <div class="small text-muted mb-2">Bestaande lettertypes</div>
                ${((this.fonts||[])  
                  .map(f => `<div class='d-flex justify-content-between align-items-center small'><span>${f.family} (${f.weight})</span><span class='text-muted'>${f.file_path.split('/').pop()}</span></div>`)
                  .join('')) || '<div class="text-muted small">Geen geüploade lettertypes</div>'}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Sluiten</button>
              <button class="btn btn-primary" onclick="invoiceManager.uploadFont()"><i class="bi bi-upload"></i> Uploaden</button>
            </div>
          </div>
        </div>
      </div>`;

    let container = document.getElementById("modal-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "modal-container";
      document.body.appendChild(container);
    }
    container.innerHTML = modalHtml;
    const modal = new bootstrap.Modal(document.getElementById("fontManagerModal"));
    modal.show();
  },

  async uploadFont() {
    try {
      const family = document.getElementById("font-family-input").value.trim();
      const weight = document.getElementById("font-weight-input").value;
      const file = document.getElementById("font-file-input").files[0];
      if (!family || !file) {
        showToast("Family en bestand zijn verplicht", "error");
        return;
      }
      const fd = new FormData();
      fd.append("family", family);
      fd.append("weight", weight);
      fd.append("font", file);
      await api.uploadInvoiceFont(fd);
      showToast("Lettertype geüpload", "success");
      this.fonts = await api.getInvoiceFonts();
      // Refresh selects and modal list
      this.populateFontSelect(document.getElementById("edit-template-font-family"), this.currentTemplate.default_font_family || "Helvetica", false);
      const elFontSelect = document.getElementById("element-font-family");
      if (elFontSelect) this.populateFontSelect(elFontSelect, "inherit", true);
      this.openFontManager();
    } catch (e) {
      console.error(e);
      showToast("Upload mislukt", "error");
    }
  },

  populateFontSelect(selectEl, value, includeInherit) {
    if (!selectEl) return;
    const builtins = [
      { val: "Helvetica", label: "Helvetica" },
      { val: "Times-Roman", label: "Times New Roman" },
      { val: "Courier", label: "Courier" },
    ];
    const customs = (this.fonts || [])
      .map((f) => f.family)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
      .map((family) => ({ val: family, label: family }));

    const options = [];
    if (includeInherit) options.push({ val: "inherit", label: "Overnemen van template" });
    builtins.forEach((o) => options.push(o));
    customs.forEach((o) => options.push(o));

    selectEl.innerHTML = options
      .map((o) => `<option value="${o.val}" ${o.val === value ? "selected" : ""}>${o.label}</option>`) 
      .join("");
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
      footer_left: "#preview-footer-left",
      footer_center: "#preview-footer-center",
      footer_right: "#preview-footer-right",
    };

    // Populate preview areas
    elements.forEach((el) => {
      const selector = positions[el.element_type];
      if (selector) {
        const previewEl = document.querySelector(selector);
        if (previewEl) {
          const label = el.label || el.element_type;
          if (el.image_path) {
            previewEl.innerHTML += `
              <div style="margin: 5px 0; padding: 4px; background: #f0f0f0; border-radius: 2px;">
                <div style="font-weight: 500">${label}</div>
                <img src="${el.image_path}" alt="image" style="max-width: 120px; max-height: 80px; display: block; margin-top: 4px;" />
              </div>
            `;
          } else {
            const content = el.content
              ? el.content.substring(0, 40) + (el.content.length > 40 ? "..." : "")
              : "";
            previewEl.innerHTML += `<div style="margin: 5px 0; padding: 4px; background: #f0f0f0; border-radius: 2px; font-weight: 500;">${label}${
              content ? ": " + content : ""
            }</div>`;
          }
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
      <div class="mb-3">
        <label class="form-label">Horizontale uitlijning</label>
        <div class="btn-group d-flex w-100" role="group">
          <input type="radio" class="btn-check" name="text-align-h" id="align-h-left" value="left" checked>
          <label class="btn btn-outline-secondary flex-grow-1" for="align-h-left"><i class="bi bi-text-left"></i> Links</label>
          <input type="radio" class="btn-check" name="text-align-h" id="align-h-center" value="center">
          <label class="btn btn-outline-secondary flex-grow-1" for="align-h-center"><i class="bi bi-text-center"></i> Midden</label>
          <input type="radio" class="btn-check" name="text-align-h" id="align-h-right" value="right">
          <label class="btn btn-outline-secondary flex-grow-1" for="align-h-right"><i class="bi bi-text-right"></i> Rechts</label>
        </div>
      </div>
    `;

    if (
      type === "text" ||
      type === "sender" ||
      type === "title" ||
      type.startsWith("top_") ||
      type.startsWith("address_") ||
      type.startsWith("footer_")
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
      } else if (type === "footer_left") {
        labelText = "Inhoud Footer Links *";
        placeholder = "Bijv: Copyright of contact";
        helpText =
          '<small class="text-muted">Linkerkolom onderaan PDF</small>';
      } else if (type === "footer_center") {
        labelText = "Inhoud Footer Midden *";
        placeholder = "Bijv: Paginanummer of note";
        helpText =
          '<small class="text-muted">Middenkolom onderaan PDF</small>';
      } else if (type === "footer_right") {
        labelText = "Inhoud Footer Rechts *";
        placeholder = "Bijv: Website of bedrijfsgegevens";
        helpText =
          '<small class="text-muted">Rechterkolom onderaan PDF</small>';
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
          <div class="input-group">
            <input type="color" class="form-control form-control-color" id="element-font-color" value="#000000" style="max-width: 60px;">
            <input type="text" class="form-control" id="element-font-color-text" value="#000000" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#000000">
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label">Lettertype</label>
          <select class="form-select" id="element-font-family"></select>
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
        <div class="mb-3">
          <label class="form-label">Plaats sectie</label>
          <select class="form-select" id="element-image-section">
            <option value="image" selected>Onder (body)</option>
            <option value="top_left">Boven Links</option>
            <option value="top_center">Boven Midden</option>
            <option value="top_right">Boven Rechts</option>
            <option value="address_left">Adres Links</option>
            <option value="address_center">Adres Midden</option>
            <option value="address_right">Adres Rechts</option>
            <option value="footer_left">Footer Links</option>
            <option value="footer_center">Footer Midden</option>
            <option value="footer_right">Footer Rechts</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label">Plaatsing</label>
          <select class="form-select" id="element-image-align">
            <option value="left">Links</option>
            <option value="center">Midden</option>
            <option value="right">Rechts</option>
          </select>
        </div>
        <div class="row">
          <div class="col-md-6">
            <div class="mb-3">
              <label class="form-label">Breedte (px)</label>
              <input type="number" class="form-control" id="element-image-width" value="150" min="50" max="800">
            </div>
          </div>
          <div class="col-md-6">
            <div class="mb-3">
              <label class="form-label">Hoogte (px)</label>
              <input type="number" class="form-control" id="element-image-height" value="0" min="0" max="800">
              <small class="text-muted">0 = automatisch</small>
            </div>
          </div>
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
    const default_font_family =
      document.getElementById("edit-template-font-family").value || "Helvetica";
    const table_header_bg =
      document.getElementById("edit-template-table-header-bg-text").value || "#0080ff";
    const table_header_text =
      document.getElementById("edit-template-table-header-text-text").value || "#ffffff";
    const table_row_bg1 =
      document.getElementById("edit-template-table-row-bg1-text").value || "#f4f8ff";
    const table_row_bg2 =
      document.getElementById("edit-template-table-row-bg2-text").value || "#e7f2ff";
    const table_border_color =
      document.getElementById("edit-template-table-border-color-text").value || "#c7ddff";
    const table_text_color =
      document.getElementById("edit-template-table-text-color-text").value || "#000000";

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
        default_font_family,
        table_header_bg,
        table_header_text,
        table_row_bg1,
        table_row_bg2,
        table_border_color,
        table_text_color,
      });

      showToast(
        t("ui", "invoice.template_updated", "Template settings updated"),
        "success"
      );
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
    const originalType = document.getElementById("element-type").value;
    let type = originalType;
    const label = document.getElementById("element-label").value;
    const order = document.getElementById("element-order").value;
    const textAlignH = document.querySelector('input[name="text-align-h"]:checked')?.value || "left";

    // Check of er een bestand wordt geüpload
    const imageFileEl = document.getElementById("element-image");
    const imageFile = imageFileEl?.files?.[0];
    const hasFile = imageFile && imageFile.size > 0;

    let requestBody;

    // Als er een bestand is, gebruik FormData
    if (hasFile) {
      const formData = new FormData();
      
      if (originalType === "image") {
        const section = document.getElementById("element-image-section")?.value || "image";
        type = section;
        formData.append("element_type", String(type));
        formData.append("label", String(label || ""));
        formData.append("position_order", String(order || "0"));
        formData.append("text_align_h", String(textAlignH || "left"));
        formData.append("image", imageFile);
        
        const imageAlign = document.getElementById("element-image-align")?.value || "left";
        const imageWidth = document.getElementById("element-image-width")?.value || "150";
        formData.append("image_align", String(imageAlign));
        formData.append("image_width", String(imageWidth));
        formData.append("image_height", "0");
      } else {
        formData.append("element_type", String(type));
        formData.append("label", String(label || ""));
        formData.append("position_order", String(order || "0"));
        formData.append("text_align_h", String(textAlignH || "left"));
        formData.append("image", imageFile);
        formData.append("image_align", "left");
        formData.append("image_width", "150");
        formData.append("image_height", "0");

        // Als er ook content is (tekst met logo)
        const content = document.getElementById("element-content")?.value;
        if (content) {
          formData.append("content", String(content));
          const fontSize = document.getElementById("element-font-size")?.value || "14";
          const fontColor = document.getElementById("element-font-color-text")?.value || document.getElementById("element-font-color")?.value || "#000000";
          const fontFamily = document.getElementById("element-font-family")?.value || "inherit";
          const fontWeight = document.getElementById("element-font-weight")?.value || "normal";
          formData.append("font_size", String(fontSize));
          formData.append("font_color", String(fontColor));
          formData.append("font_family", String(fontFamily));
          formData.append("font_weight", String(fontWeight));
        }
      }
      requestBody = formData;
    } else {
      // Geen bestand - gebruik JSON
      if (originalType === "image") {
        showToast(t("ui", "invoice.select_image"), "error");
        return;
      }

      const content = document.getElementById("element-content")?.value;
      if (!content) {
        showToast(t("ui", "invoice.text_required"), "error");
        return;
      }

      const fontSize = document.getElementById("element-font-size")?.value || "14";
      const fontColor = document.getElementById("element-font-color-text")?.value || document.getElementById("element-font-color")?.value || "#000000";
      const fontFamily = document.getElementById("element-font-family")?.value || "inherit";
      const fontWeight = document.getElementById("element-font-weight")?.value || "normal";

      requestBody = {
        element_type: type,
        label: label || "",
        position_order: order || 0,
        text_align_h: textAlignH || "left",
        content: content,
        font_size: fontSize,
        font_color: fontColor,
        font_family: fontFamily,
        font_weight: fontWeight
      };
    }

    try {
      await api.addTemplateElement(templateId, requestBody);
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
          el.element_type.startsWith("address_") ||
          el.element_type.startsWith("footer_")
        ) {
          if (el.image_path) {
            preview = `<img src="${el.image_path}" alt="Template image" style="max-width: 200px; max-height: 100px;">`;
          } else {
            preview = `<p style="font-size: ${el.font_size}px; color: ${el.font_color}; font-weight: ${el.font_weight};">${el.content}</p>`;
          }
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
                })" title="Bewerken">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="invoiceManager.deleteElement(${
                  el.id
                })" title="Verwijderen">
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
                <select class="form-select" id="edit-element-type">
                  <optgroup label="Bovenste Sectie (3 kolommen)">
                    <option value="top_left" ${element.element_type === "top_left" ? "selected" : ""}>Boven Links</option>
                    <option value="top_center" ${element.element_type === "top_center" ? "selected" : ""}>Boven Midden</option>
                    <option value="top_right" ${element.element_type === "top_right" ? "selected" : ""}>Boven Rechts</option>
                  </optgroup>
                  <optgroup label="Adres Sectie (3 kolommen)">
                    <option value="address_left" ${element.element_type === "address_left" ? "selected" : ""}>Adres Links</option>
                    <option value="address_center" ${element.element_type === "address_center" ? "selected" : ""}>Adres Midden</option>
                    <option value="address_right" ${element.element_type === "address_right" ? "selected" : ""}>Adres Rechts</option>
                  </optgroup>
                  <optgroup label="Footer Sectie">
                    <option value="footer_left" ${element.element_type === "footer_left" ? "selected" : ""}>Footer Links</option>
                    <option value="footer_center" ${element.element_type === "footer_center" ? "selected" : ""}>Footer Midden</option>
                    <option value="footer_right" ${element.element_type === "footer_right" ? "selected" : ""}>Footer Rechts</option>
                  </optgroup>
                  <optgroup label="Body Sectie">
                    <option value="image" ${element.element_type === "image" ? "selected" : ""}>Afbeelding (body)</option>
                    <option value="text" ${element.element_type === "text" ? "selected" : ""}>Tekst (body)</option>
                    <option value="title" ${element.element_type === "title" ? "selected" : ""}>Titel (body)</option>
                    <option value="sender" ${element.element_type === "sender" ? "selected" : ""}>Afzender (body)</option>
                  </optgroup>
                  <optgroup label="Berekende Velden">
                    <option value="line_item" ${element.element_type === "line_item" ? "selected" : ""}>Regel Item</option>
                    <option value="subtotal" ${element.element_type === "subtotal" ? "selected" : ""}>Subtotaal</option>
                    <option value="vat" ${element.element_type === "vat" ? "selected" : ""}>BTW</option>
                    <option value="total" ${element.element_type === "total" ? "selected" : ""}>Totaal</option>
                  </optgroup>
                </select>
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
              <div class="mb-3">
                <label class="form-label">Horizontale uitlijning</label>
                <div class="btn-group d-flex w-100" role="group">
                  <input type="radio" class="btn-check" name="edit-text-align-h" id="edit-align-h-left" value="left" ${element.text_align_h === "left" || !element.text_align_h ? "checked" : ""}>
                  <label class="btn btn-outline-secondary flex-grow-1" for="edit-align-h-left"><i class="bi bi-text-left"></i> Links</label>
                  <input type="radio" class="btn-check" name="edit-text-align-h" id="edit-align-h-center" value="center" ${element.text_align_h === "center" ? "checked" : ""}>
                  <label class="btn btn-outline-secondary flex-grow-1" for="edit-align-h-center"><i class="bi bi-text-center"></i> Midden</label>
                  <input type="radio" class="btn-check" name="edit-text-align-h" id="edit-align-h-right" value="right" ${element.text_align_h === "right" ? "checked" : ""}>
                  <label class="btn btn-outline-secondary flex-grow-1" for="edit-align-h-right"><i class="bi bi-text-right"></i> Rechts</label>
                </div>
              </div>
              
              ${
                element.element_type === "image" || 
                (element.element_type.startsWith("top_") && element.image_path) ||
                (element.element_type.startsWith("address_") && element.image_path) ||
                (element.element_type.startsWith("footer_") && element.image_path)
                  ? `
                <div class="mb-3">
                  <label class="form-label">Afbeelding</label>
                  ${
                    element.image_path
                      ? `<div><img src="${element.image_path}" style="max-width: 200px; max-height: 150px; display: block; margin-bottom: 10px;"></div>`
                      : ""
                  }
                  <input type="file" class="form-control" id="edit-element-image" accept="image/*">
                  <small class="form-text text-muted">Upload een nieuwe afbeelding om te vervangen (optioneel)</small>
                </div>
                <div class="mb-3">
                  <label class="form-label">Plaatsing</label>
                  <select class="form-select" id="edit-element-image-align">
                    <option value="left" ${element.image_align === "left" ? "selected" : ""}>Links</option>
                    <option value="center" ${element.image_align === "center" ? "selected" : ""}>Midden</option>
                    <option value="right" ${element.image_align === "right" ? "selected" : ""}>Rechts</option>
                  </select>
                </div>
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Breedte (px)</label>
                      <input type="number" class="form-control" id="edit-element-image-width" value="${element.image_width || 150}" min="50" max="800">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Hoogte (px)</label>
                      <input type="number" class="form-control" id="edit-element-image-height" value="${element.image_height || 0}" min="0" max="800">
                      <small class="text-muted">0 = automatisch (behoudt aspect ratio)</small>
                    </div>
                  </div>
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
                      <div class="input-group">
                        <input type="color" class="form-control form-control-color" id="edit-element-font-color" value="${
                          element.font_color || "#000000"
                        }" style="max-width: 60px;">
                        <input type="text" class="form-control" id="edit-element-font-color-text" value="${
                          element.font_color || "#000000"
                        }" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#000000">
                      </div>
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
                <div class="mb-3">
                  <label class="form-label">Lettertype</label>
                  <select class="form-select" id="edit-element-font-family">
                    <option value="inherit" ${!element.font_family || element.font_family === "inherit" ? "selected" : ""}>Overnemen van template</option>
                    <option value="Helvetica" ${element.font_family === "Helvetica" ? "selected" : ""}>Helvetica</option>
                    <option value="Times-Roman" ${element.font_family === "Times-Roman" ? "selected" : ""}>Times New Roman</option>
                    <option value="Courier" ${element.font_family === "Courier" ? "selected" : ""}>Courier</option>
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

    // Populate font select in modal (after injected into DOM)
    this.populateFontSelect(
      document.getElementById("edit-element-font-family"),
      element.font_family || "inherit",
      true
    );

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
    const newElementType = document.getElementById("edit-element-type").value;
    const textAlignH = document.querySelector('input[name="edit-text-align-h"]:checked')?.value || "left";

    // Bepaal of we een bestand uploaden
    const imageFile = document.getElementById("edit-element-image")?.files[0];
    const hasImageUpload = imageFile && imageFile.size > 0;

    let requestBody;
    let isMultipart = false;

    if (hasImageUpload) {
      // Alleen multipart als er écht een bestand is
      isMultipart = true;
      const formData = new FormData();
      formData.append("label", String(label || ""));
      formData.append("position_order", String(order || "0"));
      formData.append("element_type", String(newElementType || ""));
      formData.append("text_align_h", String(textAlignH || "left"));
      formData.append("image", imageFile);
      
      if (element.element_type === "image" || 
          (element.element_type.startsWith("top_") && element.image_path) ||
          (element.element_type.startsWith("address_") && element.image_path)) {
        const imageAlign = document.getElementById("edit-element-image-align")?.value;
        const imageWidth = document.getElementById("edit-element-image-width")?.value;
        const imageHeight = document.getElementById("edit-element-image-height")?.value;
        formData.append("image_align", String(imageAlign || element.image_align || "left"));
        formData.append("image_width", String(imageWidth || element.image_width || "150"));
        formData.append("image_height", String(imageHeight || element.image_height || "0"));
      }
      requestBody = formData;
    } else {
      // Gebruik JSON als er geen bestand is
      isMultipart = false;
      const data = {
        label: label || "",
        position_order: order || 0,
        element_type: newElementType || "",
        text_align_h: textAlignH || "left"
      };

      if (element.element_type === "image" || 
          (element.element_type.startsWith("top_") && element.image_path) ||
          (element.element_type.startsWith("address_") && element.image_path)) {
        const imageAlign = document.getElementById("edit-element-image-align")?.value;
        const imageWidth = document.getElementById("edit-element-image-width")?.value;
        const imageHeight = document.getElementById("edit-element-image-height")?.value;
        data.image_align = imageAlign || element.image_align || "left";
        data.image_width = imageWidth || element.image_width || 150;
        data.image_height = imageHeight || element.image_height || 0;
      } else {
        const content = document.getElementById("edit-element-content")?.value;
        const fontSize = document.getElementById("edit-element-font-size")?.value;
        const fontColor = document.getElementById("edit-element-font-color-text")?.value || document.getElementById("edit-element-font-color")?.value;
        const fontWeight = document.getElementById("edit-element-font-weight")?.value;
        const fontFamily = document.getElementById("edit-element-font-family")?.value;

        if (content !== undefined && content !== null) {
          if (!content.trim()) {
            showToast("Tekst inhoud is verplicht", "error");
            return;
          }
          data.content = content;
          data.font_size = fontSize || 14;
          data.font_color = fontColor || "#000000";
          data.font_weight = fontWeight || "normal";
          if (fontFamily) data.font_family = fontFamily;
        }
      }
      requestBody = data;
    }

    try {
      await api.updateTemplateElement(
        this.currentTemplate.id,
        elementId,
        requestBody,
        isMultipart
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

  showImportTemplateModal() {
    let container = document.getElementById("modal-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "modal-container";
      document.body.appendChild(container);
    }

    const modalHtml = `
      <div class="modal fade" id="importTemplateModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-upload me-2"></i>Template importeren</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Nieuwe template naam</label>
                <input type="text" class="form-control" id="importTemplateName" placeholder="Bijv. Klant X template">
              </div>
              <div class="mb-3">
                <label class="form-label">JSON bestand</label>
                <input type="file" accept="application/json" class="form-control" onchange="invoiceManager.loadTemplateImportFile(event)">
                <div class="form-text">Kies het geëxporteerde template-bestand of plak JSON hieronder.</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Template JSON</label>
                <textarea class="form-control" id="importTemplateJson" rows="8" placeholder="Plak hier de geëxporteerde template JSON"></textarea>
              </div>
              <div class="alert alert-info small mb-0">
                Bij import worden alle velden, kleuren, posities, elementen en regel-velden overgenomen. Afbeeldingspaden blijven verwijzen naar bestaande uploads.
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Annuleren</button>
              <button class="btn btn-primary" onclick="invoiceManager.importTemplateFromModal()">
                <i class="bi bi-cloud-arrow-down"></i> Importeren
              </button>
            </div>
          </div>
        </div>
      </div>`;

    container.innerHTML = modalHtml;
    const modalEl = document.getElementById("importTemplateModal");
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  },

  loadTemplateImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const textarea = document.getElementById("importTemplateJson");
      if (textarea) textarea.value = text;
      try {
        const parsed = JSON.parse(text);
        if (parsed.template && parsed.template.name) {
          const nameInput = document.getElementById("importTemplateName");
          if (nameInput && !nameInput.value) {
            nameInput.value = `${parsed.template.name} (import)`;
          }
        }
      } catch (err) {
        showToast("Kon JSON niet lezen uit bestand", "error");
      }
    };
    reader.readAsText(file);
  },

  async importTemplateFromModal() {
    const nameInput = document.getElementById("importTemplateName");
    const jsonArea = document.getElementById("importTemplateJson");
    const raw = jsonArea ? jsonArea.value.trim() : "";
    const customName = nameInput ? nameInput.value.trim() : "";

    if (!raw) {
      showToast("Plak of kies eerst een template JSON", "error");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      showToast("Ongeldige JSON", "error");
      return;
    }

    if (!payload.template) {
      showToast("JSON bevat geen template gegevens", "error");
      return;
    }

    const importPayload = {
      ...payload,
      name: customName || payload.template.name || "Imported Template",
    };

    try {
      const created = await api.importInvoiceTemplate(importPayload);
      showToast("Template geïmporteerd", "success");
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("importTemplateModal")
      );
      if (modal) modal.hide();

      await this.loadData();
      if (created && created.id) {
        await this.editTemplate(created.id);
      } else {
        this.showTemplates();
      }
    } catch (error) {
      console.error("Error importing template:", error);
      showToast(
        `${t("ui", "invoice.template_import_failed", "Import mislukt")}: ${
          error.message || error
        }`,
        "error"
      );
    }
  },

  async exportTemplate(templateId) {
    try {
      const data = await api.exportInvoiceTemplate(templateId);
      const template = (this.templates || []).find(
        (t) => String(t.id) === String(templateId)
      );
      const name = (template && template.name) || `template-${templateId}`;
      const slug = (str) =>
        (str || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^[-]+|[-]+$/g, "") ||
        "template";
      const fileName = `${slug(name)}-export.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Template geëxporteerd", "success");
    } catch (error) {
      console.error("Error exporting template:", error);
      showToast(
        `${t("ui", "invoice.template_export_failed", "Export mislukt")}: ${
          error.message || error
        }`,
        "error"
      );
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

      // Duplicate all elements - gebruik altijd JSON en laat backend de image_path hergebruiken
      if (fullTemplate.elements && fullTemplate.elements.length > 0) {
        for (const element of fullTemplate.elements) {
          console.log('[DUPLICATE] Adding element:', element.label, 'type:', element.element_type, 'has image:', !!element.image_path);
          
          // Stuur gewone JSON met alle velden inclusief image_path
          const data = {
            element_type: element.element_type,
            label: element.label || "",
            content: element.content || "",
            position_order: element.position_order || 0,
            font_size: element.font_size || 14,
            font_color: element.font_color || "#000000",
            font_weight: element.font_weight || "normal",
            font_family: element.font_family || null,
            calculation_formula: element.calculation_formula || "",
            image_align: element.image_align || "left",
            image_width: element.image_width || 150,
            image_height: element.image_height || 0,
            text_align_h: element.text_align_h || "left",
            // Bewaar image_path zodat het naar dezelfde afbeelding verwijst
            image_path: element.image_path || null,
          };
          
          await api.addTemplateElement(newTemplate.id, data);
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
    try {
      // Get template details to show in confirmation
      let tpl = (this.templates || []).find((t) => String(t.id) === String(templateId));
      if (!tpl) {
        try { tpl = await api.getInvoiceTemplate(templateId); } catch (e) {}
      }

      const name = tpl && tpl.name ? tpl.name : `#${templateId}`;
      const modalHtml = `
        <div class="modal fade" id="deleteTemplateModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-trash"></i> ${t("ui", "invoice.template_delete_title", "Template verwijderen")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p>${t("ui", "confirm_delete_template", "Weet je zeker dat je dit template wilt verwijderen?")}</p>
                <div class="alert alert-light border">
                  <div><strong>${t("ui", "invoice.template_name", "Naam")}</strong>: ${name}</div>
                </div>
                <div class="text-muted small">${t("ui", "invoice.template_delete_hint", "Als er facturen aan dit template gekoppeld zijn, kan verwijderen mislukken.")}</div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline-secondary" data-bs-dismiss="modal">${t("ui", "cancel", "Annuleren")}</button>
                <button id="confirmDeleteTemplateBtn" class="btn btn-danger">
                  <i class="bi bi-trash3"></i> ${t("ui", "delete", "Verwijderen")}
                </button>
              </div>
            </div>
          </div>
        </div>`;

      let container = document.getElementById("modal-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "modal-container";
        document.body.appendChild(container);
      }
      container.innerHTML = modalHtml;

      const modalEl = document.getElementById("deleteTemplateModal");
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();

      const confirmBtn = document.getElementById("confirmDeleteTemplateBtn");
      const originalHtml = confirmBtn.innerHTML;
      confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${t("ui", "deleting", "Verwijderen...")}`;
        try {
          await api.deleteInvoiceTemplate(templateId);
          showToast(t("ui", "invoice.template_deleted", "Factuursjabloon verwijderd"), "success");
          await this.loadData();
          this.showTemplates();
          bsModal.hide();
        } catch (error) {
          console.error("Error deleting template:", error);
          showToast(
            `${t("ui", "invoice.template_delete_failed", "Verwijderen mislukt")}: ${error.message}`,
            "error"
          );
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = originalHtml;
        }
      };
    } catch (error) {
      console.error("Error preparing delete template modal:", error);
      showToast(t("ui", "invoice.template_delete_failed", "Verwijderen mislukt"), "error");
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
                    <div class="col-md-4">
                      <label class="form-label">Type *</label>
                      <select class="form-select" id="invoice-type">
                        <option value="Verkoop" selected>Verkoop (Inkomsten)</option>
                        <option value="Inkoop">Inkoop (Uitgaven)</option>
                      </select>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label">Factuurdatum *</label>
                      <input type="date" class="form-control" id="invoice-date" value="${
                        new Date().toISOString().split("T")[0]
                      }">
                    </div>
                    <div class="col-md-4">
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

      // Vul klantnaam automatisch in met de template naam van de geselecteerde template
      setTimeout(() => {
        this.onTemplateSelected();
      }, 0);
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
                    <div class="col-md-4">
                      <label class="form-label">Type *</label>
                      <select class="form-select" id="invoice-type">
                        <option value="Verkoop" ${invoice.invoice_type === 'Verkoop' || !invoice.invoice_type ? 'selected' : ''}>Verkoop (Inkomsten)</option>
                        <option value="Inkoop" ${invoice.invoice_type === 'Inkoop' ? 'selected' : ''}>Inkoop (Uitgaven)</option>
                      </select>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label">Factuurdatum *</label>
                      <input type="date" class="form-control" id="invoice-date" value="${
                        invoice.invoice_date || ""
                      }">
                    </div>
                    <div class="col-md-4">
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

      // Fetch timesheet details for each submission and group by week AND user
      const weekUserGroups = {}; // Key: "week_user_id"
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

            // Group by week AND user
            const groupKey = `${ts.week_number}_${ts.user_id}`;
            if (!weekUserGroups[groupKey]) {
              weekUserGroups[groupKey] = {
                week_number: ts.week_number,
                user_id: ts.user_id,
                user_name: ts.user_name || "Unknown",
                timesheets: []
              };
            }
            weekUserGroups[groupKey].timesheets.push(fullTimesheet);
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
                             ts.total_km ?? (ts.end_km - ts.start_km ?? 0)
                           }" 
                           data-hours="${ts.total_hours ?? 0}">
                  </td>
                  <td>${ts.week_number || "-"}</td>
                  <td>${ts.company_name || "Unknown"}</td>
                  <td>${ts.ritnumber || "-"}</td>
                  <td>${ts.date || "-"}</td>
                  <td>${(ts.total_km ?? (ts.end_km - ts.start_km ?? 0)).toFixed(
                    2
                  )}</td>
                  <td>${(ts.total_hours ?? 0).toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;


      // Build weekly summary table (grouped by week AND user)
      const sortedWeekUsers = Object.keys(weekUserGroups).sort((a, b) => {
        const [weekA, userA] = a.split('_');
        const [weekB, userB] = b.split('_');
        // Sort by week descending, then by user_id
        if (parseInt(weekB) !== parseInt(weekA)) {
          return parseInt(weekB) - parseInt(weekA);
        }
        return parseInt(userA) - parseInt(userB);
      });

      const weeklyTableHtml = `
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th><input type="checkbox" id="select-all-weeks" onchange="invoiceManager.toggleAllWeeks(this)"></th>
                <th>Week</th>
                <th>Gebruiker</th>
                <th>Bedrijf</th>
                <th>Aantal Regels</th>
                <th>Totaal KM</th>
                <th>Totaal Uren</th>
              </tr>
            </thead>
            <tbody>
              ${sortedWeekUsers
                .map((groupKey) => {
                  const group = weekUserGroups[groupKey];
                  const weeksInThisGroup = group.timesheets;
                  
                  // DEBUG: Log the actual timesheet data
                  if (group.user_name === 'testuser') {
                    console.log('DEBUG testuser group:', {
                      groupKey,
                      count: weeksInThisGroup.length,
                      data: weeksInThisGroup.map(ts => ({
                        id: ts.id,
                        total_hours: ts.total_hours,
                        total_km: ts.total_km,
                        end_km: ts.end_km,
                        start_km: ts.start_km
                      }))
                    });
                  }
                  
                  const totalKm = weeksInThisGroup.reduce(
                    (sum, ts) => {
                      const km = ts.total_km ?? (ts.end_km - ts.start_km) ?? 0;
                      return sum + km;
                    },
                    0
                  );
                  const totalHours = weeksInThisGroup.reduce(
                    (sum, ts) => sum + (ts.total_hours ?? 0),
                    0
                  );
                  const companies = [
                    ...new Set(
                      weeksInThisGroup.map((ts) => ts.company_name || "Unknown")
                    ),
                  ].join(", ");

                  return `
                <tr>
                  <td>
                    <input type="checkbox" class="week-checkbox" data-week="${group.week_number}" 
                           data-user-id="${group.user_id}" data-user-name="${group.user_name}"
                           data-company="${companies}">
                  </td>
                  <td>Week ${group.week_number}</td>
                  <td>${group.user_name}</td>
                  <td>${companies}</td>
                  <td>${weeksInThisGroup.length}</td>
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

      // Store week+user groups for later use
      window.invoiceWeekUserGroups = weekUserGroups;

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

    // Get selected week+user combinations
    const selectedWeekUsers = Array.from(checkboxes).map((cb) => ({
      week: parseInt(cb.dataset.week),
      userId: parseInt(cb.dataset.userId),
      userName: cb.dataset.userName
    }));

    // Get all timesheets for selected weeks+users
    const weekUserData = window.invoiceWeekUserGroups || {};
    let importedCount = 0;

    const mode =
      document.getElementById("weekly-import-mode")?.value || "per-timesheet";

    for (const selected of selectedWeekUsers) {
      const groupKey = `${selected.week}_${selected.userId}`;
      const group = weekUserData[groupKey];
      if (!group || !group.timesheets || !group.timesheets.length) continue;
      const weekTs = group.timesheets;

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
            description: `Week ${selected.week} - ${selected.userName} - ${company}`,
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
            // item_rate removed - will use template hourly_rate
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
    const invoiceType = document.getElementById("invoice-type").value;
    const invoiceDate = document.getElementById("invoice-date").value;
    const dueDate = document.getElementById("invoice-due-date").value;
    const customerName = document.getElementById("customer-name").value.trim();
    const customerAddress = document
      .getElementById("customer-address")
      .value.trim();
    const notes = document.getElementById("invoice-notes").value.trim();
    const lineItems = this.getLineItems();

    if (!invoiceNumber || !invoiceDate) {
        showToast(t("ui", "invoice.number_and_date_required"), "error");
      return null;
    }

    if (lineItems.length === 0) {
      // Fallback text ensures a clear message even if the translation cache is stale
      showToast(
        t(
          "ui",
          "invoice.add_at_least_one_line",
          "Voeg minimaal één factuurregel toe"
        ),
        "error"
      );
      return null;
    }

    try {
      const payload = {
        template_id: templateId,
        invoice_number: invoiceNumber,
        invoice_type: invoiceType,
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
    try {
      const templateId = document.getElementById("invoice-template").value;
      const template = this.templates.find((t) => t.id == templateId);

      if (!template) return;

      // Vul klantnaam automatisch in met template naam
      const customerNameInput = document.getElementById("customer-name");
      if (customerNameInput) {
        customerNameInput.value = template.name;
      }
    } catch (error) {
      console.error("Error on template selected:", error);
    }
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
</textarea>
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

  getSelectedInvoiceIds() {
    const nodes = document.querySelectorAll(".invoice-checkbox:checked");
    return Array.from(nodes).map((n) => n.value);
  },

  showBulkEmailModal() {
    const ids = this.getSelectedInvoiceIds();
    if (!ids || ids.length === 0) {
      showToast("Selecteer eerst één of meer facturen", "error");
      return;
    }

    const selected = ids
      .map((id) => {
        const inv = this.invoices.find((i) => String(i.id) === String(id));
        return inv
          ? { id: inv.id, invoice_number: inv.invoice_number, status: inv.status }
          : { id, invoice_number: "(onbekend)", status: "" };
      })
      .slice(0, 200); // safety cap for modal size

    const rows = selected
      .map(
        (r, idx) => `
        <tr>
          <td class="text-muted">${idx + 1}</td>
          <td><span class="badge bg-light text-dark">${r.invoice_number || r.id}</span></td>
          <td>${r.status || ""}</td>
        </tr>`
      )
      .join("");

    const modalHtml = `
      <div class="modal fade" id="bulkEmailModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-send"></i> Facturen e-mailen (${selected.length})</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label">Onderwerp (placeholder {invoice_number} toegestaan)</label>
                  <input type="text" class="form-control" id="bulk-email-subject" value="Factuur {invoice_number}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Ontvanger</label>
                  <input type="email" class="form-control" id="bulk-email-recipient" placeholder="klant@example.com">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Bericht (placeholder {invoice_number} toegestaan)</label>
                <textarea class="form-control" id="bulk-email-message" rows="5">Beste,

In de bijlage vindt u factuur {invoice_number}.</textarea>
                <div class="form-text">De e-mail handtekening wordt automatisch toegevoegd.</div>
              </div>
              <div class="table-responsive border rounded mb-3">
                <table class="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Factuur</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>

              <div id="bulk-email-progress" class="d-none">
                <div class="progress mb-2">
                  <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
                </div>
                <div class="small text-muted" data-role="progress-text">0/${selected.length} verzonden</div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Sluiten</button>
              <button type="button" class="btn btn-primary" data-role="bulk-email-start">
                <i class="bi bi-send"></i> Verzenden
              </button>
            </div>
          </div>
        </div>
      </div>`;

    // Remove old modal
    const existing = document.getElementById("bulkEmailModal");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modalEl = document.getElementById("bulkEmailModal");
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    const recipientInput = modalEl.querySelector("#bulk-email-recipient");
    const startBtn = modalEl.querySelector('[data-role="bulk-email-start"]');
    const progressWrap = modalEl.querySelector('#bulk-email-progress');
    const progressBar = modalEl.querySelector('.progress-bar');
    const progressText = modalEl.querySelector('[data-role="progress-text"]');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    startBtn.addEventListener("click", async () => {
      const subjectTpl = modalEl.querySelector('#bulk-email-subject').value.trim();
      const msgTpl = modalEl.querySelector('#bulk-email-message').value.trim();
      const oneRecipient = recipientInput.value.trim();

      if (!subjectTpl) {
        showToast("Vul een onderwerp in", "error");
        return;
      }
      if (!msgTpl) {
        showToast("Vul een bericht in", "error");
        return;
      }
      if (!oneRecipient) {
        showToast("Vul een e-mailadres in", "error");
        return;
      }
      if (!emailRegex.test(oneRecipient)) {
        showToast("Ongeldig e-mailadres", "error");
        return;
      }

      // Lock UI
      startBtn.disabled = true;
      recipientInput.disabled = true;
      progressWrap.classList.remove('d-none');

      let sent = 0;
      let failed = 0;

      for (const item of selected) {
        const to = oneRecipient;
        const subject = subjectTpl.replaceAll('{invoice_number}', item.invoice_number || String(item.id));
        const message = msgTpl.replaceAll('{invoice_number}', item.invoice_number || String(item.id));
        try {
          await api.sendInvoiceEmail(item.id, {
            recipient_email: to,
            subject,
            message,
          });
          sent++;
        } catch (e) {
          console.error("Bulk email error for", item.id, e);
          failed++;
        }
        const pct = Math.round(((sent + failed) / selected.length) * 100);
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressText) progressText.textContent = `${sent + failed}/${selected.length} verwerkt`;
      }

      if (failed === 0) {
        showToast(`Alle ${sent} e-mails verzonden`, "success");
      } else if (sent === 0) {
        showToast("Verzenden mislukt voor alle geselecteerde facturen", "error");
      } else {
        showToast(`${sent} verzonden, ${failed} mislukt`, "warning");
      }

      // Refresh list to reflect 'sent' statuses
      try {
        await this.loadData();
        this.renderInvoiceList();
      } catch (_) {}

      // Close modal
      const m = bootstrap.Modal.getInstance(modalEl);
      if (m) m.hide();
      modalEl.remove();
    });
  },

  async deleteInvoice(invoiceId) {
    try {
      // Get invoice details to show in the confirmation modal
      let invoice = (this.invoices || []).find((i) => String(i.id) === String(invoiceId));
      if (!invoice) {
        try { invoice = await api.getInvoice(invoiceId); } catch (e) {}
      }

      const number = invoice && invoice.invoice_number ? invoice.invoice_number : `#${invoiceId}`;
      const customer = invoice && invoice.customer_name ? invoice.customer_name : "-";
      const total = invoice && typeof invoice.total_amount !== "undefined" ? invoice.total_amount : null;

      const modalHtml = `
        <div class="modal fade" id="deleteInvoiceModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-trash"></i> ${t("ui", "invoice.delete_title", "Factuur verwijderen")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p>${t("ui", "confirm_delete_invoice", "Weet je zeker dat je deze factuur wilt verwijderen?")}</p>
                <div class="alert alert-light border">
                  <div><strong>${t("ui", "invoice.number", "Factuurnummer")}</strong>: ${number}</div>
                  <div><strong>${t("ui", "invoice.customer", "Klant")}</strong>: ${customer}</div>
                  ${total !== null ? `<div><strong>${t("ui", "invoice.total", "Totaal")}</strong>: € ${Number(total).toFixed(2)}</div>` : ""}
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline-secondary" data-bs-dismiss="modal">${t("ui", "cancel", "Annuleren")}</button>
                <button id="confirmDeleteInvoiceBtn" class="btn btn-danger">
                  <i class="bi bi-trash3"></i> ${t("ui", "delete", "Verwijderen")}
                </button>
              </div>
            </div>
          </div>
        </div>`;

      let container = document.getElementById("modal-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "modal-container";
        document.body.appendChild(container);
      }
      container.innerHTML = modalHtml;

      const modalEl = document.getElementById("deleteInvoiceModal");
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();

      const confirmBtn = document.getElementById("confirmDeleteInvoiceBtn");
      const originalHtml = confirmBtn.innerHTML;
      confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${t("ui", "deleting", "Verwijderen...")}`;
        try {
          await api.deleteInvoice(invoiceId);
          showToast(t("ui", "invoice.deleted", "Factuur verwijderd"), "success");
          await this.loadData();
          this.renderInvoiceList();
          bsModal.hide();
        } catch (error) {
          console.error("Error deleting invoice:", error);
          showToast(
            `${t("ui", "invoice.invoice_delete_failed", "Verwijderen mislukt")}: ${error.message}`,
            "error"
          );
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = originalHtml;
        }
      };
    } catch (error) {
      console.error("Error preparing delete invoice modal:", error);
      showToast(t("ui", "invoice.invoice_delete_failed", "Verwijderen mislukt"), "error");
    }
  },

  handleInvoiceCheckboxChange(checkbox) {
    if (!checkbox) return;
    const isChecked = checkbox.checked;
    const invoiceId = checkbox.value;
    document
      .querySelectorAll(`.invoice-checkbox[value="${invoiceId}"]`)
      .forEach((cb) => {
        if (cb !== checkbox) cb.checked = isChecked;
      });
    this.updateBulkActions();
  },

  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll(".invoice-checkbox");
    checkboxes.forEach((cb) => (cb.checked = checked));
    const selectAllCheckbox = document.getElementById("select-all-invoices");
    if (selectAllCheckbox) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = checked;
    }
    this.updateBulkActions();
  },

  updateBulkActions() {
    const selected = document.querySelectorAll(".invoice-checkbox:checked");
    const selectedIds = new Set(Array.from(selected).map((cb) => cb.value));
    const count = selectedIds.size;
    const bulkBar = document.getElementById("bulk-actions-bar");
    const countSpan = document.getElementById("selected-count");

    if (bulkBar && countSpan) {
      if (count > 0) {
        bulkBar.classList.remove("d-none");
        countSpan.textContent = count;
      } else {
        bulkBar.classList.add("d-none");
      }
    }

    // Update select-all checkbox state
    const allIds = new Set();
    document
      .querySelectorAll(".invoice-checkbox")
      .forEach((cb) => allIds.add(cb.value));
    const selectAllCheckbox = document.getElementById("select-all-invoices");
    if (selectAllCheckbox) {
      selectAllCheckbox.indeterminate =
        count > 0 && count < allIds.size && allIds.size > 0;
      selectAllCheckbox.checked = count > 0 && count === allIds.size;
    }
  },

  clearSelection() {
    const checkboxes = document.querySelectorAll(".invoice-checkbox");
    checkboxes.forEach((cb) => (cb.checked = false));
    const selectAll = document.getElementById("select-all-invoices");
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
    this.updateBulkActions();
  },

  async bulkDelete() {
    const checkboxes = document.querySelectorAll(".invoice-checkbox:checked");
    const ids = Array.from(
      new Set(Array.from(checkboxes).map((cb) => cb.value))
    );

    if (ids.length === 0) {
      showToast(t("ui", "invoice.none_selected"), "error");
      return;
    }

    const confirmMessage = t(
      "ui",
      "invoice.confirm_delete_selected",
      "Weet je zeker dat je {count} geselecteerde facturen wilt verwijderen?"
    ).replace("{count}", ids.length);
    const confirmed = await this.showBulkDeleteConfirm(confirmMessage);
    if (!confirmed) {
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

  showBulkDeleteConfirm(message) {
    return new Promise((resolve) => {
      let modalEl = document.getElementById("bulkDeleteModal");

      if (!modalEl) {
        const modalHtml = `
        <div class="modal fade" id="bulkDeleteModal" tabindex="-1" aria-labelledby="bulkDeleteModalLabel">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="bulkDeleteModalLabel">
                  <i class="bi bi-trash me-2"></i>${t(
                    "ui",
                    "delete_selected",
                    "Verwijder geselecteerde"
                  )}
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${t(
                  "ui",
                  "close",
                  "Sluiten"
                )}"></button>
              </div>
              <div class="modal-body">
                <p class="mb-0" data-role="bulk-delete-message">${message}</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t(
                  "ui",
                  "cancel",
                  "Annuleren"
                )}</button>
                <button type="button" class="btn btn-danger" data-role="bulk-delete-confirm">
                  <i class="bi bi-trash"></i> ${t("ui", "confirm", "Verwijderen")}
                </button>
              </div>
            </div>
          </div>
        </div>`;

        document.body.insertAdjacentHTML("beforeend", modalHtml.trim());
        modalEl = document.getElementById("bulkDeleteModal");
      }

      const messageEl = modalEl.querySelector("[data-role='bulk-delete-message']");
      if (messageEl) {
        messageEl.textContent = message;
      }

      const confirmBtn = modalEl.querySelector("[data-role='bulk-delete-confirm']");
      const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);

      const cleanup = () => {
        if (confirmBtn) {
          confirmBtn.removeEventListener("click", onConfirm);
        }
        modalEl.removeEventListener("hidden.bs.modal", onHide);
      };

      const onHide = () => {
        cleanup();
        resolve(false);
      };

      const onConfirm = () => {
        cleanup();
        bsModal.hide();
        resolve(true);
      };

      if (confirmBtn) {
        confirmBtn.addEventListener("click", onConfirm, { once: true });
      }
      modalEl.addEventListener("hidden.bs.modal", onHide, { once: true });
      bsModal.show();
    });
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

    const confirmMessage = (
      t(
        "ui",
        "invoice.confirm_delete_before_date",
        "Weet je zeker dat je {count} facturen van vóór {date} wilt verwijderen?"
      ) || "Weet je zeker dat je {count} facturen wilt verwijderen?"
    )
      .replace("{count}", oldInvoices.length)
      .replace("{date}", beforeDate);

    const subText = t(
      "ui",
      "invoice.delete_before_date_subtext",
      "Deze actie kan niet ongedaan worden gemaakt."
    );

    let container = document.getElementById("modal-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "modal-container";
      document.body.appendChild(container);
    }

    container.innerHTML = `
      <div class="modal fade" id="deleteOldInvoicesModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-warning-subtle">
              <h5 class="modal-title"><i class="bi bi-calendar-x"></i> ${t(
                "ui",
                "invoice.delete_before_date_title",
                "Facturen vóór datum verwijderen"
              )}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-2">${confirmMessage}</p>
              <p class="text-muted small mb-0">${subText}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t(
                "ui",
                "cancel",
                "Annuleer"
              )}</button>
              <button type="button" class="btn btn-danger" id="confirmDeleteOldInvoicesBtn">
                <i class="bi bi-trash"></i> ${t(
                  "ui",
                  "invoice.delete_before_date_action",
                  "Verwijder"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>`;

    const modalEl = document.getElementById("deleteOldInvoicesModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const confirmBtn = document.getElementById("confirmDeleteOldInvoicesBtn");
    if (confirmBtn) {
      // Pass a shallow copy to avoid mutating the current list reference mid-delete
      confirmBtn.onclick = () =>
        this.confirmDeleteOldInvoices(
          beforeDate,
          [...oldInvoices],
          modal,
          confirmBtn
        );
    }
  },

  async confirmDeleteOldInvoices(beforeDate, invoices, modal, confirmBtn) {
    if (!confirmBtn) return;

    confirmBtn.disabled = true;
    const originalHtml = confirmBtn.innerHTML;
    confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${t(
      "ui",
      "processing",
      "Bezig..."
    )}`;

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const invoice of invoices) {
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
          t(
            "ui",
            "invoice.deleted_before_date",
            "{count} facturen verwijderd voor {date}"
          )
            .replace("{count}", successCount)
            .replace("{date}", beforeDate),
          "success"
        );
      } else {
        showToast(
          `${successCount} ${t(
            "ui",
            "invoice.deleted_short",
            "verwijderd"
          )}, ${errorCount} ${t("ui", "invoice.failed_short", "gefaald")}`,
          "warning"
        );
      }

      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error deleting old invoices:", error);
      showToast(
        `${t("ui", "invoice.delete_failed", "Verwijderen mislukt")}: ${
          error.message
        }`,
        "error"
      );
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalHtml;
      if (modal) {
        modal.hide();
      }
    }
  },

  clearAllInvoices() {
    const count = this.invoices.length;
    if (count === 0) {
      showToast(
        t("ui", "invoice.none_found", "Geen facturen gevonden"),
        "info"
      );
      return;
    }

    const message = (
      t(
        "ui",
        "invoice.clear_all_warning",
        "Weet je zeker dat je alle {count} facturen wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
      ) || ""
    ).replace("{count}", count);
    const subText = t(
      "ui",
      "invoice.clear_all_final_confirm",
      "Klik op Verwijder alles om door te gaan."
    );

    let container = document.getElementById("modal-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "modal-container";
      document.body.appendChild(container);
    }

    container.innerHTML = `
      <div class="modal fade" id="clearAllInvoicesModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title"><i class="bi bi-exclamation-triangle"></i> ${t(
                "ui",
                "invoice.clear_all_title",
                "Alle facturen verwijderen"
              )}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-2">${message}</p>
              <p class="text-muted small mb-0">${subText}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t(
                "ui",
                "cancel",
                "Annuleer"
              )}</button>
              <button type="button" class="btn btn-danger" id="confirmClearAllInvoicesBtn">
                <i class="bi bi-trash"></i> ${t(
                  "ui",
                  "invoice.clear_all_action",
                  "Verwijder alles"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>`;

    const modalEl = document.getElementById("clearAllInvoicesModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const confirmBtn = document.getElementById("confirmClearAllInvoicesBtn");
    if (confirmBtn) {
      confirmBtn.onclick = () =>
        this.confirmClearAllInvoices(modal, confirmBtn);
    }
  },

  async confirmClearAllInvoices(modal, confirmBtn) {
    if (!confirmBtn) return;

    confirmBtn.disabled = true;
    const originalHtml = confirmBtn.innerHTML;
    confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${t(
      "ui",
      "processing",
      "Bezig..."
    )}`;

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
          t(
            "ui",
            "invoice.all_deleted",
            "Alle {count} facturen verwijderd"
          ).replace("{count}", successCount),
          "success"
        );
      } else {
        showToast(
          `${successCount} ${t(
            "ui",
            "invoice.deleted_short",
            "verwijderd"
          )}, ${errorCount} ${t("ui", "invoice.failed_short", "gefaald")}`,
          "warning"
        );
      }

      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error clearing all invoices:", error);
      showToast(
        `${t("ui", "invoice.delete_failed", "Verwijderen mislukt")}: ${
          error.message
        }`,
        "error"
      );
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalHtml;
      if (modal) {
        modal.hide();
      }
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
              <button class="btn btn-outline-danger ms-2" onclick="invoiceManager.cleanUnusedImportTemplates()">
                <i class="bi bi-trash3"></i> Verwijder niet-gebruikte
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
                              <div class="mt-2">
                                <button class="btn btn-sm btn-outline-primary" onclick="invoiceManager.manageImportTemplate(${
                                  t.id
                                })">
                                  <i class="bi bi-magic"></i> AI mapping / Upload sample
                                </button>
                              </div>
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
      const tpl = await api.createImportTemplate({
        name,
        description,
        parser_type,
        config: {},
      });

      showToast(t("ui", "invoice.import_template_created"), "success");
      if (tpl && tpl.id) {
        await this.manageImportTemplate(tpl.id);
      } else {
        await this.showImportSettings();
      }
    } catch (error) {
      console.error("Error saving import template:", error);
      showToast(
        `${t("ui", "invoice.import_template_save_failed")}: ${error.message}`,
        "error"
      );
    }
  },

  async deleteImportTemplate(templateId) {
    try {
      const tpl = await api.getImportTemplate(templateId);

      const modalHtml = `
        <div class="modal fade" id="deleteImportTemplateModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-trash"></i> ${t("ui", "delete", "Verwijderen")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p>${t("ui", "invoice.import_template_delete_confirm", "Weet je zeker dat je dit import template wilt verwijderen?")}</p>
                <div class="alert alert-light border">
                  <div><strong>${t("ui", "invoice.template_name", "Naam")}</strong>: ${tpl && tpl.name ? tpl.name : "#"}</div>
                  <div><strong>${t("ui", "invoice.parser_type", "Parser type")}</strong>: ${tpl && tpl.parser_type ? tpl.parser_type : "-"}</div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline-secondary" data-bs-dismiss="modal">${t("ui", "cancel", "Annuleren")}</button>
                <button id="confirmDeleteImportTplBtn" class="btn btn-danger">
                  <i class="bi bi-trash3"></i> ${t("ui", "delete", "Verwijderen")}
                </button>
              </div>
            </div>
          </div>
        </div>`;

      let container = document.getElementById("modal-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "modal-container";
        document.body.appendChild(container);
      }
      container.innerHTML = modalHtml;

      const modalEl = document.getElementById("deleteImportTemplateModal");
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();

      const confirmBtn = document.getElementById("confirmDeleteImportTplBtn");
      const originalHtml = confirmBtn.innerHTML;
      confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${t("ui", "deleting", "Verwijderen...")}`;
        try {
          await api.deleteImportTemplate(templateId);
          showToast(t("ui", "invoice.import_template_deleted", "Template verwijderd"), "success");
          await this.showImportSettings();
          bsModal.hide();
        } catch (error) {
          console.error("Error deleting import template:", error);
          showToast(
            `${t("ui", "invoice.import_template_delete_failed", "Verwijderen mislukt")}: ${error.message}`,
            "error"
          );
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = originalHtml;
        }
      };
    } catch (error) {
      console.error("Error preparing delete modal:", error);
      showToast(t("ui", "invoice.import_template_delete_failed", "Verwijderen mislukt"), "error");
    }
  },

  async cleanUnusedImportTemplates() {
    if (
      !confirm(
        t(
          "ui",
          "invoice.import_template_cleanup_confirm",
          "Weet je zeker dat je alle niet-gebruikte import templates wilt verwijderen?"
        )
      )
    ) {
      return;
    }

    try {
      const result = await api.cleanupImportTemplates();
      const count = (result && result.count) || 0;
      if (count > 0) {
        showToast(
          `${count} ${t(
            "ui",
            "invoice.import_templates_deleted",
            "templates verwijderd"
          )}`,
          "success"
        );
      } else {
        showToast(
          t(
            "ui",
            "invoice.no_unused_import_templates",
            "Geen niet-gebruikte import templates gevonden"
          ),
          "info"
        );
      }
      await this.showImportSettings();
    } catch (error) {
      console.error("Error cleaning unused import templates:", error);
      showToast(
        `${t(
          "ui",
          "invoice.import_template_cleanup_failed",
          "Opschonen mislukt"
        )}: ${error.message}`,
        "error"
      );
    }
  },

  async manageImportTemplate(templateId) {
    try {
      const tpl = await api.getImportTemplate(templateId);
      const mappings = tpl.mappings || [];

      const fieldKeys = [
        "invoice_number",
        "total_amount",
        "invoice_date",
        "customer_name",
        "subtotal",
        "vat_amount",
      ];

      const labels = {
        invoice_number: "Factuurnummer",
        total_amount: "Totaal",
        invoice_date: "Datum",
        customer_name: "Klant",
        subtotal: "Subtotaal",
        vat_amount: "BTW",
      };

      const mappingRows = fieldKeys
        .map((key) => {
          const existing = mappings.find((m) => m.field_key === key) || {};
          return `
            <div class="border rounded p-2 mb-2">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <div class="fw-semibold">${labels[key]}</div>
                <span class="badge bg-secondary" id="aiBadge-${key}">Nog niet gedetecteerd</span>
              </div>
              <div class="d-flex gap-2 mb-2">
                <button class="btn btn-sm btn-outline-secondary ai-select-btn" data-field="${key}">
                  <i class="bi bi-cursor"></i> Selecteer op PDF
                </button>
                <select class="form-select form-select-sm ai-line-select" data-field="${key}">
                  <option value="">-- Kies tekstregel ter inspiratie --</option>
                </select>
              </div>
              <small class="text-muted d-block mb-2">Klik eerst “Selecteer op PDF”, klik dan op de gewenste tekst in de PDF. Je kunt ook een gedetecteerde regel kiezen.</small>
              <input type="text" class="form-control form-control-sm ai-map-input" data-field="${key}" placeholder="Regex bijv: ${key}[:\-\s]*([A-Z0-9./-]+)" value="${
            existing.pattern || ""
          }">
            </div>`;
        })
        .join("");

      const samplePreview = `
        <div id="aiPdfContainer" class="border rounded mb-2" style="position: relative; width: 100%; min-height: 320px; background: #f8f9fa; overflow: hidden;"></div>
      `;

      const modalHtml = `
        <div class="modal fade" id="manageImportTemplateModal" tabindex="-1">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">AI mapping voor ${tpl.name}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Upload sample PDF</label>
                  <input type="file" id="aiSampleUpload" class="form-control" accept="application/pdf">
                  <small class="text-muted">Gebruik een representatieve factuur om regex te testen.</small>
                </div>
                ${samplePreview}
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <button class="btn btn-sm btn-outline-primary" id="aiDetectSampleBtn">
                    <i class="bi bi-magic"></i> Analyseer sample met AI
                  </button>
                  <div class="small text-muted">We tonen gevonden velden en de ruwe tekstregels voor regex hulp.</div>
                </div>
                <div id="aiDetectStatus" class="border rounded p-2 bg-light small mb-3">
                  <div class="text-muted">Nog niet geanalyseerd</div>
                </div>
                <div class="alert alert-info small">
                  Tip: Klik “Selecteer op PDF” bij een veld en klik vervolgens op de tekst in de PDF om het automatisch te vullen zonder zelf een regex te typen. Regex blijft mogelijk voor gevorderd gebruik.
                </div>
                <div>${mappingRows}</div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Sluiten</button>
                <button class="btn btn-primary" id="saveAiMappingsBtn">Opslaan</button>
              </div>
            </div>
          </div>
        </div>`;

      // inject modal
      let container = document.getElementById("modal-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "modal-container";
        document.body.appendChild(container);
      }
      container.insertAdjacentHTML("beforeend", modalHtml);

      const modalEl = document.getElementById("manageImportTemplateModal");
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();

      let lastDetect = null;
      let currentLines = [];
      let uploadedSampleFile = null;
      let activeSelectField = null;
      let currentPdfObjectUrl = null;

      const badgeFor = (key, field) => {
        const badge = modalEl.querySelector(`#aiBadge-${key}`);
        if (!badge) return;
        if (!field || field.missing) {
          badge.textContent = `${labels[key]} ontbreekt`;
          badge.className = "badge bg-danger";
          return;
        }
        const confidence = Math.round((field.confidence || 0) * 100);
        let cls = "badge bg-success";
        if ((field.confidence || 0) < 0.75) cls = "badge bg-warning text-dark";
        badge.textContent = `${labels[key]}: ${
          field.value ?? "-"
        } (${confidence}%)`;
        badge.className = cls;
      };

      const renderDetectResult = (data) => {
        const target = modalEl.querySelector("#aiDetectStatus");
        if (!target) return;
        if (!data) {
          target.innerHTML = `<div class="text-muted">Nog niet geanalyseerd</div>`;
          fieldKeys.forEach((k) => {
            const badge = modalEl.querySelector(`#aiBadge-${k}`);
            if (badge) {
              badge.textContent = "Nog niet gedetecteerd";
              badge.className = "badge bg-secondary";
            }
          });
          return;
        }

        const missingRequired = data.summary?.missing_fields || [];
        const notes = data.summary?.notes || [];

        fieldKeys.forEach((k) => badgeFor(k, data.fields?.[k]));

        target.innerHTML = `
          <div class="fw-semibold mb-1">Analyse: ${
            data.file?.filename || "(sample)"
          }</div>
          ${
            missingRequired.length
              ? `<div class="text-danger">Ontbreekt: ${missingRequired.join(
                  ", "
                )}</div>`
              : ""
          }
          ${
            notes.length
              ? `<div class="text-warning">${notes.join(" ")}</div>`
              : ""
          }
        `;
      };

      const ensurePdfJs = () => {
        if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

        const sources = [
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js",
          "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js",
          "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.min.js",
          "https://mozilla.github.io/pdf.js/build/pdf.min.js",
          "/js/vendor/pdfjs/pdf.min.js",
        ];

        const tryLoad = (srcIndex = 0) => {
          if (srcIndex >= sources.length) {
            return Promise.reject(
              new Error("pdf.js laden mislukt (alle cdn's)")
            );
          }
          const src = sources[srcIndex];
          return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => {
              if (window.pdfjsLib) {
                const workerSrc = src.replace(
                  "pdf.min.js",
                  "pdf.worker.min.js"
                );
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
                resolve(window.pdfjsLib);
              } else {
                reject(new Error("pdf.js niet beschikbaar"));
              }
            };
            script.onerror = () => {
              // try next source
              tryLoad(srcIndex + 1)
                .then(resolve)
                .catch(reject);
            };
            document.head.appendChild(script);
          });
        };

        return tryLoad();
      };

      const renderPdfPreview = async (fileOrUrl) => {
        const container = modalEl.querySelector("#aiPdfContainer");
        if (!container) return;
        container.innerHTML =
          '<div class="p-3 text-muted small">PDF laden...</div>';
        let fallbackUrl = null;
        if (fileOrUrl instanceof File) {
          fallbackUrl = URL.createObjectURL(fileOrUrl);
        } else if (typeof fileOrUrl === "string") {
          fallbackUrl = fileOrUrl.startsWith("http")
            ? fileOrUrl
            : `${window.location.origin}${fileOrUrl}`;
        }
        try {
          const pdfjsLib = await ensurePdfJs();
          let loadingTask;
          if (fileOrUrl instanceof File) {
            const data = await fileOrUrl.arrayBuffer();
            loadingTask = pdfjsLib.getDocument({ data });
          } else {
            let url = fileOrUrl;
            if (
              fileOrUrl &&
              fileOrUrl.startsWith &&
              fileOrUrl.startsWith("/")
            ) {
              // allow relative served sample paths
              url = window.location.origin + fileOrUrl;
            }
            loadingTask = pdfjsLib.getDocument(url);
          }

          const pdf = await loadingTask.promise;

          container.innerHTML = "";
          container.style.position = "relative";
          container.style.width = "100%";
          container.style.maxHeight = "70vh";
          container.style.overflow = "auto";

          // Use container width to scale pages
          const containerWidth = container.clientWidth || 800;
          const fragment = document.createDocumentFragment();

          const renderPage = async (pageNum) => {
            const page = await pdf.getPage(pageNum);
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = containerWidth / baseViewport.width;
            const viewport = page.getViewport({ scale });

            const pageWrap = document.createElement("div");
            pageWrap.className = "ai-pdf-page";
            Object.assign(pageWrap.style, {
              position: "relative",
              marginBottom: "12px",
              width: `${viewport.width}px`,
              height: `${viewport.height}px`,
            });

            const canvas = document.createElement("canvas");
            const textLayer = document.createElement("div");
            textLayer.className = "ai-text-layer";
            Object.assign(textLayer.style, {
              position: "absolute",
              left: "0",
              top: "0",
              width: `${viewport.width}px`,
              height: `${viewport.height}px`,
              pointerEvents: "auto",
            });

            const context = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            pageWrap.appendChild(canvas);
            pageWrap.appendChild(textLayer);
            fragment.appendChild(pageWrap);

            await page.render({ canvasContext: context, viewport }).promise;
            const textContent = await page.getTextContent();
            await pdfjsLib.renderTextLayer({
              textContent,
              container: textLayer,
              viewport,
              textDivs: [],
            }).promise;

            textLayer.querySelectorAll("span").forEach((span) => {
              span.style.background = "transparent";
              span.style.color = "rgba(0,0,0,0.75)";
              span.style.cursor = "pointer";
              span.addEventListener("click", () => {
                if (!activeSelectField) {
                  showToast(
                    "Kies eerst een veld met 'Selecteer op PDF'",
                    "info"
                  );
                  return;
                }
                const text = span.textContent?.trim();
                if (!text) return;
                const targetInput = modalEl.querySelector(
                  `.ai-map-input[data-field="${activeSelectField}"]`
                );
                if (!targetInput) return;
                const suggestion = `(${escapeRegex(text)})`;
                targetInput.value = suggestion;
                textLayer
                  .querySelectorAll("span")
                  .forEach((s) => s.classList.remove("bg-warning"));
                span.classList.add("bg-warning");
                span.style.borderRadius = "2px";
                showToast(
                  `${labels[activeSelectField]} gevuld vanaf selectie`,
                  "success"
                );
              });
            });
          };

          for (let p = 1; p <= pdf.numPages; p++) {
            // eslint-disable-next-line no-await-in-loop
            await renderPage(p);
          }

          container.appendChild(fragment);
        } catch (err) {
          console.error("PDF render mislukt", err);
          const link = fallbackUrl
            ? `<a href="${fallbackUrl}" target="_blank" rel="noopener">Open PDF in nieuw tabblad</a>`
            : "";
          container.innerHTML = `<div class="p-3 text-danger small">Kon PDF niet laden (${
            err.message || "onbekend"
          }). ${link}</div>`;
        }
      };

      const populateLineSelects = (lines) => {
        currentLines = lines || [];
        const options =
          '<option value="">-- Kies tekstregel ter inspiratie --</option>' +
          currentLines
            .map((line, idx) => {
              const display =
                line.length > 120 ? `${line.slice(0, 117)}...` : line;
              return `<option value="${idx}">${display}</option>`;
            })
            .join("");
        modalEl.querySelectorAll(".ai-line-select").forEach((sel) => {
          sel.innerHTML = options;
        });
      };

      const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const suggestRegexFromLine = (line) => {
        if (!line) return "";
        const amountMatch = line.match(/([0-9][0-9.,]*\d)/);
        if (amountMatch) {
          const escapedAmount = escapeRegex(amountMatch[1]);
          return escapeRegex(line).replace(escapedAmount, "([0-9.,-]+)");
        }
        return `${escapeRegex(line)}\\s*([A-Za-z0-9./-]+)`;
      };

      const getSampleFile = async () => {
        const fileInput = modalEl.querySelector("#aiSampleUpload");
        const selected = fileInput?.files?.[0];
        if (selected) return selected;
        if (uploadedSampleFile) return uploadedSampleFile;
        if (tpl.sample_pdf_path) {
          const response = await fetch(tpl.sample_pdf_path);
          const blob = await response.blob();
          return new File([blob], `${tpl.name || "sample"}.pdf`, {
            type: "application/pdf",
          });
        }
        return null;
      };

      const runDetectOnSample = async () => {
        const btn = modalEl.querySelector("#aiDetectSampleBtn");
        const file = await getSampleFile();
        if (!file) {
          showToast("Upload eerst een sample PDF", "error");
          return;
        }

        if (btn) {
          btn.disabled = true;
          btn.innerHTML =
            '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Bezig...';
        }

        try {
          const formData = new FormData();
          formData.append("pdf", file);
          formData.append("template_id", templateId);
          const result = await api.autoDetectImportPdf(formData);
          lastDetect = result;
          renderDetectResult(result);
          populateLineSelects(result.raw_lines || []);
          showToast("Analyse afgerond", "success");
        } catch (err) {
          console.error("Detect sample failed", err);
          showToast(err.message || "Analyse mislukt", "error");
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML =
              '<i class="bi bi-magic"></i> Analyseer sample met AI';
          }
        }
      };

      document.getElementById("saveAiMappingsBtn").onclick = async () => {
        try {
          const inputs = modalEl.querySelectorAll(".ai-map-input");
          const newMappings = Array.from(inputs).map((inp) => ({
            field_key: inp.dataset.field,
            pattern: inp.value.trim(),
            page: 1,
          }));

          await api.saveImportTemplateMappings(templateId, newMappings);
          showToast("AI mappings opgeslagen", "success");
          bsModal.hide();
        } catch (err) {
          console.error("Error saving mappings:", err);
          showToast(err.message || "Opslaan mislukt", "error");
        }
      };

      // sample upload handler
      document
        .getElementById("aiSampleUpload")
        .addEventListener("change", async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          uploadedSampleFile = file;
          const formData = new FormData();
          formData.append("pdf", file);
          try {
            const res = await api.uploadImportTemplateSample(
              templateId,
              formData
            );
            showToast("Sample geüpload", "success");
            await renderPdfPreview(file);
          } catch (err) {
            console.error("Sample upload failed:", err);
            showToast(err.message || "Upload mislukt", "error");
          }
        });

      modalEl.querySelectorAll(".ai-line-select").forEach((sel) => {
        sel.onchange = (e) => {
          const field = e.target.dataset.field;
          const idx = parseInt(e.target.value, 10);
          if (Number.isNaN(idx) || idx < 0 || idx >= currentLines.length)
            return;
          const targetInput = modalEl.querySelector(
            `.ai-map-input[data-field="${field}"]`
          );
          if (!targetInput) return;
          const suggestion = suggestRegexFromLine(currentLines[idx]);
          targetInput.value = suggestion;
        };
      });

      // field selection buttons
      modalEl.querySelectorAll(".ai-select-btn").forEach((btn) => {
        btn.onclick = () => {
          const field = btn.dataset.field;
          activeSelectField = activeSelectField === field ? null : field;
          modalEl.querySelectorAll(".ai-select-btn").forEach((b) => {
            b.classList.toggle(
              "btn-primary",
              b.dataset.field === activeSelectField
            );
            b.classList.toggle(
              "btn-outline-secondary",
              b.dataset.field !== activeSelectField
            );
          });
          if (activeSelectField) {
            showToast(
              `Klik nu op de PDF voor ${labels[activeSelectField]}`,
              "info"
            );
          }
        };
      });

      const detectBtn = modalEl.querySelector("#aiDetectSampleBtn");
      if (detectBtn) detectBtn.onclick = () => runDetectOnSample();

      // if we already have a sample pdf path, offer initial line list after fetch
      if (tpl.sample_pdf_path) {
        renderDetectResult(null);
        renderPdfPreview(tpl.sample_pdf_path);
      }

      modalEl.addEventListener("hidden.bs.modal", () => {
        if (currentPdfObjectUrl) {
          URL.revokeObjectURL(currentPdfObjectUrl);
        }
        modalEl.remove();
      });
    } catch (error) {
      console.error("Error managing import template:", error);
      showToast("Kon import template niet openen", "error");
    }
  },
};

// Make accessible globally
window.invoiceManager = invoiceManager;
