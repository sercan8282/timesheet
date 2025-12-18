const express = require("express");
const fetch = require("node-fetch");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// POST /api/translate { text, target, source, provider }
router.post("/", async (req, res) => {
  try {
    const { text, target, source, provider } = req.body || {};
    if (!text || !target) {
      return res.status(400).json({ error: "text and target are required" });
    }

    const normalizedProvider = (provider || "deepl").toLowerCase();
    let translated = null;

    if (normalizedProvider === "deepl") {
      const apiKey = process.env.DEEPL_API_KEY;
      if (!apiKey) {
        return res
          .status(400)
          .json({ error: "DEEPL_API_KEY is not configured on the server" });
      }

      const endpoint = apiKey.toLowerCase().includes(":fx")
        ? "https://api-free.deepl.com/v2/translate"
        : "https://api.deepl.com/v2/translate";

      const params = new URLSearchParams();
      params.append("text", text);
      params.append("target_lang", target.toUpperCase());
      if (source) params.append("source_lang", source.toUpperCase());

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
        body: params,
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        return res
          .status(502)
          .json({ error: `DeepL error ${resp.status}: ${errBody}` });
      }

      const data = await resp.json();
      translated = data.translations && data.translations[0] && data.translations[0].text;
    } else if (normalizedProvider === "google") {
      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "GOOGLE_TRANSLATE_API_KEY is not configured on the server" });
      }

      const body = {
        q: text,
        target: target,
      };
      if (source) body.source = source;

      const resp = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        return res.status(502).json({ error: `Google error ${resp.status}: ${errBody}` });
      }

      const data = await resp.json();
      translated =
        data &&
        data.data &&
        data.data.translations &&
        data.data.translations[0] &&
        data.data.translations[0].translatedText;
    } else {
      return res.status(400).json({ error: "Unsupported provider" });
    }

    if (!translated) {
      return res.status(502).json({ error: "No translation returned" });
    }

    res.json({ text: translated, provider: normalizedProvider });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;