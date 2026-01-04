const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET',
  timeout: 5000
};

console.log('Testing root endpoint...');

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk.length;
  });
  res.on('end', () => {
    console.log(`Got ${data} bytes of data`);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.code} - ${e.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('TIMEOUT');
  req.abort();
  process.exit(1);
});

req.end();
