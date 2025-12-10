const ExcelJS = require('exceljs');

async function generateXLSX(timesheets, userName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Timesheet');

  // Define columns
  worksheet.columns = [
    { header: 'Week Number', key: 'weekNumber', width: 15 },
    { header: 'Ritnumber', key: 'ritnumber', width: 15 },
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Start Time', key: 'startTime', width: 12 },
    { header: 'End Time', key: 'endTime', width: 12 },
    { header: 'Start KM', key: 'startKm', width: 12 },
    { header: 'End KM', key: 'endKm', width: 12 },
    { header: 'Pause Time', key: 'pauseTime', width: 12 },
    { header: 'Total Hours', key: 'totalHours', width: 12 },
    { header: 'Total KM', key: 'totalKm', width: 12 }
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0066CC' }
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Add data rows
  timesheets.forEach(timesheet => {
    worksheet.addRow({
      weekNumber: timesheet.week_number,
      ritnumber: timesheet.ritnumber || '',
      name: userName,
      date: timesheet.date,
      startTime: timesheet.start_time,
      endTime: timesheet.end_time,
      startKm: timesheet.start_km,
      endKm: timesheet.end_km,
      pauseTime: timesheet.pause_time,
      totalHours: timesheet.total_hours,
      totalKm: timesheet.total_km
    });
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // Return buffer
  return await workbook.xlsx.writeBuffer();
}

module.exports = { generateXLSX };
