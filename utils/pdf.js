const PDFDocument = require('pdfkit');
const db = require('../config/database');
const path = require('path');
const fs = require('fs');

async function generatePDF(timesheets, userName) {
  // Get branding settings
  let branding = { company_name: 'Timesheet System', primary_color: '#0066CC', logo_path: null };
  try {
    const settings = await db.get('SELECT * FROM branding_settings LIMIT 1');
    if (settings) {
      branding = settings;
    }
  } catch (error) {
    console.log('Using default branding for PDF');
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        layout: 'landscape'
      });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Add logo if available
      if (branding.logo_path) {
        const logoPath = path.join(__dirname, '../public', branding.logo_path);
        if (fs.existsSync(logoPath)) {
          try {
            doc.image(logoPath, 40, 30, { height: 40 });
            doc.moveDown(3);
          } catch (err) {
            console.log('Could not load logo for PDF:', err);
          }
        }
      }

      // Title
      const primaryColor = branding.primary_color || '#0066CC';
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 102, b: 204 };
      };
      const rgb = hexToRgb(primaryColor);
      
      doc.fontSize(18).fillColor(rgb.r, rgb.g, rgb.b).text('Timesheet Report', { align: 'center' });
      doc.moveDown(0.5);

      // User info
      doc.fontSize(10).fillColor('#000000').text(`Employee: ${userName}`, { align: 'left' });
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, { align: 'left' });
      if (branding.company_name !== 'Timesheet System') {
        doc.text(`Company: ${branding.company_name}`, { align: 'left' });
      }
      doc.moveDown(0.5);

      // Calculate available width for table (landscape: ~750 pixels after margins)
      const pageWidth = doc.page.width - 80; // 40px margins on each side
      const tableTop = doc.y;
      
      // Optimize column widths for landscape layout
      const colWidths = {
        weekNumber: 45,
        name: 70,
        date: 65,
        startTime: 55,
        endTime: 55,
        startKm: 50,
        endKm: 50,
        pauseTime: 55,
        totalHours: 55,
        totalKm: 45,
        ritnumber: 50
      };

      const totalColWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);
      let xPos = 40;

      // Header background (use branding color)
      doc.rect(40, tableTop, totalColWidth + 20, 20).fillAndStroke(rgb.r, rgb.g, rgb.b, rgb.r, rgb.g, rgb.b);

      // Header text
      doc.fillColor('#FFFFFF').fontSize(8);
      
      const headers = [
        { text: 'Week', width: colWidths.weekNumber },
        { text: 'Ritnumber', width: colWidths.ritnumber },
        { text: 'Name', width: colWidths.name },
        { text: 'Date', width: colWidths.date },
        { text: 'Start', width: colWidths.startTime },
        { text: 'End', width: colWidths.endTime },
        { text: 'Start KM', width: colWidths.startKm },
        { text: 'End KM', width: colWidths.endKm },
        { text: 'Pause', width: colWidths.pauseTime },
        { text: 'Hours', width: colWidths.totalHours },
        { text: 'KM', width: colWidths.totalKm }
      ];

      xPos = 40;
      headers.forEach(header => {
        doc.text(header.text, xPos + 3, tableTop + 5, { width: header.width - 6, align: 'center', fontSize: 8 });
        xPos += header.width;
      });

      let yPos = tableTop + 22;
      const pageHeight = doc.page.height;
      const footerSpace = 40;
      const maxYPos = pageHeight - footerSpace;

      // Data rows
      doc.fillColor('#000000').fontSize(7);

      timesheets.forEach((timesheet, index) => {
        // Check if we need a new page (leaving room for footer)
        if (yPos > maxYPos) {
          doc.addPage();
          yPos = 40;
        }

        // Alternating row colors
        if (index % 2 === 0) {
          doc.rect(40, yPos, totalColWidth + 20, 16).fillAndStroke('#F5F5F5', '#D0D0D0');
        } else {
          doc.rect(40, yPos, totalColWidth + 20, 16).stroke('#D0D0D0');
        }

        xPos = 40;
        const rowData = [
          { text: timesheet.week_number.toString(), width: colWidths.weekNumber },
          { text: (timesheet.ritnumber || '-').toString(), width: colWidths.ritnumber },
          { text: userName, width: colWidths.name },
          { text: timesheet.date, width: colWidths.date },
          { text: timesheet.start_time, width: colWidths.startTime },
          { text: timesheet.end_time, width: colWidths.endTime },
          { text: timesheet.start_km.toFixed(2), width: colWidths.startKm },
          { text: timesheet.end_km.toFixed(2), width: colWidths.endKm },
          { text: timesheet.pause_time, width: colWidths.pauseTime },
          { text: timesheet.total_hours.toFixed(2), width: colWidths.totalHours },
          { text: timesheet.total_km.toFixed(2), width: colWidths.totalKm }
        ];

        doc.fillColor('#000000');
        rowData.forEach(cell => {
          doc.text(cell.text, xPos + 3, yPos + 2, { width: cell.width - 6, align: 'center', fontSize: 7 });
          xPos += cell.width;
        });

        yPos += 16;
      });

      // Add footer on the same page if there's space, otherwise on last page
      const footerY = Math.max(yPos + 10, pageHeight - 30);
      doc.fontSize(7).fillColor('#999999').text(
        `Generated on ${new Date().toLocaleString()}`,
        40,
        footerY,
        { align: 'center', width: pageWidth }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePDF };
