(function(){
  "use strict";

  // Renders the System Update page
  window.renderSystemUpdate = function() {
    return `
      <div class="container py-3">
        <div class="glass-card p-3 shadow-soft">
          <h5 class="mb-2"><i class="bi bi-arrow-repeat"></i> <span data-i18n="ui:system_update.title">System Update</span></h5>
          <p class="text-muted" data-i18n="ui:system_update.description">Fetches latest code, installs dependencies, updates database, then restarts the app.</p>
          <div class="d-flex gap-2 mb-3">
            <button id="startUpdateBtn" class="btn btn-primary"><span data-i18n="ui:system_update.start">Start Update</span></button>
            <button id="clearLogBtn" class="btn btn-outline-secondary"><span data-i18n="ui:system_update.clear_log">Clear Log</span></button>
          </div>
          <div id="updateStatus" class="small" style="white-space:pre-wrap; background:#0f172a; color:#e2e8f0; padding:12px; border-radius:6px; min-height:160px;">
            <div class="text-muted" data-i18n="ui:system_update.idle">No update in progress.</div>
          </div>
        </div>
      </div>
    `;
  };

  // Initializes page behavior
  window.initSystemUpdate = function() {
    const statusEl = document.getElementById("updateStatus");
    const startBtn = document.getElementById("startUpdateBtn");
    const clearBtn = document.getElementById("clearLogBtn");
    let es = null;

    function appendLine(line) {
      if (!statusEl) return;
      const now = new Date().toLocaleTimeString();
      statusEl.innerText += `\n[${now}] ${typeof line === 'string' ? line : JSON.stringify(line)}`;
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    clearBtn.onclick = () => {
      statusEl.innerText = "";
    };

    startBtn.onclick = async () => {
      startBtn.disabled = true;
      try {
        // Clear and show starting message
        statusEl.innerText = "";
        appendLine({ stage: 'start', message: 'Starting update...' });

        // Subscribe to status first for immediate feedback
        try {
          if (es) es.close();
        } catch (e) {}
        es = api.subscribeUpdateStatus((payload) => {
          appendLine(payload);
        });

        // Trigger update
        await api.startSystemUpdate();
      } catch (err) {
        appendLine({ stage: 'error', message: err.message || 'Failed to start update' });
      } finally {
        // Re-enable button a bit later; leave SSE open until server ends
        setTimeout(() => { startBtn.disabled = false; }, 3000);
      }
    };

    // Apply translations on init
    try { if (window.app && typeof window.app.applyTranslationsToDom === 'function') { window.app.applyTranslationsToDom(); } } catch (e) {}
  };
})();
