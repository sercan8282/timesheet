# ✅ IMPLEMENTATION CHECKLIST

**Service Account Installation Security Hardening**  
**Project:** Timesheet Management System  
**Start Date:** January 2026

---

## 🔴 PHASE 1: CRITICAL (Week 1)

### 1. Replace Hardcoded JWT_SECRET Default
- [ ] Review `scripts/setup-system-config.js` line 69
- [ ] Review `utils/secrets.js` line 21
- [ ] Create `generateRandomSecret()` function
- [ ] Update setup-system-config to use generated secret
- [ ] Update secrets.js master key generation
- [ ] Test with environment variable set
- [ ] Test with environment variable NOT set
- [ ] Update .env.example with instructions
- [ ] Documentation update
- **PR:** `security/fix-jwt-secret-default`
- **Time:** 30 minutes
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ If JWT_SECRET not in .env, random 64-char secret is generated
- ✅ Console warning if using generated secret
- ✅ All tests pass
- ✅ No hardcoded defaults remain

---

### 2. Encrypt SMTP Passwords
- [ ] Create migration script `scripts/encrypt-smtp-passwords.js`
- [ ] Add encryption to `scripts/init-db.js`
- [ ] Update email utilities to decrypt on read
- [ ] Test with existing plaintext data
- [ ] Test with new encrypted data
- [ ] Verify email sending still works
- [ ] Documentation update
- **PR:** `security/encrypt-smtp-passwords`
- **Time:** 2 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ New SMTP passwords are encrypted in database
- ✅ Existing plaintext passwords migrated to encrypted
- ✅ Email notifications still work with encrypted passwords
- ✅ No plaintext passwords in database exports

---

### 3. Separate Encryption Key from JWT_SECRET
- [ ] Create `MASTER_SECRET_KEY` environment variable
- [ ] Update `utils/secrets.js` to use `MASTER_SECRET_KEY`
- [ ] Update `utils/encryption.js` if needed
- [ ] Remove JWT_SECRET dependency from encryption
- [ ] Generate separate key if `MASTER_SECRET_KEY` not set
- [ ] Update .env.example
- [ ] Test encryption/decryption with separate keys
- [ ] Documentation update
- **PR:** `security/separate-encryption-keys`
- **Time:** 1 hour
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ Encryption key is independent of JWT_SECRET
- ✅ Both are generated if not in .env
- ✅ Console warnings if using defaults
- ✅ No functionality broken

---

### 4. Force Password Change on First Login
- [ ] Create migration `scripts/add-password-changed-column.js`
- [ ] Add `password_changed_at` column to `users` table
- [ ] Update admin user creation (init-db.js)
- [ ] Update auth middleware to check column
- [ ] Create `/api/auth/change-password` endpoint
- [ ] Create `/admin/change-password` UI page
- [ ] Test flow for new admin user
- [ ] Test flow for existing users
- [ ] Documentation update
- **PR:** `security/force-password-change`
- **Time:** 2 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ New admin users cannot use system without changing password
- ✅ Clear redirect to password change form
- ✅ Password change endpoint works
- ✅ Existing users not forced to change password

---

### 5. Require MFA for Admin Users
- [ ] Review MFA implementation in `routes/mfa.js`
- [ ] Update `middleware/auth.js` to enforce MFA for admins
- [ ] Allow admin endpoints only for MFA setup
- [ ] Test admin login without MFA
- [ ] Test admin login with MFA
- [ ] Update documentation
- [ ] Update welcome/first-login flow
- **PR:** `security/require-admin-mfa`
- **Time:** 1 hour
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ Admin users cannot access system without MFA enabled
- ✅ Admin can access MFA setup endpoints
- ✅ Clear instructions for MFA setup
- ✅ User can set up TOTP during first login

**Phase 1 Total:** 8-10 hours ⏱️

---

## 🟠 PHASE 2: HIGH (Weeks 2-3)

### 6. Deploy Interactive Setup Script
- [ ] Review `scripts/setup-interactive.js`
- [ ] Update `package.json` with `setup-interactive` script
- [ ] Test complete setup flow from scratch
- [ ] Test error handling (invalid inputs)
- [ ] Test existing database (should not overwrite)
- [ ] Test on Windows (password input handling)
- [ ] Test on macOS/Linux
- [ ] Create `docs/QUICK-START.md` guide
- [ ] Update README with setup instructions
- **PR:** `feature/interactive-setup`
- **Time:** 2 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ `npm run setup-interactive` works end-to-end
- ✅ Generates secure .env file
- ✅ Initializes database correctly
- ✅ Works on multiple platforms
- ✅ Clear error messages for invalid input

