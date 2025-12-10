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
        margin: 50,
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
            doc.image(logoPath, 50, 40, { height: 40 });
            doc.moveDown(1);
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
      
      doc.fontSize(16).fillColor(rgb.r, rgb.g, rgb.b).text('Timesheet Report', { align: 'center' });
      doc.moveDown(0.5);

      // User info
      doc.fontSize(10).fillColor('#000000').text(`Employee: ${userName}`, { align: 'left' });
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, { align: 'left' });
      if (branding.company_name !== 'Timesheet System') {
        doc.text(`Company: ${branding.company_name}`, { align: 'left' });
      }
      doc.moveDown(0.3);

      // Table headers
      const tableTop = doc.y;
      const colWidths = {
        weekNumber: 60,
        name: 100,
        date: 80,
        startTime: 70,
        endTime: 70,
        startKm: 65,
        endKm: 65,
        pauseTime: 70,
        totalHours: 70,
        totalKm: 60
      };

      let xPos = 50;

      // Calculate total width
      const totalWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);

      // Header background (use branding color)
      doc.rect(50, tableTop, totalWidth, 18).fillAndStroke(rgb.r, rgb.g, rgb.b, rgb.r, rgb.g, rgb.b);

      // Header text
      doc.fillColor('#FFFFFF').fontSize(9);
      
      const headers = [
        { text: 'Week', width: colWidths.weekNumber },
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

      xPos = 50;
      headers.forEach(header => {
        doc.text(header.text, xPos + 2, tableTop + 4, { width: header.width, align: 'left' });
        xPos += header.width;
      });

      doc.moveDown();
      let yPos = tableTop + 22;

      // Data rows
      doc.fillColor('#000000').fontSize(8);

      timesheets.forEach((timesheet, index) => {
        if (yPos > 505) {
          doc.addPage();
          yPos = 50;
        }

        // Alternating row colors
        if (index % 2 === 0) {
          doc.rect(50, yPos, totalWidth, 15).fillAndStroke('#F0F0F0', '#E0E0E0');
        } else {
          doc.rect(50, yPos, totalWidth, 15).stroke('#E0E0E0');
        }

        xPos = 50;
        const rowData = [
          { text: timesheet.week_number.toString(), width: colWidths.weekNumber },
          { text: userName, width: colWidths.name },
          { text: timesheet.date, width: colWidths.date },
          { text: timesheet.start_time, width: colWidths.startTime },
          { text: timesheet.end_time, width: colWidths.endTime },
          { text: timesheet.start_km.toString(), width: colWidths.startKm },
          { text: timesheet.end_km.toString(), width: colWidths.endKm },
          { text: timesheet.pause_time, width: colWidths.pauseTime },
          { text: timesheet.total_hours.toString(), width: colWidths.totalHours },
          { text: timesheet.total_km.toString(), width: colWidths.totalKm }
        ];

        doc.fillColor('#000000');
        rowData.forEach(cell => {
          doc.text(cell.text, xPos + 2, yPos + 3, { width: cell.width, align: 'left' });
          xPos += cell.width;
        });

        yPos += 15;
      });

      // Footer - only add if there's space on current page
      if (yPos < 530) {
        doc.fontSize(8).fillColor('#666666').text(
          `Generated on ${new Date().toLocaleString()}`,
          50,
          530,
          { align: 'center' }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePDF };
