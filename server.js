require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const submissionRoutes = require("./routes/submission");
const companyRoutes = require("./routes/company");
const vehicleRoutes = require("./routes/vehicles");
const planningRoutes = require("./routes/planning");
const mfaRoutes = require("./routes/mfa");
const uiRoutes = require("./routes/ui");
const translateRoutes = require("./routes/translate");
const db = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the reverse proxy (e.g., Nginx) for X-Forwarded-* headers
// This is required for correct client IP detection and for express-rate-limit v7
// When running behind a single proxy like Nginx on the same host, use 1 hop.
app.set("trust proxy", 1);

// PDF Preview route - FIRST, BEFORE ALL MIDDLEWARE
app.get("/api/invoices/template/:id/preview-pdf", async (req, res) => {
  console.log("PDF Preview route HIT! Template ID:", req.params.id);
  try {
    const templateId = req.params.id;

    // Fetch template
    const template = await db.get(
      "SELECT * FROM invoice_templates WHERE id = ?",
      [templateId]
    );

    if (!template) {
      console.log("Template not found:", templateId);
      return res.status(404).send("Template niet gevonden");
    }

    console.log("Template found:", template.name);

    // Fetch template elements
    const templateElements = await db.all(
      "SELECT * FROM invoice_template_elements WHERE template_id = ? ORDER BY position_order ASC",
      [templateId]
    );

    // Import PDFDocument
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    // Helper functions
    const availableWidth = doc.page.width - 100;
    const colWidth = availableWidth / 3;
    const colX = [50, 50 + colWidth, 50 + colWidth * 2];

    const cleanContent = (text) =>
      (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();

    const renderTextBlock = (el, x, y, width) => {
      const content = cleanContent(el.content);
      const fontName =
        el.font_weight === "bold" ? "Helvetica-Bold" : "Helvetica";
      const textAlignH = el.text_align_h || "left";
      doc
        .font(fontName)
        .fontSize(parseInt(el.font_size) || 12)
        .fillColor(el.font_color || "#000000")
        .text(content, x, y, { width: width - 10, align: textAlignH });
      const textHeight = doc.heightOfString(content, { width: width - 10 });
      return y + textHeight + 10;
    };

    const renderImageBlock = (el, x, y, width) => {
      const relPath = (el.image_path || "").replace(/^\/+/, "");
      const imagePath = path.join(__dirname, "public", relPath);
      if (el.image_path && fs.existsSync(imagePath)) {
        try {
          const imgWidth = Math.min(width - 10, parseInt(el.image_width, 10) || 150);
          const imgHeight = parseInt(el.image_height, 10) || 0;
          const options = { width: imgWidth };
          if (imgHeight > 0) {
            options.height = imgHeight;
          }
          doc.image(imagePath, x, y, options);
          // Calculate actual height used
          const actualHeight = imgHeight > 0 ? imgHeight : imgWidth; // Approximate if auto
          return y + actualHeight + 10;
        } catch (err) {
          console.error("Error adding preview image:", err);
        }
      }
      return y;
    };

    const renderColumn = (elements, x, yStart) => {
      let y = yStart;
      for (const el of elements) {
        if (el.image_path) {
          y = renderImageBlock(el, x, y, colWidth);
        } else if (el.content) {
          y = renderTextBlock(el, x, y, colWidth);
        }
      }
      return y;
    };

    // Estimate column height to anchor footer at the bottom for print alignment
    const measureColumnHeight = (elements) => {
      let height = 0;
      elements.forEach((el) => {
        if (el.image_path) {
          const imgWidth = Math.min(colWidth - 10, parseInt(el.image_width, 10) || 150);
          const imgHeight = parseInt(el.image_height, 10) || imgWidth;
          height += imgHeight + 10;
        } else if (el.content) {
          const content = cleanContent(el.content);
          const fontName = el.font_weight === "bold" ? "Helvetica-Bold" : "Helvetica";
          const fontSize = parseInt(el.font_size, 10) || 12;
          doc.font(fontName).fontSize(fontSize);
          const h = doc.heightOfString(content, { width: colWidth - 10 });
          height += h + 10;
        }
      });
      return height;
    };

    // Render header
    doc.fontSize(16).text("TEMPLATE PREVIEW", 50, 50);
    doc
      .fontSize(10)
      .fillColor("#666")
      .text(`Template: ${template.name}`, 50, 70);

    // Group elements by layout type
    const topCols = [[], [], []];
    const addrCols = [[], [], []];
    const footerCols = [[], [], []];

    templateElements.forEach((el) => {
      if (el.element_type === "title") return; // skip title elements in preview
      if (el.element_type === "top_left") topCols[0].push(el);
      else if (el.element_type === "top_center") topCols[1].push(el);
      else if (el.element_type === "top_right") topCols[2].push(el);
      else if (el.element_type === "address_left") addrCols[0].push(el);
      else if (el.element_type === "address_center") addrCols[1].push(el);
      else if (el.element_type === "address_right") addrCols[2].push(el);
      else if (el.element_type === "footer_left") footerCols[0].push(el);
      else if (el.element_type === "footer_center") footerCols[1].push(el);
      else if (el.element_type === "footer_right") footerCols[2].push(el);
    });

    // Render top columns preview
    let yPos = 120;
    doc
      .fontSize(10)
      .fillColor("#000")
      .text("Bovenste Sectie (Top Section):", 50, yPos);
    yPos += 20;

    const topY = [yPos, yPos, yPos];
    topY[0] = renderColumn(topCols[0], colX[0], topY[0]);
    topY[1] = renderColumn(topCols[1], colX[1], topY[1]);
    topY[2] = renderColumn(topCols[2], colX[2], topY[2]);
    yPos = Math.max(...topY) + 30;

    // Render address columns preview
    doc
      .fontSize(10)
      .fillColor("#000")
      .text("Adres Sectie (Address Section):", 50, yPos);
    yPos += 20;

    const addrY = [yPos, yPos, yPos];
    addrY[0] = renderColumn(addrCols[0], colX[0], addrY[0]);
    addrY[1] = renderColumn(addrCols[1], colX[1], addrY[1]);
    addrY[2] = renderColumn(addrCols[2], colX[2], addrY[2]);
    yPos = Math.max(...addrY) + 30;

    // Render footer section (3-column only) anchored near page bottom
    const hasFooterColumns = footerCols[0].length > 0 || footerCols[1].length > 0 || footerCols[2].length > 0;

    if (hasFooterColumns) {
      const bottomMargin = 50;
      const footerHeights = footerCols.map((col) => measureColumnHeight(col));
      const footerHeight = Math.max(...footerHeights, 0);
      const targetFooterY = doc.page.height - bottomMargin - footerHeight;

      if (yPos > targetFooterY) {
        doc.addPage();
        yPos = 50;
      }

      const startY = Math.max(yPos + 20, targetFooterY);
      const footerY = [startY, startY, startY];
      footerY[0] = renderColumn(footerCols[0], colX[0], footerY[0]);
      footerY[1] = renderColumn(footerCols[1], colX[1], footerY[1]);
      footerY[2] = renderColumn(footerCols[2], colX[2], footerY[2]);
      yPos = Math.max(...footerY);
    }

    // Send PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="template-preview.pdf"`
    );
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Error generating template preview:", error);
    res.status(500).send("Fout bij genereren preview: " + error.message);
  }
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "'unsafe-inline'", // Needed for inline event handlers and Bootstrap
        ],
        scriptSrcAttr: [
          "'self'",
          "'unsafe-inline'", // Needed for inline event handlers like onclick
        ],
        styleSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "'unsafe-inline'", // Needed for inline styles
        ],
        fontSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "data:",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
        ],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for CDN resources
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Rate limiting - verhoogd voor normale gebruik
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minuten
  max: 1000, // 1000 requests per 5 minuten per IP
  message: { error: "Te veel verzoeken, probeer het over een minuut opnieuw." },
  skip: (req, res) => {
    // Skip rate limiting for static files and certain endpoints
    if (
      req.method === "GET" &&
      req.path.match(/\.(js|css|html|png|jpg|gif|svg|woff|woff2)$/)
    ) {
      return true;
    }
    return false;
  },
  // Store: Consider using Redis for production
  // standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  // legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