---

### 7. Implement Audit Logging
- [ ] Create migration `scripts/add-audit-logging.js`
- [ ] Create `audit_logs` table schema
- [ ] Create `utils/audit.js` utilities
- [ ] Add audit logging to admin routes
- [ ] Add audit logging to config changes
- [ ] Add audit logging to user creation
- [ ] Create admin UI to view audit logs
- [ ] Create `/api/admin/audit-logs` endpoint
- [ ] Test audit trail for changes
- [ ] Documentation update
- **PR:** `feature/audit-logging`
- **Time:** 3 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ All admin actions are logged
- ✅ Audit log shows who changed what and when
- ✅ Cannot modify/delete audit logs
- ✅ Admin can view audit trail

---

### 8. Configuration Validation at Startup
- [ ] Create `scripts/validate-config.js`
- [ ] Check required environment variables
- [ ] Check environment variable lengths
- [ ] Check file permissions (Unix)
- [ ] Check database connectivity
- [ ] Add validation to server.js startup
- [ ] Test with missing variables
- [ ] Test with invalid values
- [ ] Create helpful error messages
- [ ] Documentation update
- **PR:** `feature/config-validation`
- **Time:** 2 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ Server refuses to start with invalid config
- ✅ Clear error messages for each issue
- ✅ Suggests fixes for common problems
- ✅ Logs warnings for non-critical issues

---

### 9. Create Admin UI for System Config
- [ ] Create `public/js/admin-system-config.js`
- [ ] Create `public/html/admin-system-config.html`
- [ ] Add route to admin menu
- [ ] Display all configuration keys
- [ ] Show current values (with masking for secrets)
- [ ] Add edit capability for non-secret values
- [ ] Add display-only for secret values
- [ ] Add "Requires Restart" indicators
- [ ] Test UI in browser
- [ ] Documentation update
- **PR:** `feature/admin-config-ui`
- **Time:** 3 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ Admin can view all system config from UI
- ✅ Can edit non-secret values
- ✅ Secrets are not exposed in UI
- ✅ Clear indication when restart needed

---

### 10. Fix npm Vulnerabilities
- [ ] Run `npm audit`
- [ ] Create list of vulnerabilities
- [ ] Review each vulnerability
- [ ] Update dependencies with `npm update`
- [ ] Review breaking changes
- [ ] Fix any compatibility issues
- [ ] Run tests to verify nothing broken
- [ ] Commit updated `package-lock.json`
- **PR:** `security/fix-npm-vulnerabilities`
- **Time:** 1 hour
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ No critical vulnerabilities remain
- ✅ All dependencies up-to-date
- ✅ Application still works correctly

**Phase 2 Total:** 10-14 hours ⏱️

---

## 🟡 PHASE 3: MEDIUM (Weeks 4-6)

### 11. Database Encryption at Rest
- [ ] Evaluate encryption options (SQLCipher vs backup encryption)
- [ ] Implement chosen solution
- [ ] Test encrypted database
- [ ] Verify performance impact
- [ ] Create migration guide
- [ ] Document encryption key management
- **PR:** `security/database-encryption`
- **Time:** 4-6 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ Database file is encrypted on disk
- ✅ Cannot read database without key
- ✅ Performance acceptable

---

### 12. Load system_config at Startup
- [ ] Modify `server.js` to load configs
- [ ] Cache configs in global variable
- [ ] Add config refresh endpoint
- [ ] Test config loading at startup
- [ ] Test config updates take effect
- [ ] Documentation update
- **PR:** `feature/load-config-at-startup`
- **Time:** 1-2 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ System config loaded from database at startup
- ✅ Config changes reflected without restart (where applicable)
- ✅ Performance not impacted

---

### 13. Harden License Manager
- [ ] Remove hardcoded admin password
- [ ] Remove hardcoded session secret
- [ ] Remove hardcoded license secret
- [ ] Require env vars on startup
- [ ] Add validation
- [ ] Update documentation
- **PR:** `security/harden-license-manager`
- **Time:** 2-3 hours
- **Status:** 🔲 TODO

