const https = require("https");
const nodemailer = require("nodemailer");
const db = require("../config/database");
const { decryptPassword } = require("./encryption");
const url = require("url");

function isOAuth(settings) {
  return settings.auth_type === "oauth2";
}

function getUseSecure(settings) {
  return settings.smtp_port === 465;
}

async function fetchAccessToken(settings) {
  if (
    !settings.oauth_tenant_id ||
    !settings.oauth_client_id ||
    !settings.oauth_client_secret
  ) {
    throw new Error("OAuth settings are incomplete");
  }

  const normalizeScope = (raw) => {
    const val = (raw || "").trim();
    // Default to Outlook SMTP resource
    if (!val) return "https://outlook.office365.com/.default";
    // If a random non-URL value was set, force Outlook default
    try {
      const parsed = new url.URL(val);
      let s = parsed.origin + parsed.pathname;
      if (!s.endsWith("/.default")) s = s.replace(/\/?$/, "") + "/.default";
      return s;
    } catch {
      return "https://outlook.office365.com/.default";
    }
  };

  let scope = normalizeScope(settings.oauth_scope);

  // If using Office365 SMTP host but Graph scope, prefer Outlook resource
  const host = (settings.smtp_host || "").toLowerCase();
  if (host.includes("smtp.office365.com") && scope.startsWith("https://graph.microsoft.com")) {
    console.warn(
      "[SMTP OAuth] Graph scope detected with SMTP host; switching to Outlook .default scope"
    );
    scope = "https://outlook.office365.com/.default";
  }

  const postData = new URLSearchParams({
    client_id: settings.oauth_client_id,
    client_secret: settings.oauth_client_secret,
    scope,
    grant_type: "client_credentials",
  }).toString();

  const options = {
    method: "POST",
    hostname: "login.microsoftonline.com",
    path: `/${settings.oauth_tenant_id}/oauth2/v2.0/token`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    console.log("[SMTP OAuth] Requesting token from v2 endpoint with scope:", scope);
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            const desc = parsed.error_description || parsed.error;
            // Improve guidance for common scope/resource mistakes
            if (desc && desc.includes("AADSTS1002012")) {
              // One automatic retry with Outlook scope
              const fallbackScope = "https://outlook.office365.com/.default";
              if (scope !== fallbackScope) {
                console.warn("[SMTP OAuth] AADSTS1002012; retrying with scope:", fallbackScope);
                const retryBody = new URLSearchParams({
                  client_id: settings.oauth_client_id,
                  client_secret: settings.oauth_client_secret,
                  scope: fallbackScope,
                  grant_type: "client_credentials",
                }).toString();
                const retryReq = https.request(options, (rres) => {
                  let rdata = "";
                  rres.on("data", (chunk) => (rdata += chunk));
                  rres.on("end", () => {
                    try {
                      const rparsed = JSON.parse(rdata);
                      if (rparsed.error) {
                        const rdesc = rparsed.error_description || rparsed.error;
                        return reject(new Error(rdesc || "Token retry failed"));
                      }
                      if (!rparsed.access_token) {
                        return reject(new Error("No access token returned from Microsoft (retry)"));
                      }
                      console.log("[SMTP OAuth] Token acquired after retry with scope:", fallbackScope);
                      return resolve(rparsed.access_token);
                    } catch (rerr) {
                      return reject(new Error("Failed to parse token response (retry)"));
                    }
                  });
                });
                retryReq.on("error", (rerr) => reject(rerr));
                retryReq.write(retryBody);
                retryReq.end();
                return; // Exit original handler until retry finishes
              }
              return reject(
                new Error(
                  "AADSTS1002012: Scope must be the resource identifier ending with /.default. Use https://outlook.office365.com/.default for SMTP app-only and grant the SMTP.Send application permission."
                )
              );
            }
            if (desc && desc.includes("AADSTS70011")) {
              return reject(
                new Error(
                  "AADSTS70011: Invalid or unsupported scope. Ensure you use the v2 token endpoint and a /.default scope (e.g. https://outlook.office365.com/.default)."
                )
              );
            }
            return reject(new Error(desc || "Token request failed"));
          }
          if (!parsed.access_token) {
            return reject(new Error("No access token returned from Microsoft"));
          }
          console.log("[SMTP OAuth] Token acquired via v2 endpoint with scope:", scope);
          resolve(parsed.access_token);
        } catch (err) {
          reject(new Error("Failed to parse token response"));
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

async function buildTransporter(settings) {
  const useSecure = getUseSecure(settings);

  if (isOAuth(settings)) {
    const accessToken = await fetchAccessToken(settings);

    return nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: useSecure,
      auth: {
        type: "OAuth2",
        user: settings.smtp_user,
        accessToken,
        // Explicitly indicate XOAUTH2 for clarity with some SMTP servers
        method: "XOAUTH2",
      },
      requireTLS: !useSecure,
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: false,
      },
    });
  }

  console.log("[SMTP DEBUG] Basic Auth - Host:", settings.smtp_host);
  console.log("[SMTP DEBUG] Basic Auth - Port:", settings.smtp_port);
  console.log("[SMTP DEBUG] Basic Auth - Secure:", useSecure);
  console.log("[SMTP DEBUG] Basic Auth - User:", settings.smtp_user);
  console.log("[SMTP DEBUG] Basic Auth - Has smtp_pass:", !!settings.smtp_pass);
  console.log("[SMTP DEBUG] Basic Auth - Has smtp_pass_encrypted:", !!settings.smtp_pass_encrypted);
  
  // Decrypt password if it's encrypted, otherwise use plain password
  let decryptedPass = null;
  if (settings.smtp_pass_encrypted) {
    console.log("[SMTP DEBUG] Attempting to decrypt encrypted password...");
    decryptedPass = decryptPassword(settings.smtp_pass_encrypted);
    console.log("[SMTP DEBUG] Decryption result:", decryptedPass ? "SUCCESS" : "FAILED");
  } else if (settings.smtp_pass) {
    console.log("[SMTP DEBUG] Using plain password from smtp_pass");
    decryptedPass = settings.smtp_pass;
  } else {
    console.log("[SMTP DEBUG] ERROR: No password found in database (neither smtp_pass nor smtp_pass_encrypted)");
  }
  
  console.log("[SMTP DEBUG] Basic Auth - Pass length:", decryptedPass ? decryptedPass.length : "EMPTY/MISSING");
  console.log("[SMTP DEBUG] Basic Auth - Pass exists:", !!decryptedPass);
  console.log("[SMTP DEBUG] Basic Auth - requireTLS:", !useSecure);

  // Validate that credentials exist
  if (!settings.smtp_user || !decryptedPass) {
    throw new Error(`Missing SMTP credentials: user=${!!settings.smtp_user}, pass=${!!decryptedPass}`);
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: useSecure,
    auth: {
      user: settings.smtp_user,
      pass: decryptedPass,
    },
    requireTLS: !useSecure,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: false,
    },
    logger: true,
    debug: true,
  });

  return transporter;
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlToPlainText(html) {
  if (!html) return "";
  let s = String(html);
  // Normalize common HTML line breaks to newlines
  s = s.replace(/\r/g, "");
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/p\s*>/gi, "\n");
  s = s.replace(/<\s*\/div\s*>/gi, "\n");
  // Remove scripts/styles
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, "");
  // Decode a few common entities
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Collapse 3+ newlines to 2, trim trailing spaces
  s = s.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

