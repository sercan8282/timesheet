const db = require('./config/database');

const translations = [
  ['ui', 'invoice.number_and_date_required', 'en', 'Invoice number and date are required'],
  ['ui', 'invoice.number_and_date_required', 'nl', 'Factuurnummer en datum zijn verplicht'],
  ['ui', 'invoice.number_and_date_required', 'de', 'Rechnungsnummer und Datum erforderlich'],
];

setTimeout(() => {
  let count = 0;
  
  translations.forEach((trans) => {
    db.run(
      `INSERT OR REPLACE INTO translations (namespace, key, locale, text) 
       VALUES (?, ?, ?, ?)`,
      [...trans],
      (err) => {
        if (err) {
          console.error(`Error inserting ${trans[1]} (${trans[2]}):`, err);
        } else {
          console.log(`✓ Added translation: ${trans[1]} (${trans[2]})`);
        }
        
        count++;
        if (count === translations.length) {
          console.log('\n✓ All translations added successfully!');
          process.exit(0);
        }
      }
    );
  });
}, 100);
