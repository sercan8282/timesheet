/**
 * Early Configuration Initialization
 * Runs BEFORE app.js to show config modal on Capacitor/mobile
 */

(function() {
  // Only on Capacitor/mobile
  if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) {
    console.log('[CONFIG] Not running on Capacitor, skipping config modal');
    return;
  }
  
  console.log('[CONFIG] Capacitor detected, will show config modal before app loads');
  
  // Create a blocking promise that only resolves when user saves config
  window.configReady = new Promise((resolve) => {
    // Wait for DOM to be ready
    const waitForDOM = () => {
      const modal = document.getElementById('configModal');
      const input = document.getElementById('backendUrlInput');
      const testBtn = document.getElementById('testConfigBtn');
      
      if (!modal || !input || !testBtn) {
        setTimeout(waitForDOM, 50);
        return;
      }
      
      if (!window.Config) {
        setTimeout(waitForDOM, 50);
        return;
      }
      
      if (!window.bootstrap) {
        setTimeout(waitForDOM, 50);
        return;
      }
      
      // All ready, show config modal
      showConfigModal(resolve);
    };
    
    waitForDOM();
  });
  
  function showConfigModal(resolve) {
    console.log('[CONFIG] Showing config modal...');
    
    const modal = document.getElementById('configModal');
    const input = document.getElementById('backendUrlInput');
    const testBtn = document.getElementById('testConfigBtn');
    const saveBtn = document.getElementById('saveConfigBtn');
    const resetBtn = document.getElementById('resetConfigBtn');
    
    // Set current URL
    input.value = Config.getBackendUrl();
    
    // Create Bootstrap modal
    const bsModal = new bootstrap.Modal(modal, {
      backdrop: 'static',
      keyboard: false
    });
    
    // Test connection handler
    const handleTest = async () => {
      const statusDiv = document.getElementById('connectionStatus');
      const statusMsg = document.getElementById('statusMessage');
      
      testBtn.disabled = true;
      testBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Testing...';
      
      try {
        const url = input.value.trim();
        if (!url) {
          statusDiv.className = 'alert alert-warning';
          statusMsg.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Please enter a URL first';
        } else {
          const connected = await Config.testConnection();
          if (connected) {
            statusDiv.className = 'alert alert-success';
            statusMsg.innerHTML = '<i class="bi bi-check-circle"></i> Connected successfully!';
          } else {
            statusDiv.className = 'alert alert-warning';
            statusMsg.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Could not connect to this URL';
          }
        }
      } catch (error) {
        statusDiv.className = 'alert alert-danger';
        statusMsg.innerHTML = '<i class="bi bi-x-circle"></i> Error: ' + error.message;
      }
      
      statusDiv.style.display = 'block';
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="bi bi-wifi"></i> Test Connection';
    };
    
    // Save handler
    const handleSave = () => {
      const url = input.value.trim();
      if (!url) {
        alert('Please enter a backend URL');
        return;
      }
      
      Config.setBackendUrl(url);
      console.log('[CONFIG] Saved URL:', url);
      
      // Close modal and resolve
      bsModal.hide();
      
      // Resolve after modal hidden event
      modal.addEventListener('hidden.bs.modal', () => {
        console.log('[CONFIG] Modal closed, allowing app to initialize');
        resolve();
      }, { once: true });
    };
    
    // Reset handler
    const handleReset = () => {
      Config.resetToDefault();
      input.value = Config.getBackendUrl();
      document.getElementById('connectionStatus').style.display = 'none';
      console.log('[CONFIG] Reset to default:', Config.getBackendUrl());
    };
    
    // Attach handlers
    testBtn.onclick = handleTest;
    saveBtn.onclick = handleSave;
    resetBtn.onclick = handleReset;
    
    // Show modal
    bsModal.show();
    
    // Auto test on open
    setTimeout(handleTest, 700);
  }
})();
