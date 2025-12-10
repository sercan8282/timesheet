const ExcelJS = require("exceljs");

async function generateXLSX(timesheets, userName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Timesheet");

  const totals = timesheets.reduce(
    (acc, entry) => {
      const hours = parseFloat(entry.total_hours);
      const km = parseFloat(entry.total_km);

      acc.totalHours += Number.isFinite(hours) ? hours : 0;

      if (Number.isFinite(km)) {
        acc.totalKm += km;
      } else {
        const startKm = parseFloat(entry.start_km);
        const endKm = parseFloat(entry.end_km);
        if (Number.isFinite(startKm) && Number.isFinite(endKm)) {
          acc.totalKm += endKm - startKm;
        }
      }

      if (entry.week_number !== undefined && entry.week_number !== null) {
        acc.weeks.add(entry.week_number);
      }

      return acc;
    },
    { totalHours: 0, totalKm: 0, weeks: new Set() }
  );

  const totalHours = Number(totals.totalHours.toFixed(2));
  const totalKm = Number(totals.totalKm.toFixed(2));
  const weekNumbers = Array.from(totals.weeks)
    .sort((a, b) => a - b)
    .join(", ");

  // Define columns
  worksheet.columns = [
    { header: "Week Number", key: "weekNumber", width: 15 },
    { header: "Ritnumber", key: "ritnumber", width: 15 },
    { header: "Name", key: "name", width: 20 },
    { header: "Date", key: "date", width: 12 },
    { header: "Start Time", key: "startTime", width: 12 },
    { header: "End Time", key: "endTime", width: 12 },
    { header: "Start KM", key: "startKm", width: 12 },
    { header: "End KM", key: "endKm", width: 12 },
    { header: "Pause Time", key: "pauseTime", width: 12 },
    { header: "Total Hours", key: "totalHours", width: 12 },
    { header: "Total KM", key: "totalKm", width: 12 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0066CC" },
  };
  worksheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true };

  // Add data rows
  timesheets.forEach((timesheet) => {
    worksheet.addRow({
      weekNumber: timesheet.week_number,
      ritnumber: timesheet.ritnumber || "",
      name: userName,
      date: timesheet.date,
      startTime: timesheet.start_time,
      endTime: timesheet.end_time,
      startKm: timesheet.start_km,
      endKm: timesheet.end_km,
      pauseTime: timesheet.pause_time,
      totalHours: timesheet.total_hours,
      totalKm: timesheet.total_km,
    });
  });

  worksheet.addRow({});
  const totalsRow = worksheet.addRow({
    weekNumber: `Week(s): ${weekNumbers || "-"}`,
    name: "Totals",
    totalHours: totalHours,
    totalKm: totalKm,
  });

  totalsRow.font = { bold: true };
  totalsRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F0FF" },
    };
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    column.alignment = { vertical: "middle", horizontal: "left" };
  });

  // Return buffer
  return await workbook.xlsx.writeBuffer();
}

module.exports = { generateXLSX };
