// Extremely simple client code - no API calls or JSON parsing
console.log('Loading simplified client.js');

// When the document loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Client.js: Document loaded successfully');
  
  // Set up mock SDK if needed
  if (!window.sdk) {
    window.sdk = {
      actions: {
        ready: function() {
          console.log('Mock SDK ready called');
          return Promise.resolve();
        }
      }
    };
  }
  
  // Call SDK ready
  if (window.sdk && window.sdk.actions && typeof window.sdk.actions.ready === 'function') {
    window.sdk.actions.ready()
      .then(function() {
        console.log('SDK ready success');
      })
      .catch(function(err) {
        console.warn('SDK ready error (ignoring):', err);
      });
  }
});

// Helper function to wait for SDK to be available
function waitForSDK(timeout = 5000) {
  return new Promise((resolve) => {
    // Check common SDK locations
    function checkForSDK() {
      // Check different possible locations for the SDK
      if (window.sdk) {
        console.log('SDK found at window.sdk');
        return window.sdk;
      }
      
      if (window.frame && window.frame.sdk) {
        console.log('SDK found at window.frame.sdk');
        return window.frame.sdk;
      }
      
      if (window.farcaster && window.farcaster.sdk) {
        console.log('SDK found at window.farcaster.sdk');
        return window.farcaster.sdk;
      }
      
      console.log('No SDK found, locations checked:', 
        'window.sdk=', typeof window.sdk, 
        'window.frame=', typeof window.frame, 
        'window.farcaster=', typeof window.farcaster);
      
      return null;
    }
    
    // Check immediately first
    const immediateSDK = checkForSDK();
    if (immediateSDK) {
      return resolve(immediateSDK);
    }
    
    // Set a timeout for waiting
    const timeoutId = setTimeout(() => {
      console.warn('SDK not found after timeout');
      clearInterval(intervalId);
      resolve(null);
    }, timeout);
    
    // Set up an interval to check for SDK
    const intervalId = setInterval(() => {
      const foundSDK = checkForSDK();
      if (foundSDK) {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        console.log('SDK found during polling');
        resolve(foundSDK);
      }
    }, 200);
  });
} 