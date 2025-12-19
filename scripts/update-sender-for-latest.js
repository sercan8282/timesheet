const db = require("../config/database");

const NEW_SENDER = `E&U TRANSPORT\nRIJNVALLEI 12\n6718 NV EDE`;

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
      `SELECT id, element_type, label FROM invoice_template_elements WHERE template_id = ? ORDER BY position_order ASC`,
      [latest.template_id]
    );
    const sender = elements.find(
      (el) =>
        el.element_type === "sender" ||
        (el.element_type === "text" &&
          el.label &&
          /afzender|sender/i.test(el.label))
    );
    if (!sender) {
      console.error("No sender element found");
      process.exit(1);
    }
    await db.run(
      `UPDATE invoice_template_elements SET content = ?, font_size = 12, font_color = '#000000', font_weight = 'normal', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [NEW_SENDER, sender.id]
    );
    console.log(
      "Updated sender element",
      sender.id,
      "for template",
      latest.template_id
    );
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
