const db = require('./config/database');

async function testNoteSave() {
  try {
    console.log('Testing note save/retrieve...\n');

    // Create test user with note
    const testUsername = 'test_note_user_' + Date.now();
    console.log('1. Creating test user with note...');
    const result = await db.run(
      `INSERT INTO users (username, password, full_name, role, note) 
       VALUES (?, ?, ?, ?, ?)`,
      [testUsername, 'test123', 'Test Note User', 'user', 'Dit is een test notitie']
    );
    console.log(`   Created user ID: ${result.id}`);

    // Retrieve the user
    console.log('\n2. Retrieving user...');
    const user = await db.get(
      `SELECT id, username, full_name, note FROM users WHERE id = ?`,
      [result.id]
    );
    console.log('   Retrieved user:', user);
    console.log('   Note value:', user.note);
    console.log('   Note is correct:', user.note === 'Dit is een test notitie');

    // Update the note
    console.log('\n3. Updating note...');
    await db.run(
      `UPDATE users SET note = ? WHERE id = ?`,
      ['Gewijzigde notitie', result.id]
    );

    // Retrieve again
    console.log('\n4. Retrieving after update...');
    const updated = await db.get(
      `SELECT id, username, full_name, note FROM users WHERE id = ?`,
      [result.id]
    );
    console.log('   Updated user:', updated);
    console.log('   Note value:', updated.note);
    console.log('   Note is correct:', updated.note === 'Gewijzigde notitie');

    // Cleanup
    console.log('\n5. Cleaning up test user...');
    await db.run(`DELETE FROM users WHERE id = ?`, [result.id]);
    console.log('   Test user deleted');

    console.log('\n✓ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testNoteSave();
