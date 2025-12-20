const db = require('./config/database');

async function testUserNote() {
  try {
    console.log('Testing user note functionality...\n');

    // Check if note column exists
    const columns = await db.all('PRAGMA table_info(users)');
    const noteColumn = columns.find(c => c.name === 'note');
    console.log('Note column exists:', !!noteColumn);
    if (noteColumn) {
      console.log('Note column info:', noteColumn);
    }

    // Get all users with their notes
    const users = await db.all(`
      SELECT id, username, full_name, note 
      FROM users 
      ORDER BY id
    `);

    console.log('\nUsers with notes:');
    users.forEach(u => {
      console.log(`  [${u.id}] ${u.full_name} (${u.username}): ${u.note || '(no note)'}`);
    });

    // Test planning query with driver notes
    console.log('\nTesting planning query with driver notes...');
    const planning = await db.all(`
      SELECT 
        ps.*,
        u.full_name AS driver_name,
        u.note AS driver_note
      FROM planning_schedules ps
      LEFT JOIN users u ON u.id = ps.driver_id
      WHERE ps.is_active = 1
      LIMIT 5
    `);

    console.log('Planning entries with driver notes:');
    planning.forEach(p => {
      console.log(`  Week ${p.week_number} Day ${p.day_of_week}: ${p.driver_name}`);
      console.log(`    Planning note: ${p.notes || '(none)'}`);
      console.log(`    Driver note: ${p.driver_note || '(none)'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testUserNote();