async function sendEmail(options) {
  try {
    const settings = await db.get("SELECT * FROM smtp_settings LIMIT 1");

    if (!settings) {
      throw new Error("SMTP settings not configured");
    }

    const transporter = await buildTransporter(settings);

    // Support both old signature (subject, text, attachments, customRecipient)
    // and new signature ({ to, subject, text, html, attachments })
    let mailOptions;
    if (typeof options === "string") {
      // Old signature: sendEmail(subject, text, attachments, customRecipient)
      const [subject, text, attachments = [], customRecipient = null] =
        arguments;
      mailOptions = {
        from: settings.email_from,
        to: customRecipient || settings.email_to,
        subject,
        text,
        attachments,
      };
    } else {
      // New signature: sendEmail({ to, subject, text, html, attachments })
      mailOptions = {
        from: settings.email_from,
        to: options.to || settings.email_to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments || [],
      };
    }

    // Append signature if enabled
    if (settings.signature_enabled) {
      const sigRaw = settings.signature_html || "";
      if (sigRaw && sigRaw.trim()) {
        const divider = '<hr style="border:none;border-top:1px solid #ddd;margin:12px 0;" />';
        // Determine if signature looks like HTML; if not, escape and convert newlines to <br>
        const looksHtml = /<[^>]+>/.test(sigRaw);
        const sigHtmlProcessed = looksHtml
          ? sigRaw.replace(/\r?\n/g, "<br>")
          : escapeHtml(sigRaw).replace(/\r?\n/g, "<br>");

        if (mailOptions.html) {
          mailOptions.html = `${mailOptions.html}${divider}${sigHtmlProcessed}`;
        } else if (mailOptions.text) {
          // Create a minimal HTML version from text and append signature
          const safeText = (mailOptions.text || "").replace(/\n/g, "<br>");
          mailOptions.html = `${safeText}${divider}${sigHtmlProcessed}`;
          // Also extend text with a plain signature fallback, preserving lines
          const sigPlain = looksHtml ? htmlToPlainText(sigRaw) : sigRaw.replace(/\r/g, "");
          const plainSig = `\n\n-- \n${sigPlain}`;
          mailOptions.text = `${mailOptions.text}${plainSig}`;
        }
      }
    }

    const info = await transporter.sendMail(mailOptions);

    return info;
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
}

async function testSMTPConnection() {
  try {
    const settings = await db.get("SELECT * FROM smtp_settings LIMIT 1");

    if (!settings) {
      throw new Error("SMTP settings not configured");
    }

    console.log("[SMTP TEST] Starting SMTP connection test...");
    console.log("[SMTP TEST] Settings from DB:", {
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_user: settings.smtp_user,
      auth_type: settings.auth_type,
      has_smtp_pass: !!settings.smtp_pass,
      has_smtp_pass_encrypted: !!settings.smtp_pass_encrypted,
      email_from: settings.email_from
    });
    console.log("[SMTP TEST] Using auth type:", settings.auth_type);
    
    const transporter = await buildTransporter(settings);

    console.log("[SMTP TEST] Running verify...");
    await transporter.verify();
    console.log("[SMTP TEST] Verify passed!");

    console.log("[SMTP TEST] Sending test email...");
    await transporter.sendMail({
      from: settings.email_from,
      to: settings.email_from,
      subject: "SMTP Test - Timesheet System",
      text: "This is a test email from your Timesheet Management System. If you receive this, your SMTP settings are configured correctly!",
    });
    console.log("[SMTP TEST] Email sent successfully!");

    return {
      success: true,
      message: "SMTP connection successful! Test email sent.",
    };
  } catch (error) {
    console.error("[SMTP TEST] Error:", error.message);
    console.error("[SMTP TEST] Full error:", error);
    throw new Error(`SMTP test failed: ${error.message}`);
  }
}

// Send invoice email with attachment
async function sendInvoiceEmail(options) {
  return sendEmail(options);
}

module.exports = { sendEmail, testSMTPConnection, sendInvoiceEmail };
