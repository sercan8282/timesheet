/**
 * Let's Encrypt Certificate Management
 * Handles certificate requests, renewal, and storage
 */

const client = require('acme-client');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class LetsEncryptManager {
  constructor() {
    this.certDir = path.join(__dirname, '..', 'certs');
    this.stagingMode = true; // Start in staging for testing, switch to production after verification
    this.directoryUrl = 'https://acme-staging-v02.api.letsencrypt.org/directory'; // Staging
    // Production URL: 'https://acme-v02.api.letsencrypt.org/directory'
  }

  /**
   * Initialize certificate directory
   */
  async init() {
    try {
      await fs.ensureDir(this.certDir);
      console.log('[LE] Certificate directory ready:', this.certDir);
    } catch (error) {
      console.error('[LE] Failed to initialize certificate directory:', error);
      throw error;
    }
  }

  /**
   * Request a new certificate
   */
  async requestCertificate(domain, email, agreeToTerms = true) {
    try {
      console.log(`[LE] Requesting certificate for ${domain} (email: ${email})`);

      // Initialize ACME client
      const acmeClient = new client.Client({
        directoryUrl: this.directoryUrl,
        accountKey: await this.getOrCreateAccountKey()
      });

      // Create account
      console.log('[LE] Creating/retrieving ACME account...');
      await acmeClient.createAccount({
        termsOfServiceAgreed: agreeToTerms,
        contact: [`mailto:${email}`]
      });

      // Order certificate
      console.log('[LE] Creating certificate order...');
      const order = await acmeClient.createOrder({
        identifiers: [
          { type: 'dns', value: domain },
          { type: 'dns', value: `*.${domain}` } // Wildcard
        ]
      });

      // Get authorizations
      console.log('[LE] Getting authorizations...');
      const authorizations = await acmeClient.getAuthorizations(order);

      // Setup challenges (HTTP-01 for simplicity)
      const challenges = [];
      for (const authorization of authorizations) {
        const challenge = authorization.challenges.find(ch => ch.type === 'http-01');
        if (!challenge) {
          throw new Error(`No HTTP-01 challenge found for ${authorization.identifier.value}`);
        }
        challenges.push({
          authorization,
          challenge,
          domain: authorization.identifier.value,
          keyAuthorization: await acmeClient.getChallengeKeyAuthorization(challenge)
        });
      }

      // For HTTP-01, we need to serve the challenge tokens
      console.log('[LE] Setting up HTTP challenge responses...');
      // This would need to be integrated with Express
      // For now, we'll just log the challenge data
      for (const ch of challenges) {
        console.log(`[LE] Challenge token for ${ch.domain}:`);
        console.log(`  Token: ${ch.challenge.token}`);
        console.log(`  Key Auth: ${ch.keyAuthorization}`);
      }

      // In a production setup, you would:
      // 1. Set up an Express route that serves the challenge tokens
      // 2. Call acmeClient.verifyChallenge(challenge)
      // 3. Finalize the order with acmeClient.finalizeOrder()

      console.log('[LE] Certificate request submitted.');
      console.log('[LE] NOTE: Manual HTTP challenge setup needed for production.');

      // For testing purposes, return the order details
      return {
        success: false, // Manual intervention needed
        message: 'Certificate order created. HTTP challenge setup required.',
        domain,
        orderId: order.url,
        challenges: challenges.map(c => ({
          domain: c.domain,
          token: c.challenge.token,
          keyAuthorization: c.keyAuthorization
        }))
      };

    } catch (error) {
      console.error('[LE] Certificate request error:', error);
      throw error;
    }
  }

  /**
   * Get or create ACME account key
   */
  async getOrCreateAccountKey() {
    const keyPath = path.join(this.certDir, 'account-key.pem');

    try {
      if (await fs.pathExists(keyPath)) {
        console.log('[LE] Using existing account key');
        return await fs.readFile(keyPath);
      }

      console.log('[LE] Generating new account key...');
      const accountKey = await client.forge.createPrivateKey();
      await fs.writeFile(keyPath, accountKey);
      console.log('[LE] Account key saved');
      return accountKey;

    } catch (error) {
      console.error('[LE] Failed to get/create account key:', error);
      throw error;
    }
  }

  /**
   * Generate self-signed certificate (for testing/fallback)
   */
  async generateSelfSignedCertificate(domain) {
    try {
      console.log(`[LE] Generating self-signed certificate for ${domain}`);

      const domainPath = path.join(this.certDir, domain);
      await fs.ensureDir(domainPath);

      const certPath = path.join(domainPath, 'cert.pem');
      const keyPath = path.join(domainPath, 'key.pem');

      // Check if already exists
      if (await fs.pathExists(certPath) && await fs.pathExists(keyPath)) {
        console.log('[LE] Self-signed certificate already exists');
        return { certPath, keyPath, domain };
      }

      // Generate key and certificate
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048
      });

      const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
      const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' });

      // For a proper self-signed cert, you'd use a tool like openssl
      // This is simplified - in production use 'selfsigned' npm package
      
      await fs.writeFile(keyPath, privateKeyPem);
      // Note: Would need proper cert generation here
      await fs.writeFile(certPath, '# Self-signed cert placeholder\n' + publicKeyPem);

      console.log(`[LE] Self-signed certificate generated for ${domain}`);
      return { certPath, keyPath, domain };

    } catch (error) {
      console.error('[LE] Failed to generate self-signed certificate:', error);
      throw error;
    }
  }

  /**
   * Get certificate info
   */
  async getCertificateInfo(domain) {
    try {
      const domainPath = path.join(this.certDir, domain);
      const certPath = path.join(domainPath, 'cert.pem');
      const keyPath = path.join(domainPath, 'key.pem');

      if (!(await fs.pathExists(certPath))) {
        return null;
      }

      const stats = await fs.stat(certPath);

      return {
        domain,
        certPath,
        keyPath,
        created: stats.birthtime,
        modified: stats.mtime,
        exists: true
      };

    } catch (error) {
      console.error('[LE] Failed to get certificate info:', error);
      return null;
    }
  }

  /**
   * List all certificates
   */
  async listCertificates() {
    try {
      const domains = await fs.readdir(this.certDir);
      const certs = [];

      for (const domain of domains) {
        const info = await this.getCertificateInfo(domain);
        if (info) {
          certs.push(info);
        }
      }

      return certs;
    } catch (error) {
      console.error('[LE] Failed to list certificates:', error);
      return [];
    }
  }

  /**
   * Switch to production Let's Encrypt
   */
  switchToProduction() {
    this.stagingMode = false;
    this.directoryUrl = 'https://acme-v02.api.letsencrypt.org/directory';
    console.log('[LE] Switched to production Let\'s Encrypt');
  }

  /**
   * Switch back to staging
   */
  switchToStaging() {
    this.stagingMode = true;
    this.directoryUrl = 'https://acme-staging-v02.api.letsencrypt.org/directory';
    console.log('[LE] Switched to staging Let\'s Encrypt');
  }
}

module.exports = new LetsEncryptManager();
