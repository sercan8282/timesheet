const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.sqlite");

const translations = [
  // Dutch
  { namespace: "ui", key: "leave.type_vacation", locale: "nl", text: "Verlof" },
  { namespace: "ui", key: "leave.type_overtime", locale: "nl", text: "Overuren" },
  { namespace: "ui", key: "leave.hours_unit", locale: "nl", text: "uur" },
  
  // English
  { namespace: "ui", key: "leave.type_vacation", locale: "en", text: "Vacation" },
  { namespace: "ui", key: "leave.type_overtime", locale: "en", text: "Overtime" },
  { namespace: "ui", key: "leave.hours_unit", locale: "en", text: "hours" },
  
  // German
  { namespace: "ui", key: "leave.type_vacation", locale: "de", text: "Urlaub" },
  { namespace: "ui", key: "leave.type_overtime", locale: "de", text: "Überstunden" },
  { namespace: "ui", key: "leave.hours_unit", locale: "de", text: "Stunden" },
];

db.serialize(() => {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)`
  );

  translations.forEach((t) => {
    stmt.run(t.namespace, t.key, t.locale, t.text);
    console.log(`✓ ${t.namespace}:${t.key} [${t.locale}] = ${t.text}`);
  });

  stmt.finalize();
  
  console.log("\n✓ Leave translations added successfully!");
  db.close();
});
