const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const dirs = [
  path.resolve('public/uploads/invoices/imports'),
  path.resolve('public/uploads/invoices/pdfs'),
];
const needle = '202508023';

(async () => {
  let found = false;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.toLowerCase().endsWith('.pdf')) continue;
      const p = path.join(dir, file);
      try {
        const data = await pdfParse(fs.readFileSync(p));
        if ((data.text || '').includes(needle)) {
          console.log('FOUND', p);
          found = true;
        }
      } catch (err) {
        console.error('ERR', p, err.message);
      }
    }
  }
  if (!found) {
    console.error('NOT FOUND');
    process.exit(1);
  }
})();
