const db = require("./config/database");

(async () => {
  try {
    const companies = await db.all(
      "SELECT id, name, pause_time FROM companies"
    );
    console.log("Companies found:", companies.length);
    console.log(companies);
  } catch (error) {
    console.error("Error:", error);
  }
})();
