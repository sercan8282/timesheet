// This file shows the updated renderElementForm function with 6 new element types supported
// Add this to public/js/invoices.js to replace the existing renderElementForm method

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

    return baseFields + `
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
        <label class="form-label">Tekstgewicht</label>
        <select class="form-select" id="element-font-weight">
          <option value="normal">Normaal</option>
          <option value="bold">Vet</option>
        </select>
      </div>
    `;
  } else if (type === "image") {
    return baseFields + `
      <div class="mb-3">
        <label class="form-label">Afbeelding *</label>
        <input type="file" class="form-control" id="element-image" accept="image/*">
      </div>
    `;
  } else {
    return baseFields + `
      <div class="alert alert-info">
        Dit veld wordt automatisch berekend bij het genereren van een factuur.
      </div>
    `;
  }
}
