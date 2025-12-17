const db = require("../config/database");

const DEFAULT_VACATION_HOURS = 27 * 8; // 27 days × 8 hours = 216 hours

async function addDefaultVacation() {
  try {
    console.log("Adding default vacation hours to users...");

    // Get all users
    const users = await db.all("SELECT id FROM users");
    let updated = 0;
    let created = 0;

    for (const user of users) {
      // Check if user has leave balance
      const balance = await db.get(
        "SELECT id, vacation_hours FROM leave_balances WHERE user_id = ?",
        [user.id]
      );

      if (!balance) {
        // Create new leave balance with default vacation hours
        await db.run(
          "INSERT INTO leave_balances (user_id, vacation_hours, overtime_hours) VALUES (?, ?, 0)",
          [user.id, DEFAULT_VACATION_HOURS]
        );
        created++;
      } else if (
        balance.vacation_hours === 0 ||
        balance.vacation_hours === null
      ) {
        // Update vacation hours if they are 0 or null
        await db.run(
          "UPDATE leave_balances SET vacation_hours = ? WHERE user_id = ?",
          [DEFAULT_VACATION_HOURS, user.id]
        );
        updated++;
      }
    }

    console.log(`✓ Created ${created} new leave balance records`);
    console.log(`✓ Updated ${updated} existing leave balance records`);
    console.log(
      `✓ Set all users to ${DEFAULT_VACATION_HOURS} vacation hours (${
        DEFAULT_VACATION_HOURS / 8
      } days)`
    );
    process.exit(0);
  } catch (error) {
    console.error("Error adding default vacation hours:", error.message);
    process.exit(1);
  }
}

addDefaultVacation();
