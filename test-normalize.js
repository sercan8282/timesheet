const normalize = (dateStr) => {
  if (!dateStr) return dateStr;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const ddMmMatch = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (ddMmMatch) {
    const [, day, month, year] = ddMmMatch;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return str;
};

console.log('Test 1 - DD-MM-YYYY:', normalize('04-01-2026'));
console.log('Test 2 - Already normalized:', normalize('2026-01-04'));
console.log('Test 3 - DD/MM/YYYY:', normalize('04/01/2026'));
console.log('Test 4 - Period calculation for "04-01-2026" if normalized:');
const testDate = normalize('04-01-2026');
console.log('  Normalized:', testDate);
const d = new Date(testDate);
const month = d.getMonth();
const quarter = Math.floor(month / 3) + 1;
console.log('  getMonth():', month, '-> Period:', quarter);

console.log('Test 5 - Period calculation for "2026-01-04":');
const d2 = new Date('2026-01-04');
const month2 = d2.getMonth();
const quarter2 = Math.floor(month2 / 3) + 1;
console.log('  getMonth():', month2, '-> Period:', quarter2);
