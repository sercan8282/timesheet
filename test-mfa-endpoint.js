const https = require('https');

// Test MFA setup endpoint
const testMfaSetup = async () => {
  // First login to get token
  const loginData = JSON.stringify({
    username: 'admin',
    password: 'Admin@123456'
  });

  return new Promise((resolve, reject) => {
    const loginReq = https.request({
      hostname: 'urenregistratie.site',
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n=== LOGIN RESPONSE ===');
        console.log('Status:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        console.log('Body:', data);
        
        try {
          const loginResponse = JSON.parse(data);
          const token = loginResponse.token;
          
          if (!token) {
            console.error('No token received');
            reject(new Error('No token'));
            return;
          }

          console.log('\n=== GOT TOKEN, TESTING /api/mfa/setup ===');
          
          // Now test MFA setup with token
          const setupReq = https.request({
            hostname: 'urenregistratie.site',
            path: '/api/mfa/setup',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            rejectUnauthorized: false
          }, (setupRes) => {
            let setupData = '';
            setupRes.on('data', chunk => setupData += chunk);
            setupRes.on('end', () => {
              console.log('\n=== MFA SETUP RESPONSE ===');
              console.log('Status:', setupRes.statusCode);
              console.log('Headers:', JSON.stringify(setupRes.headers, null, 2));
              console.log('Body:', setupData);
              resolve();
            });
          });

          setupReq.on('error', (err) => {
            console.error('Setup request error:', err);
            reject(err);
          });

          setupReq.end();
        } catch (err) {
          console.error('Error parsing login response:', err);
          reject(err);
        }
      });
    });

    loginReq.on('error', (err) => {
      console.error('Login request error:', err);
      reject(err);
    });

    loginReq.write(loginData);
    loginReq.end();
  });
};

testMfaSetup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
