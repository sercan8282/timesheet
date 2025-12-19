const db = require("../config/database");

async function getLocalizedMenu(locale) {
  return new Promise((resolve, reject) => {
    db.db.all(
      "SELECT page_key, label, sort_order, visible FROM ui_menu ORDER BY sort_order ASC",
      [],
      (err, rows) => {
        if (err) return reject(err);
        const keys = rows.map((r) => r.page_key);
        if (keys.length === 0) return resolve(rows);
        const placeholders = keys.map(() => "?").join(",");
        db.db.all(
          `SELECT key, text FROM translations WHERE namespace = 'menu' AND locale = ? AND key IN (${placeholders})`,
          [locale, ...keys],
          (err2, trows) => {
            if (err2) return reject(err2);
            const map = {};
            (trows || []).forEach((t) => (map[t.key] = t.text));
            const localized = rows.map((r) => ({
              page_key: r.page_key,
              label: map[r.page_key] || r.label,
              sort_order: r.sort_order,
              visible: r.visible,
            }));
            resolve(localized);
          }
        );
      }
    );
  });
}

(async () => {
  try {
    console.log("NL MENU");
    console.log(await getLocalizedMenu("nl"));
    console.log("\nEN MENU");
    console.log(await getLocalizedMenu("en"));
    // Now apply an update to 'dashboard' nl
    await new Promise((res, rej) =>
      db.db.run(
        "UPDATE translations SET text = 'Startpagina' WHERE namespace='menu' AND key='dashboard' AND locale='nl'",
        [],
        (e) => (e ? rej(e) : res())
      )
    );
    console.log("\nNL MENU AFTER UPDATE");
    console.log(await getLocalizedMenu("nl"));
    process.exit(0);
  } catch (err) {
    console.error("Error", err);
    process.exit(1);
  }
})();
