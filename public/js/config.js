/**
 * Configuration Management for Timesheet App
 * Stores and retrieves the backend server URL from localStorage
 */

const Config = {
  storageKey: 'timesheet_backend_url',
  
  /**
   * Get the current backend URL
   * Returns stored URL override if set, otherwise dynamically detects from current origin
   */
  getBackendUrl() {
    // Check if user has manually overridden the URL (e.g., for testing)
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      return stored;
    }
    
    // Default: use current origin (works for any domain/port)
    // This automatically adapts to: localhost:3000, urenregistratie.site, etc.
    return window.location.origin;
  },
  
  /**
   * Set a new backend URL
   */
  setBackendUrl(url) {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Remove trailing slash
    url = url.replace(/\/$/, '');
    
    localStoragynamic detection (remove override)
   */
  resetToDefault() {
    localStorage.removeItem(this.storageKey);
    console.log('✅ Reset to dynamic URL detection. Will use:', window.location.origin
  /**
   * Reset to default URL
   */
  resetToDefault() {
    localStorage.removeItem(this.storageKey);
  },
  
  /**
   * Make API request to backend
   */
  async apiCall(endpoint, options = {}) {
    const url = this.getBackendUrl();
    const fullUrl = url + endpoint;
    
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  },
  
  /**
   * Test connection to backend
   */
  async testConnection() {
    try {
      const url = this.getBackendUrl();
      const response = await fetch(url + '/health', {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
};

// Export for Node/CommonJS if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
}
