require("dotenv").config();
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const dbPath = path.join(__dirname, "..", "database.sqlite");
const backupDir = path.join(__dirname, "..", "backups");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function resetDatabase() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          DATABASE RESET - FRESH INSTALLATION               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log("⚠️  WAARSCHUWING: Dit verwijdert ALLE data uit de database!\n");
  console.log("Dit script doet het volgende:");
  console.log("  1. Maakt een backup van de huidige database");
  console.log("  2. Verwijdert database.sqlite");
  console.log("  3. Bij server start wordt een nieuwe lege database aangemaakt");
  console.log("  4. Run daarna 'npm run init-db' om admin account aan te maken\n");

  const answer = await question(
    "Weet je zeker dat je wilt doorgaan? (type 'JA' om te bevestigen): "
  );

  if (answer.toUpperCase() !== "JA") {
    console.log("\n❌ Reset geannuleerd.");
    rl.close();
    process.exit(0);
  }

  try {
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log("\n✓ Backup directory aangemaakt");
    }

    // Check if database exists
    if (fs.existsSync(dbPath)) {
      // Create backup with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .substring(0, 19);
      const backupPath = path.join(
        backupDir,
        `database-backup-${timestamp}.sqlite`
      );

      console.log("\n📦 Backup maken...");
      fs.copyFileSync(dbPath, backupPath);
      console.log(`✓ Backup opgeslagen: ${backupPath}`);

      // Delete current database
      console.log("\n🗑️  Database verwijderen...");
      fs.unlinkSync(dbPath);
      console.log("✓ database.sqlite verwijderd");
    } else {
      console.log("\n⚠️  database.sqlite bestaat niet (al verwijderd)");
    }

    // Also delete timesheet.db if it exists
    const oldDbPath = path.join(__dirname, "..", "timesheet.db");
    if (fs.existsSync(oldDbPath)) {
      fs.unlinkSync(oldDbPath);
      console.log("✓ timesheet.db verwijderd");
    }

    console.log("\n✅ Database succesvol gereset!");
    console.log("\n📋 Volgende stappen:");
    console.log("  1. Start de server: npm start");
    console.log("     (Dit maakt automatisch een nieuwe lege database aan)");
    console.log("  2. Stop de server (Ctrl+C)");
    console.log("  3. Initialiseer admin account: npm run init-db");
    console.log("  4. Start de server opnieuw: npm start");
    console.log("  5. Login met admin credentials uit .env bestand\n");

    console.log("💡 Tip: Check je .env bestand voor admin credentials:");
    console.log(`  ADMIN_USERNAME=${process.env.ADMIN_USERNAME || "admin"}`);
    console.log(
      `  ADMIN_PASSWORD=${process.env.ADMIN_PASSWORD || "Admin@123456"}\n`
    );

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error tijdens reset:", error.message);
    rl.close();
    process.exit(1);
  }
}

resetDatabase();
