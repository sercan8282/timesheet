const db = require("./config/database");

db.get("SELECT company_name, tagline FROM branding_settings LIMIT 1")
  .then((row) => {
    console.log("Branding settings:");
    console.log("Company name:", row?.company_name || "Not set");
    console.log("Tagline:", row?.tagline || "Not set");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
