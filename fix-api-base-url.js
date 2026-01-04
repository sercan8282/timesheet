const fs = require('fs');
const filePath = 'public/js/api.js';

let content = fs.readFileSync(filePath, 'utf8');
const matches = (content.match(/\$\{API_BASE_URL\}/g) || []);
console.log(`Found ${matches.length} instances of \$\{API_BASE_URL\}`);

content = content.replace(/\$\{API_BASE_URL\}/g, '${this._getBaseUrl()}');

fs.writeFileSync(filePath, content);
console.log(`Replaced ${matches.length} instances with \$\{this._getBaseUrl()\}`);
