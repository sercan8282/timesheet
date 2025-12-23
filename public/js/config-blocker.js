/**
 * Config Blocker - Simple Version
 * Just detects Capacitor and sets a flag
 */

console.log('[BLOCKER] Loaded');

window.appReadyToInit = false;

// Global config
window.AppConfig = {
  backendUrl: localStorage.getItem('timesheet_backend_url') || null,
  getBackendUrl() { return this.backendUrl; },
  setBackendUrl(url) {
    if (!url.startsWith('http')) url = 'https://' + url;
    this.backendUrl = url;
    localStorage.setItem('timesheet_backend_url', url);
  },
  testConnection: async function() {
    if (!this.backendUrl) return false;
    try {
      const r = await fetch(this.backendUrl + '/health', { timeout: 5000 });
      return r.ok;
    } catch (e) {
      return false;
    }
  }
};

// Check Capacitor
const isCapacitor = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

if (isCapacitor && !window.AppConfig.getBackendUrl()) {
  console.log('[BLOCKER] Capacitor + no URL = show modal');
  document.addEventListener('DOMContentLoaded', showModal);
} else {
  console.log('[BLOCKER] Allow app to load');
  window.appReadyToInit = true;
}

function showModal() {
  try {
    const modal = document.getElementById('configModal');
    const input = document.getElementById('backendUrlInput');
    const testBtn = document.getElementById('testConfigBtn');
    const saveBtn = document.getElementById('saveConfigBtn');
    
    if (!modal || !input || !testBtn || !saveBtn) {
      console.error('[BLOCKER] Modal elements missing');
      window.appReadyToInit = true;
      return;
    }
    
    // Wait for Bootstrap
    const waitBoot = () => {
      if (!window.bootstrap) {
        setTimeout(waitBoot, 100);
        return;
      }
      
      const bsModal = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: false
      });
      
      testBtn.onclick = async (e) => {
        e.preventDefault();
        const url = input.value.trim();
        const status = document.getElementById('connectionStatus');
        const msg = document.getElementById('statusMessage');
        
        if (!url) {
          status.className = 'alert alert-warning';
          msg.innerHTML = 'Enter URL';
          status.style.display = 'block';
          saveBtn.disabled = true;
          return;
        }
        
        testBtn.disabled = true;
        testBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Testing...';
        
        try {
          let testUrl = url;
          if (!testUrl.startsWith('http')) testUrl = 'https://' + testUrl;
          testUrl = testUrl.replace(/\/$/, '');
          const r = await fetch(testUrl + '/health', { timeout: 5000 });
          if (r.ok) {
            status.className = 'alert alert-success';
            msg.innerHTML = '✅ Connected!';
            saveBtn.disabled = false;
          } else {
            status.className = 'alert alert-warning';
            msg.innerHTML = 'Server responded with ' + r.status;
            saveBtn.disabled = true;
          }
        } catch (err) {
          status.className = 'alert alert-danger';
          msg.innerHTML = '❌ ' + err.message;
          saveBtn.disabled = true;
        }
        status.style.display = 'block';
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="bi bi-wifi"></i> Test';
      };
      
      saveBtn.onclick = (e) => {
        e.preventDefault();
        const url = input.value.trim();
        if (!url) {
          alert('Enter URL');
          return;
        }
        window.AppConfig.setBackendUrl(url);
        bsModal.hide();
        modal.addEventListener('hidden.bs.modal', () => {
          window.appReadyToInit = true;
          if (window.app) window.app.init();
        }, { once: true });
      };
      
      bsModal.show();
    };
    
    waitBoot();
  } catch (err) {
    console.error('[BLOCKER] Error:', err);
    window.appReadyToInit = true;
  }
}
