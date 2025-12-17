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
      showToast("Fout bij laden van factuurgegevens", "error");
    }
  },

  renderInvoiceList() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="container-fluid mt-4">
        <div class="row mb-4">
          <div class="col">
            <h2><i class="bi bi-receipt"></i> Facturen</h2>
          </div>
          <div class="col-auto">
            <button class="btn btn-primary" onclick="invoiceManager.showCreateInvoice()">
              <i class="bi bi-plus-circle"></i> Nieuwe Factuur
            </button>
            <button class="btn btn-outline-secondary" onclick="invoiceManager.showTemplates()">
              <i class="bi bi-layout-text-sidebar"></i> Templates
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="card mb-4">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <input type="text" class="form-control" id="invoice-search" 
                       placeholder="Zoek op factuurnummer of klant..." 
                       onkeyup="invoiceManager.filterInvoices()">
              </div>
              <div class="col-md-3">
                <select class="form-select" id="invoice-status-filter" onchange="invoiceManager.filterInvoices()">
                  <option value="">Alle statussen</option>
                  <option value="draft">Concept</option>
                  <option value="sent">Verzonden</option>
                  <option value="paid">Betaald</option>
                  <option value="cancelled">Geannuleerd</option>
                </select>
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
                    <th>Factuurnummer</th>
                    <th>Klant</th>
                    <th>Datum</th>
                    <th>Bedrag</th>
                    <th>Status</th>
                    <th>Acties</th>
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

  renderInvoiceRows() {
    if (this.invoices.length === 0) {
      return '<tr><td colspan="6" class="text-center text-muted">Geen facturen gevonden</td></tr>';
    }

    return this.invoices
      .map((invoice) => {
        const statusBadge = this.getStatusBadge(invoice.status);
        return `
        <tr>
          <td><strong>${invoice.invoice_number}</strong></td>
          <td>${invoice.customer_name || "-"}</td>
          <td>${invoice.invoice_date}</td>
          <td>€ ${parseFloat(invoice.total_amount).toFixed(2)}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="invoiceManager.viewInvoice(${
                invoice.id
              })" title="Bekijken">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-secondary" onclick="invoiceManager.showEditInvoice(${invoice.id})" title="Bewerken">
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
              })" title="Verwijderen">
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

    if (!name) {
      showToast("Template naam is verplicht", "error");
      return;
    }

    try {
      const template = await api.createInvoiceTemplate({
        name,
        description,
        is_default: is_default ? 1 : 0,
      });

      showToast("Template succesvol aangemaakt", "success");
      await this.loadData();
      this.editTemplate(template.id);
    } catch (error) {
      console.error("Error creating template:", error);
      showToast("Fout bij aanmaken template: " + error.message, "error");
    }
  },

  async editTemplate(templateId) {
    try {
      this.currentTemplate = await api.getInvoiceTemplate(templateId);
      this.renderTemplateEditor();
    } catch (error) {
      console.error("Error loading template:", error);
      showToast("Fout bij laden template", "error");
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
      'top_left': '#preview-top-left',
      'top_center': '#preview-top-center',
      'top_right': '#preview-top-right',
      'address_left': '#preview-addr-left',
      'address_center': '#preview-addr-center',
      'address_right': '#preview-addr-right',
    };

    // Clear all preview areas
    Object.values(positions).forEach(id => {
      const el = document.querySelector(id);
      if (el) el.innerHTML = '';
    });

    // Populate preview areas
    elements.forEach(el => {
      const selector = positions[el.element_type];
      if (selector) {
        const previewEl = document.querySelector(selector);
        if (previewEl) {
          const label = el.label || el.element_type;
          const content = el.content ? el.content.substring(0, 20) + (el.content.length > 20 ? '...' : '') : '';
          previewEl.innerHTML += `<div style="margin: 5px 0; padding: 4px; background: #f0f0f0; border-radius: 2px; font-weight: 500;">${label}${content ? ': ' + content : ''}</div>`;
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

    if (type === "text" || type === "sender" || type === "title" || type.startsWith('top_') || type.startsWith('address_')) {
      let labelText = "Tekst Inhoud *";
      let placeholder = "";
      let helpText = "";
      let rows = 3;

      if (type === "sender") {
        labelText = "Afzender Tekst (meerdere regels mogelijk) *";
        placeholder = "Bijv:\nBedrijfsnaam B.V.\nStraatnaam 123\n1234 AB Plaats";
        helpText = '<small class="text-muted">Deze tekst komt rechts naast "Factuuradres:"</small>';
      } else if (type === "title") {
        labelText = "Titel Tekst (bovenaan PDF) *";
        placeholder = "Bijv: FACTUUR";
        helpText = '<small class="text-muted">Deze tekst komt bovenaan de PDF (groot en prominent)</small>';
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
        helpText = '<small class="text-muted">Rechterkolom bovenaan PDF</small>';
      } else if (type === "address_left") {
        labelText = "Inhoud Adres Links (Factuuradres) *";
        placeholder = "Bijv: Klantnaam en adres";
        helpText = '<small class="text-muted">Linkerkolom in adressectie</small>';
      } else if (type === "address_center") {
        labelText = "Inhoud Adres Midden *";
        placeholder = "Bijv: Factuuradreslabel";
        helpText = '<small class="text-muted">Middenkolom in adressectie</small>';
      } else if (type === "address_right") {
        labelText = "Inhoud Adres Rechts (Afzender) *";
        placeholder = "Bijv: Bedrijfsnaam en adres";
        helpText = '<small class="text-muted">Rechterkolom in adressectie (afzender)</small>';
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
    if (type === "text" || type.startsWith('top_') || type.startsWith('address_')) {
      const content = document.getElementById("element-content").value;
      const fontSize = document.getElementById("element-font-size").value;
      const fontColor = document.getElementById("element-font-color").value;
      const fontWeight = document.getElementById("element-font-weight").value;

      if (!content) {
        showToast("Tekst inhoud is verplicht", "error");
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
        showToast("Tekst inhoud is verplicht", "error");
        return;
      }

      formData.append("content", content);
      formData.append("font_size", fontSize);
      formData.append("font_color", fontColor);
      formData.append("font_weight", fontWeight);
    } else if (type === "image") {
      const imageFile = document.getElementById("element-image").files[0];
      if (!imageFile) {
        showToast("Selecteer een afbeelding", "error");
        return;
      }
      formData.append("image", imageFile);
    }

    try {
      await api.addTemplateElement(templateId, formData);
      showToast("Element toegevoegd", "success");
      await this.editTemplate(templateId);
    } catch (error) {
      console.error("Error adding element:", error);
      showToast("Fout bij toevoegen element: " + error.message, "error");
    }
  },

  renderTemplateElements() {
    const elements = this.currentTemplate.elements || [];

    if (elements.length === 0) {
      return '<p class="text-muted text-center">Nog geen elementen toegevoegd</p>';
    }

    return elements
      .map((el, index) => {
        let preview = "";

        // Handle text-based types (including new layout types)
        if (
          el.element_type === "text" ||
          el.element_type === "sender" ||
          el.element_type === "title" ||
          el.element_type.startsWith('top_') ||
          el.element_type.startsWith('address_')
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

  async deleteElement(elementId) {
    if (!confirm("Weet je zeker dat je dit element wilt verwijderen?")) {
      return;
    }

    try {
      await api.deleteTemplateElement(this.currentTemplate.id, elementId);
      showToast("Element verwijderd", "success");
      await this.editTemplate(this.currentTemplate.id);
    } catch (error) {
      console.error("Error deleting element:", error);
      showToast("Fout bij verwijderen element", "error");
    }
  },

  async deleteTemplate(templateId) {
    if (!confirm("Weet je zeker dat je dit template wilt verwijderen?")) {
      return;
    }

    try {
      await api.deleteInvoiceTemplate(templateId);
      showToast("Template verwijderd", "success");
      await this.loadData();
      this.showTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      showToast("Fout bij verwijderen template: " + error.message, "error");
    }
  },

  async previewTemplatePDF() {
    try {
      const templateId = this.currentTemplate.id;
      if (!templateId) {
        showToast("Template ID niet gevonden", "error");
        return;
      }
      
      const pdfUrl = `/api/invoices/template/${templateId}/preview-pdf`;
      console.log("Fetching PDF preview:", pdfUrl);
      
      showToast("PDF wordt gegenereerd...", "info");
      
      // Fetch PDF as blob
      const response = await fetch(pdfUrl);
      console.log("Response status:", response.status, response.statusText);
      console.log("Response headers:", response.headers.get('content-type'), response.headers.get('content-length'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", errorText);
        throw new Error('Failed to generate PDF: ' + response.status);
      }
      
      const blob = await response.blob();
      console.log("Blob received:", blob.size, "bytes, type:", blob.type);
      
      if (blob.size === 0) {
        throw new Error('PDF is leeg (0 bytes)');
      }
      
      const blobUrl = URL.createObjectURL(blob);
      
      // Open blob URL in new window
      window.open(blobUrl, '_blank');
      showToast("PDF preview geopend", "success");
    } catch (error) {
      console.error("Error generating preview:", error);
      showToast("Fout bij genereren preview: " + error.message, "error");
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
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Factuurregels</h5>
                  <button class="btn btn-sm btn-primary" onclick="invoiceManager.addLineItem()">
                    <i class="bi bi-plus"></i> Regel Toevoegen
                  </button>
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
      showToast("Fout bij voorbereiden factuur", "error");
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
              <div class="text-muted">Factuurnummer: ${invoice.invoice_number}</div>
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
                          <option value="${t.id}" ${t.id === invoice.template_id ? "selected" : ""}>${t.name}</option>
                        `
                          )
                          .join("")}
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Factuurnummer *</label>
                      <input type="text" class="form-control" id="invoice-number" value="${invoice.invoice_number}" readonly>
                      <small class="text-muted">Factuurnummer blijft gelijk bij bewerken</small>
                    </div>
                  </div>

                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label class="form-label">Factuurdatum *</label>
                      <input type="date" class="form-control" id="invoice-date" value="${invoice.invoice_date || ""}">
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Vervaldatum</label>
                      <input type="date" class="form-control" id="invoice-due-date" value="${invoice.due_date || ""}">
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Klant Naam (optioneel)</label>
                    <div class="input-group">
                      <input type="text" class="form-control" id="customer-name" value="${invoice.customer_name || ""}">
                      <button class="btn btn-outline-secondary" type="button" onclick="invoiceManager.fillCustomerFromTemplate()" title="Vul in vanuit template">
                        <i class="bi bi-arrow-repeat"></i>
                      </button>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Klant Adres (optioneel)</label>
                    <textarea class="form-control" id="customer-address" rows="3">${invoice.customer_address || ""}</textarea>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Opmerkingen</label>
                    <textarea class="form-control" id="invoice-notes" rows="2">${invoice.notes || ""}</textarea>
                  </div>
                </div>
              </div>

              <!-- Line Items -->
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Factuurregels</h5>
                  <button class="btn btn-sm btn-primary" onclick="invoiceManager.addLineItem()">
                    <i class="bi bi-plus"></i> Regel Toevoegen
                  </button>
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
      showToast("Fout bij laden factuur voor bewerken", "error");
    }
  },

  addLineItem(defaults = {}) {
    const container = document.getElementById("line-items-container");
    const index = container.children.length;

    const descriptionVal = defaults.description || "";
    const quantityVal = defaults.quantity ?? 1;
    const priceVal = defaults.unit_price ?? 0;

    const lineItem = document.createElement("div");
    lineItem.className = "card mb-2";
    lineItem.innerHTML = `
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-5">
            <label class="form-label small">Omschrijving</label>
            <input type="text" class="form-control form-control-sm line-description" data-index="${index}" value="${descriptionVal}">
          </div>
          <div class="col-md-2">
            <label class="form-label small">Aantal</label>
            <input type="number" class="form-control form-control-sm line-quantity" data-index="${index}" 
                   value="${quantityVal}" min="0" step="0.01" onchange="invoiceManager.calculateTotals()">
          </div>
          <div class="col-md-3">
            <label class="form-label small">Prijs</label>
            <input type="number" class="form-control form-control-sm line-price" data-index="${index}" 
                   value="${priceVal}" min="0" step="0.01" onchange="invoiceManager.calculateTotals()">
          </div>
          <div class="col-md-2 text-end">
            <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.card').remove(); invoiceManager.calculateTotals()">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(lineItem);
    this.calculateTotals();
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
    const quantities = document.querySelectorAll(".line-quantity");
    const prices = document.querySelectorAll(".line-price");

    descriptions.forEach((desc, index) => {
      const description = desc.value.trim();
      if (description) {
        lineItems.push({
          description,
          quantity: parseFloat(quantities[index].value) || 1,
          unit_price: parseFloat(prices[index].value) || 0,
        });
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
      showToast("Voeg minimaal één factuurregel toe", "error");
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
          showToast("Factuur bijgewerkt", "success");
        }
      } else {
        invoice = await api.createInvoice(payload);
        if (!returnInvoice) {
          showToast("Factuur succesvol opgeslagen", "success");
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
      showToast("Fout bij opslaan factuur: " + error.message, "error");
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
      const template = this.templates.find(t => t.id == templateId);

      if (!template) return;

      // Fetch template elements to find address_left content
      const templateData = await api.getInvoiceTemplate(templateId);
      const elements = templateData.elements || [];

      // Find address_left element which contains the customer address
      const addressElement = elements.find(el => el.element_type === "address_left");

      if (addressElement && addressElement.content) {
        document.getElementById("customer-address").value = addressElement.content;
        showToast("Klantgegevens ingevuld vanuit template", "success");
      } else {
        showToast("Geen klantgegevens gevonden in template", "info");
      }
    } catch (error) {
      console.error("Error filling customer from template:", error);
      showToast("Fout bij laden template gegevens", "error");
    }
  },

  async saveAndGeneratePDF() {
    const invoice = await this.saveInvoice(true);
    if (!invoice) return;

    try {
      const result = await api.generateInvoicePDF(invoice.id);
      showToast("PDF succesvol gegenereerd", "success");

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
      showToast("Fout bij genereren PDF: " + error.message, "error");
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
                  <button class="btn btn-secondary w-100 mb-2" onclick="invoiceManager.showEditInvoice(${invoice.id})">
                    <i class="bi bi-pencil"></i> Bewerken
                  </button>
                  <button class="btn btn-success w-100 mb-2" onclick="invoiceManager.downloadPDF(${
                    invoice.id
                  })">
                    <i class="bi bi-file-pdf"></i> Download PDF
                  </button>
                  <button class="btn btn-info w-100 mb-2" onclick="invoiceManager.showEmailModal(${
                    invoice.id
                  })">
                    <i class="bi bi-envelope"></i> Verstuur per Email
                  </button>
                  <hr>
                  <button class="btn btn-outline-danger w-100" onclick="invoiceManager.deleteInvoice(${
                    invoice.id
                  })">
                    <i class="bi bi-trash"></i> Verwijderen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error viewing invoice:", error);
      showToast("Fout bij laden factuur", "error");
    }
  },

  async downloadPDF(invoiceId) {
    try {
      showToast("PDF wordt gegenereerd...", "info");
      const blob = await api.downloadInvoicePDF(invoiceId);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast("PDF gedownload", "success");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      showToast("Fout bij downloaden PDF", "error");
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
      showToast("Fout bij laden factuurgegevens", "error");
    }
  },

  async sendEmail(invoiceId) {
    const recipient = document.getElementById("email-recipient").value.trim();
    const subject = document.getElementById("email-subject").value.trim();
    const message = document.getElementById("email-message").value.trim();

    if (!recipient) {
      showToast("Email adres is verplicht", "error");
      return;
    }

    try {
      await api.sendInvoiceEmail(invoiceId, {
        recipient_email: recipient,
        subject: subject,
        message: message,
      });

      showToast("Factuur succesvol verzonden", "success");

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("emailInvoiceModal")
      );
      modal.hide();

      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error sending email:", error);
      showToast("Fout bij verzenden email: " + error.message, "error");
    }
  },

  async deleteInvoice(invoiceId) {
    if (!confirm("Weet je zeker dat je deze factuur wilt verwijderen?")) {
      return;
    }

    try {
      await api.deleteInvoice(invoiceId);
      showToast("Factuur verwijderd", "success");
      await this.loadData();
      this.renderInvoiceList();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      showToast("Fout bij verwijderen factuur: " + error.message, "error");
    }
  },
};

// Make accessible globally
window.invoiceManager = invoiceManager;
