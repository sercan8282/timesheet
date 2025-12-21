const db = require('./config/database');

db.get("SELECT id, username, mfa_enabled, mfa_secret FROM users WHERE username = 'admin'", (err, user) => {
  if (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
  
  console.log("\n=== ADMIN USER DATA ===");
  console.log(JSON.stringify(user, null, 2));
  
  if (user.mfa_enabled === null || user.mfa_enabled === undefined) {
    console.log("\n⚠️  mfa_enabled is NULL/undefined - column might not exist properly");
  } else if (user.mfa_enabled === 0 || user.mfa_enabled === false) {
    console.log("\n✓ MFA is disabled (0/false) - should allow /api/mfa/setup");
  } else {
    console.log("\n✓ MFA is enabled (1/true) - should NOT need setup");
  }
  
  process.exit(0);
});
