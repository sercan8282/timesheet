const https = require('https');
const nodemailer = require('nodemailer');
const db = require('../config/database');

function isOAuth(settings) {
  return settings.auth_type === 'oauth2';
}

function getUseSecure(settings) {
  return settings.smtp_port === 465;
}

async function fetchAccessToken(settings) {
  if (!settings.oauth_tenant_id || !settings.oauth_client_id || !settings.oauth_client_secret) {
    throw new Error('OAuth settings are incomplete');
  }

  const scope = settings.oauth_scope || 'https://outlook.office365.com/.default';
  const postData = new URLSearchParams({
    client_id: settings.oauth_client_id,
    client_secret: settings.oauth_client_secret,
    scope,
    grant_type: 'client_credentials'
  }).toString();

  const options = {
    method: 'POST',
    hostname: 'login.microsoftonline.com',
    path: `/${settings.oauth_tenant_id}/oauth2/v2.0/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(parsed.error_description || parsed.error));
          }
          if (!parsed.access_token) {
            return reject(new Error('No access token returned from Microsoft'));
          }
          resolve(parsed.access_token);
        } catch (err) {
          reject(new Error('Failed to parse token response'));
        }
      });
    });

    req.on('error', (err) => reject(err));
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
        type: 'OAuth2',
        user: settings.smtp_user,
        accessToken
      },
      requireTLS: !useSecure,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      }
    });
  }

  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: useSecure,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass
    },
    requireTLS: !useSecure,
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: false
    }
  });
}

async function sendEmail(subject, text, attachments = [], customRecipient = null) {
  try {
    const settings = await db.get('SELECT * FROM smtp_settings LIMIT 1');

    if (!settings) {
      throw new Error('SMTP settings not configured');
    }

    const transporter = await buildTransporter(settings);

    const info = await transporter.sendMail({
      from: settings.email_from,
      to: customRecipient || settings.email_to,
      subject,
      text,
      attachments
    });

    return info;
  } catch (error) {
    console.error('Email error:', error);
    throw error;
  }
}

async function testSMTPConnection() {
  try {
    const settings = await db.get('SELECT * FROM smtp_settings LIMIT 1');

    if (!settings) {
      throw new Error('SMTP settings not configured');
    }

    const transporter = await buildTransporter(settings);

    await transporter.verify();

    await transporter.sendMail({
      from: settings.email_from,
      to: settings.email_from,
      subject: 'SMTP Test - Timesheet System',
      text: 'This is a test email from your Timesheet Management System. If you receive this, your SMTP settings are configured correctly!'
    });

    return { success: true, message: 'SMTP connection successful! Test email sent.' };
  } catch (error) {
    console.error('SMTP test error:', error);
    throw new Error(`SMTP test failed: ${error.message}`);
  }
}

module.exports = { sendEmail, testSMTPConnection };
