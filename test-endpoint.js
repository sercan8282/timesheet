// Test the /user/timesheets/details endpoint directly
const http = require('http');

// First, login to get token
const loginBody = JSON.stringify({ username: 'admin', password: 'admin' });

const loginOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginBody)
  }
};

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const loginResp = JSON.parse(data);
    const token = loginResp.token;
    console.log('Logged in, token:', token.substring(0, 20) + '...');
    
    // Now call /user/timesheets/details
    const body = JSON.stringify({ ids: [5, 6, 7, 8] });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/user/timesheets/details',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const response = JSON.parse(data);
        console.log(`\n=== /api/user/timesheets/details RESPONSE ===`);
        console.log(`Status: 200, Count: ${response.length}`);
        
        if (response.length > 0) {
          console.log('\nFirst timesheet:');
          console.log(JSON.stringify(response[0], null, 2));
          
          console.log('\n=== GROUPING SIMULATION ===');
          const groups = {};
          response.forEach(ts => {
            const key = `${ts.week_number}_${ts.user_id}`;
            if (!groups[key]) {
              groups[key] = { count: 0, totalHours: 0, totalKm: 0, user_name: ts.user_name };
            }
            groups[key].count++;
            groups[key].totalHours += ts.total_hours || 0;
            groups[key].totalKm += ts.total_km || 0;
          });
          
          Object.entries(groups).forEach(([key, group]) => {
            console.log(`Group ${key}: user="${group.user_name}", count=${group.count}, hours=${group.totalHours}, km=${group.totalKm}`);
          });
        }
        
        process.exit(0);
      });
    });
    
    req.on('error', console.error);
    req.write(body);
    req.end();
  });
});

loginReq.on('error', console.error);
loginReq.write(loginBody);
loginReq.end();
