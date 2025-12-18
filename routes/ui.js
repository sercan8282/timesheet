const express = require("express");
const db = require("../config/database");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Require authentication for menu retrieval (we only show menu after login)
router.use(authMiddleware);

// GET menu configuration
router.get("/menu", async (_req, res) => {
  try {
    const locale =
      _req.query && _req.query.locale
        ? String(_req.query.locale).trim().toLowerCase()
        : null;
    const rows = await db.all(
      `SELECT page_key, label, sort_order, visible FROM ui_menu ORDER BY sort_order ASC`
    );

    if (!locale) {
      return res.json(rows);
    }

    // Fetch translations for these menu keys in the requested locale
    const keys = rows.map((r) => r.page_key);
    if (keys.length === 0) return res.json(rows);

    const placeholders = keys.map(() => "?").join(",");
    const trows = await db.all(
      `SELECT key, text FROM translations WHERE namespace = 'menu' AND locale = ? AND key IN (${placeholders})`,
      [locale, ...keys]
    );

    const map = {};
    (trows || []).forEach((t) => {
      map[t.key] = t.text;
    });

    const localized = rows.map((r) => ({
      page_key: r.page_key,
      label: map[r.page_key] || r.label,
      sort_order: r.sort_order,
      visible: r.visible,
    }));

    res.json(localized);
  } catch (error) {
    console.error("Error fetching UI menu:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET translations (authenticated) - supports ?locale=nl&namespace=menu
router.get("/i18n", async (req, res) => {
  try {
    const { locale, namespace } = req.query;
    if (!locale) return res.status(400).json({ error: "locale is required" });

    const params = [String(locale).trim().toLowerCase()];
    let sql = `SELECT namespace, key, locale, text FROM translations WHERE locale = ?`;
    if (namespace) {
      sql += ` AND namespace = ?`;
      params.push(String(namespace));
    }
    sql += ` ORDER BY namespace, key`;

    const rows = await db.all(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching translations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