app.use("/api/", limiter);

// CORS - Allow Capacitor mobile app origins
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://urenregistratie.site',
    'capacitor://localhost',
    'http://localhost',
    'ionic://localhost'
  ],
  credentials: true
};
app.use(cors(corsOptions));

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Disable caching for all static files (especially JS files)
app.use((req, res, next) => {
  if (req.url.match(/\.(js|css|html)$/)) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/mfa", mfaRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/submission", submissionRoutes);
app.use("/api/admin/companies", companyRoutes);
app.use("/api/admin/vehicles", vehicleRoutes);
app.use("/api/admin/planning", planningRoutes);
app.use("/api/translate", translateRoutes);

// Invoice routes
const invoiceRoutes = require("./routes/invoice");
app.use("/api/admin/invoices", invoiceRoutes);
app.use("/api/ui", uiRoutes);

// Public branding endpoint (no auth required)
app.get("/api/branding", async (req, res) => {
  try {
    const settings = await db.get("SELECT * FROM branding_settings LIMIT 1");
    res.json(
      settings || { company_name: "Timesheet System", primary_color: "#0066CC" }
    );
  } catch (error) {
    console.error("Error fetching branding:", error);
    res.json({ company_name: "Timesheet System", primary_color: "#0066CC" });
  }
});

// Simple health check (no auth)
app.get("/api/health", (req, res) => {
  try {
    res.json({ ok: true, uptime: process.uptime(), env: process.env.NODE_ENV || "development" });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

// Swagger/OpenAPI Docs (CDN-based, no deprecated generator)
app.get("/api/docs", (req, res) => {
  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>API Docs</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>
        window.ui = SwaggerUIBundle({
          url: '/docs/openapi.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout'
        });
      </script>
    </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Serve static files AFTER API routes
app.use(express.static(path.join(__dirname, "public")));

// Serve frontend for all other routes (SPA) - MUST BE LAST
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
