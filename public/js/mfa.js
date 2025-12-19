// MFA Modal and functionality
let mfaModal = null;
let mfaState = {
  username: null,
  password: null,
  setupMode: false,
  loginMode: false,
};

function showMFAModal(config = {}) {
  // Create modal if it doesn't exist
  if (!mfaModal) {
    const modalHTML = `
            <div class="modal fade" id="mfaModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="mfaModalTitle">
                                <i class="bi bi-shield-lock"></i> Two-Factor Authentication
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" id="mfaCloseBtn"></button>
                        </div>
                        <div class="modal-body" id="mfaModalBody">
                            <!-- Dynamic content -->
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    mfaModal = new bootstrap.Modal(document.getElementById("mfaModal"));
  }

  const modalBody = document.getElementById("mfaModalBody");
  const closeBtn = document.getElementById("mfaCloseBtn");

  if (config.setupMode) {
    // MFA Setup mode
    mfaState.setupMode = true;
    mfaState.loginMode = false;
    closeBtn.style.display = config.required ? "none" : "block";

    modalBody.innerHTML = `
            <div id="mfaSetupAlert"></div>
            <div id="mfaSetupStep1" style="display: block;">
                <p>Enhance your account security with Two-Factor Authentication.</p>
                <p class="text-muted small">You'll need an authenticator app like Google Authenticator, Microsoft Authenticator, or Authy.</p>
                <div class="mb-2">
                    <div class="small fw-semibold">Download an authenticator app</div>
                    <div class="d-flex gap-2 mt-1">
                        <a class="btn btn-outline-primary btn-sm" href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener">App Store — Google Authenticator</a>
                        <a class="btn btn-outline-primary btn-sm" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener">Google Play — Google Authenticator</a>
                    </div>
                    <div class="d-flex gap-2 mt-1">
                        <a class="btn btn-outline-secondary btn-sm" href="https://apps.apple.com/app/microsoft-authenticator/id983156458" target="_blank" rel="noopener">App Store — Microsoft Authenticator</a>
                        <a class="btn btn-outline-secondary btn-sm" href="https://play.google.com/store/apps/details?id=com.azure.authenticator" target="_blank" rel="noopener">Google Play — Microsoft Authenticator</a>
                    </div>
                    <div class="text-muted small mt-2">Tip: after installing, open the app and choose "Add account" → "Scan QR code" or "Enter code manually".</div>
                </div>
                <button class="btn btn-primary w-100" onclick="mfaStartSetup()">
                    <i class="bi bi-qr-code"></i> Start Setup
                </button>
                <!-- Skipping MFA setup has been removed -->
                ${
                  config.required
                    ? `
                    <div class="alert alert-warning mt-3">
                        <i class="bi bi-exclamation-triangle"></i> MFA setup is now required. You've reached the maximum number of skips.
                    </div>
                `
                    : ""
                }
            </div>
            <div id="mfaSetupStep2" style="display: none;">
                <div class="text-center mb-3">
                    <div id="qrCodeContainer"></div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Or enter this code manually:</label>
                    <input type="text" class="form-control text-center" id="mfaSecretCode" readonly>
                    <small class="text-muted">Save this code in a safe place</small>
                    <div class="mt-2 small text-muted">Need the app? Get one from:</div>
                    <div class="d-flex gap-2 mt-1">
                        <a class="btn btn-outline-sm btn-link" href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener">App Store</a>
                        <a class="btn btn-outline-sm btn-link" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener">Google Play</a>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Enter verification code from your app:</label>
                    <input type="text" class="form-control text-center" id="mfaVerifyCode" 
                           placeholder="000000" maxlength="6" pattern="[0-9]{6}" 
                           inputmode="numeric" autocomplete="off">
                </div>
                <button class="btn btn-success w-100" onclick="mfaVerifySetup()">
                    <i class="bi bi-check-circle"></i> Verify & Enable MFA
                </button>
            </div>
            <div id="mfaSetupStep3" style="display: none;">
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i> MFA enabled successfully!
                </div>
                <h6>Backup Codes</h6>
                <p class="text-muted small">Save these codes in a safe place. You can use them to access your account if you lose your device.</p>
                <div id="backupCodesContainer" class="p-3 bg-light rounded mb-3" style="font-family: monospace;"></div>
                <button class="btn btn-primary w-100" onclick="mfaCompleteSetup()">
                    Continue
                </button>
            </div>
        `;
  } else if (config.loginMode) {
    // MFA Login mode (token required)
    mfaState.loginMode = true;
    mfaState.setupMode = false;
    mfaState.username = config.username;
    mfaState.password = config.password;
    closeBtn.style.display = "none";

    modalBody.innerHTML = `
            <div id="mfaLoginAlert"></div>
            <p>Enter the 6-digit code from your authenticator app:</p>
            <div class="mb-3">
                <input type="text" class="form-control form-control-lg text-center" id="mfaLoginCode" 
                       placeholder="000000" maxlength="6" pattern="[0-9]{6}" 
                       inputmode="numeric" autocomplete="off" autofocus>
            </div>
            <button class="btn btn-primary w-100 mb-2" onclick="mfaSubmitLoginCode()">
                <i class="bi bi-check-circle"></i> Verify
            </button>
            <button class="btn btn-outline-secondary w-100" onclick="mfaUseBackupCode()">
                Use backup code instead
            </button>
        `;
  } else if (config.backupCodeMode) {
    // Backup code mode
    modalBody.innerHTML = `
            <div id="mfaBackupAlert"></div>
            <p>Enter one of your backup codes:</p>
            <div class="mb-3">
                <input type="text" class="form-control text-center" id="mfaBackupCode" 
                       placeholder="XXXXXXXX" maxlength="8" autocomplete="off" autofocus>
            </div>
            <button class="btn btn-primary w-100 mb-2" onclick="mfaSubmitBackupCode()">
                <i class="bi bi-check-circle"></i> Verify
            </button>
            <button class="btn btn-outline-secondary w-100" onclick="showMFAModal({ loginMode: true, username: mfaState.username, password: mfaState.password })">
                Back to code entry
            </button>
        `;
  }

  // Skipping is not supported anymore; no skip UI to update.

  mfaModal.show();
}

async function mfaStartSetup() {
  const alertDiv = document.getElementById("mfaSetupAlert");

  try {
    const response = await fetch(`${API_BASE_URL}/mfa/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api.getToken()}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to setup MFA");
    }

    // Show QR code and secret
    document.getElementById("mfaSetupStep1").style.display = "none";
    document.getElementById("mfaSetupStep2").style.display = "block";

    document.getElementById("qrCodeContainer").innerHTML = `
            <img src="${data.qrCode}" alt="QR Code" style="max-width: 250px;">
        `;
    document.getElementById("mfaSecretCode").value = data.secret;
  } catch (error) {
    alertDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> ${error.message}
            </div>
        `;
  }
}

async function mfaVerifySetup() {
  const alertDiv = document.getElementById("mfaSetupAlert");
  const code = document.getElementById("mfaVerifyCode").value;

  if (!code || code.length !== 6) {
    alertDiv.innerHTML = `
            <div class="alert alert-warning">
                Please enter a valid 6-digit code
            </div>
        `;
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/mfa/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api.getToken()}`,
      },
      body: JSON.stringify({ token: code }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Invalid code");
    }

    // Show backup codes
    document.getElementById("mfaSetupStep2").style.display = "none";
    document.getElementById("mfaSetupStep3").style.display = "block";

    const backupCodesContainer = document.getElementById(
      "backupCodesContainer"
    );
    backupCodesContainer.innerHTML = data.backupCodes
      .map((code) => `<div>${code}</div>`)
      .join("");
  } catch (error) {
    alertDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> ${error.message}
            </div>
        `;
  }
}

async function mfaSkipSetup() {
  // Skipping MFA setup is no longer supported.
  const alertDiv = document.getElementById("mfaSetupAlert");
  if (alertDiv) {
    alertDiv.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Skipping MFA setup is no longer supported. Please complete the setup to continue.
            </div>
        `;
  }
}

