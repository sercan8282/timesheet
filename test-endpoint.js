const http = require('http');

console.log('Creating request...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/invoices/test-pdf',
  method: 'GET',
  timeout: 5000
};

console.log('Options:', JSON.stringify(options));

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    console.log(`Got ${chunk.length} bytes`);
    data += chunk;
  });
  res.on('end', () => {
    console.log('RESPONSE:');
    console.log(data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`ERROR CODE: ${e.code}`);
  console.error(`ERROR: ${e.message}`);
  console.error(`Stack: ${e.stack}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('REQUEST TIMEOUT');
  req.abort();
  process.exit(1);
});

console.log('Sending request...');
req.end();
console.log('Request queued');
