const PDFDocument = require("pdfkit");
const db = require("../config/database");

async function generatePlanningPDF(weekNumber) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Get planning data
      const schedules = await db.all(
        `SELECT 
          ps.*,
          u.full_name AS driver_name,
          u.phone AS driver_phone,
          u.adr AS driver_adr,
          u.mega_kast AS driver_mega_kast,
          u.note AS driver_note,
          COALESCE(v.license_plate, fv.license_plate) AS license_plate,
          c.name AS company_name
        FROM planning_schedules ps
        LEFT JOIN users u ON u.id = ps.driver_id
        LEFT JOIN vehicles v ON v.id = ps.vehicle_id
        LEFT JOIN fleet_vehicles fv ON fv.id = ps.vehicle_id
        LEFT JOIN companies c ON c.id = ps.company_id
        WHERE ps.week_number = ? AND ps.is_active = 1
        ORDER BY ps.company_id, ps.day_of_week, ps.route_number`,
        [weekNumber]
      );

      // Header
      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(`Weekplanning - Week ${weekNumber}`, {
          align: "center",
        });
      doc.moveDown(0.5);

      // Group by company and day
      const byCompany = {};
      for (const entry of schedules) {
        if (!byCompany[entry.company_id]) {
          byCompany[entry.company_id] = {
            name: entry.company_name,
            entries: [],
          };
        }
        byCompany[entry.company_id].entries.push(entry);
      }

      const days = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag"];

      // Table settings
      const tableTop = doc.y + 10;
      const colWidths = {
        company: 70,
        route: 50,
        plate: 50,
        driver: 85,
        adr: 35,
        truck: 60,
        phone: 70,
        day: 60,
        notes: 120,
      };

      const tableLeft = 30;

      // Draw table header
      doc.fontSize(9).font("Helvetica-Bold");
      let x = tableLeft;
      let y = tableTop;

      doc.rect(x, y, colWidths.company, 20).stroke();
      doc.text("Bedrijf", x + 5, y + 5, { width: colWidths.company - 10 });
      x += colWidths.company;

      doc.rect(x, y, colWidths.route, 20).stroke();
      doc.text("Route", x + 5, y + 5, { width: colWidths.route - 10 });
      x += colWidths.route;

      doc.rect(x, y, colWidths.plate, 20).stroke();
      doc.text("Kenteken", x + 5, y + 5, { width: colWidths.plate - 10 });
      x += colWidths.plate;

      doc.rect(x, y, colWidths.driver, 20).stroke();
      doc.text("Chauffeur", x + 5, y + 5, { width: colWidths.driver - 10 });
      x += colWidths.driver;

      doc.rect(x, y, colWidths.adr, 20).stroke();
      doc.text("ADR", x + 5, y + 5, { width: colWidths.adr - 10 });
      x += colWidths.adr;

      doc.rect(x, y, colWidths.truck, 20).stroke();
      doc.text("Truck Type", x + 5, y + 5, { width: colWidths.truck - 10 });
      x += colWidths.truck;

      doc.rect(x, y, colWidths.phone, 20).stroke();
      doc.text("Telefoon", x + 5, y + 5, { width: colWidths.phone - 10 });
      x += colWidths.phone;

      doc.rect(x, y, colWidths.day, 20).stroke();
      doc.text("Dag", x + 5, y + 5, { width: colWidths.day - 10 });
      x += colWidths.day;

      doc.rect(x, y, colWidths.notes, 20).stroke();
      doc.text("Notities", x + 5, y + 5, { width: colWidths.notes - 10 });

      y += 20;
      doc.font("Helvetica").fontSize(8);

      // Draw rows
      for (const companyId in byCompany) {
        const company = byCompany[companyId];
        const byDay = {};

        for (let day = 1; day <= 5; day++) {
          byDay[day] = company.entries.filter((e) => e.day_of_week === day);
        }

        for (let day = 1; day <= 5; day++) {
          const dayEntries = byDay[day];

          if (dayEntries.length === 0) continue;

          for (const entry of dayEntries) {
            // Check if we need a new page
            if (y > 500) {
              doc.addPage({
                size: "A4",
                layout: "landscape",
                margins: { top: 30, bottom: 30, left: 30, right: 30 },
              });
              y = 30;

              // Redraw header on new page
              doc.fontSize(9).font("Helvetica-Bold");
              let headerX = tableLeft;
              let headerY = y;

              doc.rect(headerX, headerY, colWidths.company, 20).stroke();
              doc.text("Bedrijf", headerX + 5, headerY + 5, {
                width: colWidths.company - 10,
              });
              headerX += colWidths.company;

              doc.rect(headerX, headerY, colWidths.route, 20).stroke();
              doc.text("Route", headerX + 5, headerY + 5, {
                width: colWidths.route - 10,
              });
              headerX += colWidths.route;

              doc.rect(headerX, headerY, colWidths.plate, 20).stroke();
              doc.text("Kenteken", headerX + 5, headerY + 5, {
                width: colWidths.plate - 10,
              });
              headerX += colWidths.plate;

              doc.rect(headerX, headerY, colWidths.driver, 20).stroke();
              doc.text("Chauffeur", headerX + 5, headerY + 5, {
                width: colWidths.driver - 10,
              });
              headerX += colWidths.driver;

              doc.rect(headerX, headerY, colWidths.adr, 20).stroke();
              doc.text("ADR", headerX + 5, headerY + 5, {
                width: colWidths.adr - 10,
              });
              headerX += colWidths.adr;

              doc.rect(headerX, headerY, colWidths.truck, 20).stroke();
              doc.text("Truck Type", headerX + 5, headerY + 5, {
                width: colWidths.truck - 10,
              });
              headerX += colWidths.truck;

              doc.rect(headerX, headerY, colWidths.phone, 20).stroke();
              doc.text("Telefoon", headerX + 5, headerY + 5, {
                width: colWidths.phone - 10,
              });
              headerX += colWidths.phone;

              doc.rect(headerX, headerY, colWidths.day, 20).stroke();
              doc.text("Dag", headerX + 5, headerY + 5, {
                width: colWidths.day - 10,
              });
              headerX += colWidths.day;

              doc.rect(headerX, headerY, colWidths.notes, 20).stroke();
              doc.text("Notities", headerX + 5, headerY + 5, {
                width: colWidths.notes - 10,
              });

              y += 20;
              doc.font("Helvetica").fontSize(8);
            }

            x = tableLeft;
            
            // Calculate row height based on combined planning and driver notes
            const notesParts = [];
            if (entry.notes) notesParts.push(entry.notes);
            if (entry.driver_note) notesParts.push(`(${entry.driver_note})`);
            const notesText = notesParts.join(" ") || "-";
            const notesHeight = doc.heightOfString(notesText, {
              width: colWidths.notes - 10,
            });
            const rowHeight = Math.max(18, notesHeight + 8);

            doc.rect(x, y, colWidths.company, rowHeight).stroke();
            doc.text(company.name || "-", x + 5, y + 4, {
              width: colWidths.company - 10,
            });
            x += colWidths.company;

            doc.rect(x, y, colWidths.route, rowHeight).stroke();
            doc.text(entry.route_number || "-", x + 5, y + 4, {
              width: colWidths.route - 10,
            });
            x += colWidths.route;

            doc.rect(x, y, colWidths.plate, rowHeight).stroke();
            doc.text(entry.license_plate || "-", x + 5, y + 4, {
              width: colWidths.plate - 10,
            });
            x += colWidths.plate;

            doc.rect(x, y, colWidths.driver, rowHeight).stroke();
            doc.text(entry.driver_name || "-", x + 5, y + 4, {
              width: colWidths.driver - 10,
            });
            x += colWidths.driver;

            doc.rect(x, y, colWidths.adr, rowHeight).stroke();
            doc.text(entry.driver_adr ? "Ja" : "Nee", x + 5, y + 4, {
              width: colWidths.adr - 10,
            });
            x += colWidths.adr;

            doc.rect(x, y, colWidths.truck, rowHeight).stroke();
            doc.text(
              entry.driver_mega_kast === "mega_and_kast"
                ? "Mega+Kast"
                : entry.driver_mega_kast === "nvt"
                ? "N.v.t."
                : "Mega",
              x + 5,
              y + 4,
              { width: colWidths.truck - 10 }
            );
            x += colWidths.truck;

            doc.rect(x, y, colWidths.phone, rowHeight).stroke();
            doc.text(entry.phone_number || "-", x + 5, y + 4, {
              width: colWidths.phone - 10,
            });
            x += colWidths.phone;

            doc.rect(x, y, colWidths.day, rowHeight).stroke();
            doc.text(days[day - 1], x + 5, y + 4, {
              width: colWidths.day - 10,
            });
            x += colWidths.day;

            doc.rect(x, y, colWidths.notes, rowHeight).stroke();
            doc.text(notesText, x + 5, y + 4, {
              width: colWidths.notes - 10,
            });

            y += rowHeight;
          }
        }
      }

      // Footer - PDFKit pages are 0-indexed internally
      const pageRange = doc.bufferedPageRange();
      const pageCount = pageRange.count;
      const startPage = pageRange.start;

      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(startPage + i);
        doc
          .fontSize(8)
          .text(
            `Pagina ${
              i + 1
            } van ${pageCount} - Gegenereerd op ${new Date().toLocaleString(
              "nl-NL"
            )}`,
            30,
            doc.page.height - 30,
            { align: "center" }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePlanningPDF };
