const db = require("../config/database");

(async () => {
  try {
    const latest = await db.get(
      `SELECT id, template_id, invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1`
    );
    if (!latest) {
      console.error("No invoices");
      process.exit(1);
    }
    const elements = await db.all(
      `SELECT id, element_type, label, content, font_size, font_color, font_weight FROM invoice_template_elements WHERE template_id = ? ORDER BY position_order ASC`,
      [latest.template_id]
    );
    const sender = elements.find(
      (el) =>
        el.element_type === "sender" ||
        (el.element_type === "text" &&
          el.label &&
          /afzender|sender/i.test(el.label))
    );
    console.log("Invoice:", latest.invoice_number);
    console.log("Template elements count:", elements.length);
    if (sender) {
      console.log("Sender element found:", sender);
    } else {
      console.log(
        'No sender element detected. Ensure element type is "sender" or label contains "Afzender".'
      );
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
