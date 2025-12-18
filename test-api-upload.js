const fs = require("fs");
const FormData = require("form-data");
const https = require("https");
const http = require("http");

const filePath =
  process.argv[2] ||
  "C:\\Users\\Administrator\\Downloads\\Factuur EU Transport week 45_2025-75.pdf";
const token = "test-token";
const url = "http://localhost:3000/api/invoices/import-pdf";

const form = new FormData();
form.append("file", fs.createReadStream(filePath));

const options = new URL(url);
options.method = "POST";
options.headers = {
  Authorization: `Bearer ${token}`,
  ...form.getHeaders(),
};

const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Response:", JSON.stringify(JSON.parse(data), null, 2));
  });
});

req.on("error", (e) => console.error("Error:", e));
form.pipe(req);
