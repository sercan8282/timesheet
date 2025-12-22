require("dotenv").config();
const PDFDocument = require("pdfkit");
const { sendInvoiceEmail } = require("../utils/email");
const db = require("../config/database");

async function createTestPdfBuffer() {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const now = new Date();
      const id = Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, "0");

      // Header
      doc.fontSize(20).text("Testfactuur", { align: "left" });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Datum: ${now.toLocaleDateString()}`);
      doc.text(`Factuurnummer: TEST-${id}`);
      doc.moveDown(1);

      // Sender/Recipient placeholders
      doc.fontSize(12).text("Van:");
      doc.fontSize(10).text("Timesheet System");
      doc.text("info@example.com");
      doc.moveDown(0.5);
      doc.fontSize(12).text("Aan:");
      doc.fontSize(10).text("Testklant BV");
      doc.text("klant@example.com");
      doc.moveDown(1);

      // Table header
      doc.fontSize(12).text("Omschrijving", 40, doc.y);
      const yHeader = doc.y;
      doc.text("Aantal", 300, yHeader);
      doc.text("Prijs", 380, yHeader);
      doc.text("Totaal", 460, yHeader);
      doc.moveTo(40, yHeader + 14).lineTo(555, yHeader + 14).stroke();

      // Rows
      const rows = [
        { desc: "Uren – consultancy", qty: 2, price: 85 },
        { desc: "Kilometers", qty: 30, price: 0.35 },
      ];
      let sum = 0;
      rows.forEach((r) => {
        const total = r.qty * r.price;
        sum += total;
        doc.moveDown(0.6);
        const y = doc.y;
        doc.fontSize(10).text(r.desc, 40, y, { width: 240 });
        doc.text(r.qty.toFixed(2), 300, y, { width: 60, align: "right" });
        doc.text(`€ ${r.price.toFixed(2)}`, 380, y, { width: 60, align: "right" });
        doc.text(`€ ${total.toFixed(2)}`, 460, y, { width: 60, align: "right" });
      });

      doc.moveDown(1);
      doc.moveTo(350, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.4);
      doc.fontSize(11).text("Subtotaal:", 350, doc.y, { width: 100, align: "right" });
      doc.text(`€ ${sum.toFixed(2)}`, 460, doc.y, { width: 60, align: "right" });

      const vat = sum * 0.21;
      const totalIncl = sum + vat;
      doc.moveDown(0.3);
      doc.fontSize(11).text("BTW (21%):", 350, doc.y, { width: 100, align: "right" });
      doc.text(`€ ${vat.toFixed(2)}`, 460, doc.y, { width: 60, align: "right" });
      doc.moveDown(0.3);
      doc.fontSize(12).text("Totaal:", 350, doc.y, { width: 100, align: "right" });
      doc.text(`€ ${totalIncl.toFixed(2)}`, 460, doc.y, { width: 60, align: "right" });

      // Footer
      doc.moveDown(2);
      doc.fontSize(9).fillColor("#555").text("Dit is een testfactuur voor verificatie van e-mail handtekening en bijlage.");

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function main() {
  try {
    const settings = await db.get("SELECT * FROM smtp_settings LIMIT 1");
    if (!settings) {
      throw new Error("SMTP settings not configured. Vul eerst SMTP in bij Admin → SMTP.");
    }

    const to = settings.email_to || settings.email_from;
    if (!to) {
      throw new Error("Geen ontvanger gevonden. Stel 'email_to' of 'email_from' in bij SMTP settings.");
    }

    const pdfBuffer = await createTestPdfBuffer();
    const filename = `testfactuur-${new Date().toISOString().slice(0,10)}.pdf`;

    const subject = "Testfactuur – Timesheet System";
    const textBody = [
      "Beste,",
      "",
      "In de bijlage vindt u een testfactuur.",
      "Deze e-mail is verzonden om de SMTP-instellingen en handtekening te verifiëren.",
      "",
      "Met vriendelijke groet",
    ].join("\n");

    await sendInvoiceEmail({
      to,
      subject,
      text: textBody,
      html: textBody.replace(/\n/g, "<br>"),
      attachments: [
        { filename, content: pdfBuffer },
      ],
    });

    console.log(`✓ Testfactuur verzonden naar ${to}`);
    process.exit(0);
  } catch (err) {
    console.error("✗ Verzenden mislukt:", err.message);
    process.exit(1);
  }
}

main();
