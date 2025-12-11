const jwt = require('jsonwebtoken');
const http = require('http');

// Create a test JWT token for admin user
const token = jwt.sign(
  { id: 1, username: 'admin', role: 'admin' },
  'your-secret-key',
  { expiresIn: '1h' }
);

console.log('Testing /admin/companies endpoint...');
console.log('Token:', token.substring(0, 20) + '...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/admin/companies',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.error('Full error:', error);
});

req.end();

setTimeout(() => {
  console.log('Test complete');
  process.exit(0);
}, 2000);
