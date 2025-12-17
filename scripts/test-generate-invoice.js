const http = require("http");

function request(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data ? Buffer.byteLength(data) : 0,
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (d) => (chunks += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(chunks));
          } catch (e) {
            resolve(chunks);
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    const invoices = await request("/api/admin/invoices/invoices");
    if (!Array.isArray(invoices) || invoices.length === 0) {
      console.error("No invoices found");
      process.exit(1);
    }
    const latest = invoices[0];
    console.log("Using invoice:", latest.id, latest.invoice_number);
    const gen = await request(
      `/api/admin/invoices/invoices/${latest.id}/generate-pdf`,
      "POST"
    );
    console.log("Generated:", gen);
    process.exit(0);
  } catch (e) {
    console.error("Error:", e.message || e);
    process.exit(1);
  }
})();