function mfaCompleteSetup() {
  mfaModal.hide();
  if (mfaState.setupMode) {
    // Refresh page to reflect MFA enabled status
    window.location.reload();
  }
}

async function mfaSubmitLoginCode() {
  const code = document.getElementById("mfaLoginCode").value;
  const alertDiv = document.getElementById("mfaLoginAlert");

  if (!code || code.length !== 6) {
    alertDiv.innerHTML = `
            <div class="alert alert-warning">
                Please enter a valid 6-digit code
            </div>
        `;
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: mfaState.username,
        password: mfaState.password,
        mfaToken: code,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Invalid code");
    }

    // Login successful
    api.setToken(data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    mfaModal.hide();
    window.location.reload();
  } catch (error) {
    alertDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> ${error.message}
            </div>
        `;
  }
}

function mfaUseBackupCode() {
  showMFAModal({ backupCodeMode: true });
}

async function mfaSubmitBackupCode() {
  const code = document.getElementById("mfaBackupCode").value;
  const alertDiv = document.getElementById("mfaBackupAlert");

  if (!code || code.length !== 8) {
    alertDiv.innerHTML = `
            <div class="alert alert-warning">
                Please enter a valid backup code
            </div>
        `;
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: mfaState.username,
        password: mfaState.password,
        mfaToken: code,
        useBackupCode: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Invalid backup code");
    }

    // Login successful
    api.setToken(data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    mfaModal.hide();
    window.location.reload();
  } catch (error) {
    alertDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> ${error.message}
            </div>
        `;
  }
}
