require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { encryptPassword } = require("../utils/encryption");

// Wait for database to be ready
function waitForDatabase() {
  return new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });
}

async function initializeDatabase() {
  try {
    console.log("Initializing database...");

    // Wait for database initialization to complete
    await waitForDatabase();

    // Check if admin user exists
    const adminExists = await db.get("SELECT * FROM users WHERE username = ?", [
      process.env.ADMIN_USERNAME || "admin",
    ]);

    if (!adminExists) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || "Admin@123456",
        10
      );

      await db.run(
        "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
        [
          process.env.ADMIN_USERNAME || "admin",
          hashedPassword,
          "Administrator",
          "admin",
        ]
      );

      console.log("✓ Admin user created");
      console.log(`  Username: ${process.env.ADMIN_USERNAME || "admin"}`);
      console.log(
        `  Password: ${process.env.ADMIN_PASSWORD || "Admin@123456"}`
      );
      console.log("  PLEASE CHANGE THE PASSWORD AFTER FIRST LOGIN!");
    } else {
      console.log("✓ Admin user already exists");
    }

    // Check if SMTP settings exist
    const smtpExists = await db.get("SELECT * FROM smtp_settings LIMIT 1");

    if (!smtpExists) {
      // Create default SMTP settings from .env (encrypt password at rest)
      const encryptedPass = encryptPassword(process.env.SMTP_PASS || "");
      await db.run(
        `INSERT INTO smtp_settings (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_pass_encrypted, email_from, email_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          process.env.SMTP_HOST || "smtp.office365.com",
          parseInt(process.env.SMTP_PORT) || 587,
          process.env.SMTP_SECURE === "true" ? 1 : 0,
          process.env.SMTP_USER || "",
          "", // leave plaintext field empty
          encryptedPass || null,
          process.env.EMAIL_FROM || "",
          process.env.EMAIL_TO || "info@eutransport.nl",
        ]
      );

      console.log("✓ SMTP settings initialized (password encrypted)");
    } else {
      console.log("✓ SMTP settings already exist");
    }

    // Check if branding settings exist
    const brandingExists = await db.get(
      "SELECT * FROM branding_settings LIMIT 1"
    );

    if (!brandingExists) {
      // Create default branding settings
      await db.run(
        `INSERT INTO branding_settings (company_name, primary_color) VALUES (?, ?)`,
        ["Timesheet System", "#0066CC"]
      );

      console.log("✓ Branding settings initialized");
    } else {
      console.log("✓ Branding settings already exist");
    }

    console.log("\nDatabase initialization complete!");
    process.exit(0);
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
}

initializeDatabase();
