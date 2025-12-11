// Simple inline test - just log to console
console.log('Test script loaded');
console.log('Window object available:', typeof window);

// Test if api object exists
setTimeout(() => {
  if (typeof api !== 'undefined' && typeof api.getCompanies === 'function') {
    console.log('✓ API object found with getCompanies method');
    
    // Call getCompanies
    api.getCompanies()
      .then(companies => {
        console.log('✓ API call successful');
        console.log('Companies received:', companies);
      })
      .catch(error => {
        console.error('✗ API call failed:', error.message);
      });
  } else {
    console.error('✗ API object not found');
  }
}, 1000);
