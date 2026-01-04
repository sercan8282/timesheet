const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testAutoDetect() {
  try {
    const pdfPath = 'C:\\Temp\\93039812509.pdf';
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNjc0MzIxNjAwLCJleHAiOjk5OTk5OTk5OTl9.test'; // dummy token
    
    console.log('Creating FormData...');
    const form = new FormData();
    
    const fileStream = fs.createReadStream(pdfPath);
    form.append('pdf', fileStream, {
      filename: '93039812509.pdf',
      contentType: 'application/pdf'
    });
    
    console.log('FormData created with file stream');
    console.log('Form headers:', form.getHeaders());
    
    console.log('\nSending request to http://localhost:3000/api/admin/invoices/import-templates/auto-detect');
    
    const response = await fetch('http://localhost:3000/api/admin/invoices/import-templates/auto-detect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✓ Auto-detect succeeded!');
      console.log('Extracted fields:', Object.keys(data.fields || {}));
      console.log('Missing fields:', data.summary?.missing_fields || []);
    } else {
      console.error('✗ Auto-detect failed');
      console.error('Error:', data.error);
    }
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAutoDetect();
