require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const submissionRoutes = require("./routes/submission");
const companyRoutes = require("./routes/company");
const vehicleRoutes = require("./routes/vehicles");
const planningRoutes = require("./routes/planning");
const db = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for simplicity, enable and configure in production
  })
);

// Rate limiting - verhoogd voor normale gebruik
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minuten
  max: 1000, // 1000 requests per 5 minuten per IP
  message: { error: 'Te veel verzoeken, probeer het over een minuut opnieuw.' },
  skip: (req, res) => {
    // Skip rate limiting for static files and certain endpoints
    if (req.method === 'GET' && req.path.match(/\.(js|css|html|png|jpg|gif|svg|woff|woff2)$/)) {
      return true;
    }
    return false;
  },
  // Store: Consider using Redis for production
  // standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  // legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

app.use("/api/", limiter);

// CORS
app.use(cors());

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Disable caching for all static files (especially JS files)
app.use((req, res, next) => {
  if (req.url.match(/\.(js|css|html)$/)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/submission", submissionRoutes);
app.use("/api/admin/companies", companyRoutes);
app.use("/api/admin/vehicles", vehicleRoutes);
app.use("/api/admin/planning", planningRoutes);

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

// Serve frontend for all other routes (SPA)
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
