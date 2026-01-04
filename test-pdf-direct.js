const fs = require('fs');
const pdfParse = require('pdf-parse');

async function testPdf() {
  try {
    const pdfPath = 'C:\\Temp\\93039812509.pdf';
    console.log('Testing PDF:', pdfPath);
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      console.error('ERROR: File not found:', pdfPath);
      process.exit(1);
    }
    
    const stats = fs.statSync(pdfPath);
    console.log('File size:', stats.size, 'bytes');
    console.log('File is readable:', fs.accessSync(pdfPath, fs.constants.R_OK) === undefined);
    
    // Read file
    console.log('\nReading file...');
    const fileBuffer = fs.readFileSync(pdfPath);
    console.log('Buffer size:', fileBuffer.length, 'bytes');
    console.log('Buffer starts with PDF header:', fileBuffer.toString('utf8', 0, 4) === '%PDF');
    
    // Parse PDF
    console.log('\nParsing PDF with pdfParse...');
    const parsed = await pdfParse(fileBuffer);
    
    console.log('✓ PDF parsed successfully!');
    console.log('  Pages:', parsed.numpages);
    console.log('  Text length:', (parsed.text || '').length);
    console.log('  Text preview:', (parsed.text || '').substring(0, 200));
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testPdf();
