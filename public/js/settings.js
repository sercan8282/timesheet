/**
 * Settings Page - Backend Configuration
 */

const Settings = {
  async render() {
    return `
      <div class="container mt-4">
        <div class="row">
          <div class="col-md-8 mx-auto">
            <h2 class="mb-4">
              <i class="bi bi-gear"></i> Settings
            </h2>
            
            <div class="card">
              <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Backend Configuration</h5>
              </div>
              <div class="card-body">
                <form id="settingsForm">
                  <div class="mb-3">
                    <label for="backendUrlSetting" class="form-label">Backend Server URL</label>
                    <input
                      type="text"
                      class="form-control"
                      id="backendUrlSetting"
                      placeholder="https://urenregistratie.site"
                    />
                    <small class="text-muted">
                      The URL where your backend server is running. 
                      Examples: https://urenregistratie.site, http://192.168.1.100:3000
                    </small>
                  </div>
                  
                  <div class="alert alert-info" id="settingsConnectionStatus" style="display: none;">
                    <i class="bi bi-check-circle"></i> <span id="settingsStatusMessage"></span>
                  </div>
                  
                  <div class="d-grid gap-2 d-sm-flex gap-sm-2">
                    <button type="button" class="btn btn-secondary flex-sm-grow-1" id="resetSettingsBtn">
                      <i class="bi bi-arrow-counterclockwise"></i> Reset to Default
                    </button>
                    <button type="button" class="btn btn-info flex-sm-grow-1" id="testSettingsBtn">
                      <i class="bi bi-wifi"></i> Test Connection
                    </button>
                    <button type="submit" class="btn btn-primary flex-sm-grow-1">
                      <i class="bi bi-check-lg"></i> Save Settings
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            <div class="card mt-4">
              <div class="card-header bg-info text-white">
                <h5 class="mb-0">About</h5>
              </div>
              <div class="card-body">
                <p><strong>Current Backend URL:</strong></p>
                <code id="currentBackendUrl"></code>
                <hr />
                <p class="text-muted mb-0">
                  <i class="bi bi-info-circle"></i>
                  Settings are stored locally in your browser and device.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async attach() {
    const form = document.getElementById('settingsForm');
    const urlInput = document.getElementById('backendUrlSetting');
    const resetBtn = document.getElementById('resetSettingsBtn');
    const testBtn = document.getElementById('testSettingsBtn');
    const currentUrlDisplay = document.getElementById('currentBackendUrl');

    // Load current URL from AppConfig (dynamic system)
    const currentUrl = window.AppConfig ? window.AppConfig.getBackendUrl() : 'https://urenregistratie.site';
    urlInput.value = currentUrl || '';
    currentUrlDisplay.textContent = currentUrl || 'Not configured';

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = urlInput.value.trim();
      
      if (!url) {
        app.showNotification('Please enter a backend URL', 'error');
        return;
      }
      
      try {
        // Save to AppConfig (which stores in localStorage)
        if (window.AppConfig) {
          window.AppConfig.setBackendUrl(url);
          currentUrlDisplay.textContent = window.AppConfig.getBackendUrl();
          app.showNotification('Backend URL changed to: ' + url, 'success');
          console.log('[SETTINGS] Backend URL updated to:', url);
        } else {
          app.showNotification('Configuration system not ready', 'error');
        }
      } catch (error) {
        app.showNotification('Failed to save settings: ' + error.message, 'error');
      }
    });

    // Reset to default
    resetBtn.addEventListener('click', async () => {
      if (window.AppConfig) {
        window.AppConfig.setBackendUrl('https://urenregistratie.site');
        urlInput.value = 'https://urenregistratie.site';
        currentUrlDisplay.textContent = 'https://urenregistratie.site';
        app.showNotification('Reset to default backend URL', 'success');
        console.log('[SETTINGS] Reset to default backend');
      }
    });

    // Test connection
    const testConnection = async () => {
      const statusDiv = document.getElementById('settingsConnectionStatus');
      const statusMsg = document.getElementById('settingsStatusMessage');
      
      testBtn.disabled = true;
      testBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Testing...';
      
      try {
        const connected = window.AppConfig ? await window.AppConfig.testConnection() : false;
        if (connected) {
          statusDiv.className = 'alert alert-success';
          statusMsg.innerHTML = '<i class="bi bi-check-circle"></i> Connected successfully!';
        } else {
          statusDiv.className = 'alert alert-warning';
          statusMsg.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Could not connect. Check your URL.';
        }
        statusDiv.style.display = 'block';
      } catch (error) {
        statusDiv.className = 'alert alert-danger';
        statusMsg.innerHTML = '<i class="bi bi-x-circle"></i> Connection test failed: ' + error.message;
        statusDiv.style.display = 'block';
      } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="bi bi-wifi"></i> Test Connection';
      }
    };

    testBtn.addEventListener('click', testConnection);

    // Clear connection status when URL input changes
    urlInput.addEventListener('input', () => {
      const statusDiv = document.getElementById('settingsConnectionStatus');
      if (statusDiv) statusDiv.style.display = 'none';
    });
  }
};

// Register with app
if (typeof window !== 'undefined' && window.pages) {
  window.pages.settings = Settings;
}