**Acceptance Criteria:**
- ✅ No hardcoded defaults
- ✅ All sensitive values from environment
- ✅ Clear error if values missing

**Phase 3 Total:** 8-10 hours ⏱️

---

## 📚 DOCUMENTATION TASKS

### All Phases
- [ ] Update README.md with new setup instructions
- [ ] Create INSTALLATION.md guide
- [ ] Create SECURITY.md document
- [ ] Create CONFIGURATION.md reference
- [ ] Update .env.example with all variables
- [ ] Create troubleshooting guide
- [ ] Create API documentation updates
- [ ] Create admin manual

**Time:** 5-8 hours across all phases

---

## 🧪 TESTING PLAN

### Unit Tests
- [ ] JWT secret generation
- [ ] Password encryption
- [ ] Configuration validation
- [ ] Audit logging

### Integration Tests
- [ ] Complete setup flow
- [ ] Admin authentication
- [ ] Configuration updates
- [ ] Email sending with encrypted password

### Manual Tests
- [ ] Setup on fresh system
- [ ] Setup on Windows
- [ ] Setup on macOS
- [ ] Setup on Linux
- [ ] First login flow
- [ ] Password change flow
- [ ] MFA setup flow

**Time:** 10-15 hours (spread across phases)

---

## 🚀 DEPLOYMENT PLAN

### Pre-deployment
- [ ] All phase 1 critical items complete
- [ ] All tests passing
- [ ] Documentation reviewed
- [ ] Security review completed
- [ ] Team training completed

### Deployment Steps
1. **Day 1: Backup & Review**
   - [ ] Full database backup
   - [ ] Review all changes
   - [ ] Team sign-off

2. **Day 2: Phase 1 Deploy**
   - [ ] Deploy critical security fixes
   - [ ] Run validation
   - [ ] Monitor logs

3. **Day 3: Phase 2 Deploy**
   - [ ] Deploy high-priority improvements
   - [ ] Update documentation
   - [ ] Team training

4. **Week 2-4: Phase 3 Deploy**
   - [ ] Deploy medium-priority items
   - [ ] Ongoing support

### Post-deployment
- [ ] Monitor for issues
- [ ] Collect feedback
- [ ] Plan future improvements
- [ ] Security audit in 3 months

---

## 📊 PROGRESS TRACKING

| Phase | Task | Status | Start | End | Owner |
|-------|------|--------|-------|-----|-------|
| 🔴 1 | JWT Secret | 🔲 TODO | - | - | TBD |
| 🔴 1 | SMTP Encryption | 🔲 TODO | - | - | TBD |
| 🔴 1 | Encryption Keys | 🔲 TODO | - | - | TBD |
| 🔴 1 | Password Change | 🔲 TODO | - | - | TBD |
| 🔴 1 | Admin MFA | 🔲 TODO | - | - | TBD |
| 🟠 2 | Interactive Setup | 🔲 TODO | - | - | TBD |
| 🟠 2 | Audit Logging | 🔲 TODO | - | - | TBD |
| 🟠 2 | Config Validation | 🔲 TODO | - | - | TBD |
| 🟠 2 | Admin UI | 🔲 TODO | - | - | TBD |
| 🟠 2 | npm Vulnerabilities | 🔲 TODO | - | - | TBD |
| 🟡 3 | DB Encryption | 🔲 TODO | - | - | TBD |
| 🟡 3 | Load Config | 🔲 TODO | - | - | TBD |
| 🟡 3 | License Manager | 🔲 TODO | - | - | TBD |

---

## ✅ SIGN-OFF

### Completed By
- [ ] Security audit completed
- [ ] All items documented
- [ ] Implementation plan approved
- [ ] Team assigned

### Reviewed By
- [ ] Technical lead: _______________
- [ ] Security lead: ________________
- [ ] Product manager: _____________

### Signed Off
- [ ] CTO/Manager: _________________
- [ ] Date: _______________________

---

**Legend:**
- 🔲 TODO
- 🟦 IN PROGRESS
- ✅ DONE
- ⚠️ BLOCKED

**Estimated Total Effort:** ~40-50 hours (1-2 weeks intensive)  
**Priority:** CRITICAL → HIGH → MEDIUM

---

Last Updated: 11 January 2026
