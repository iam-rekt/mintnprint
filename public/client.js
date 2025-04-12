// Minimal Frame SDK initialization that won't cause JSON parsing errors
console.log('Loading client.js...');

// When document is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Client.js: Document loaded');
  
  try {
    // Just make sure window.sdk exists
    if (!window.sdk) {
      window.sdk = {
        actions: {
          ready: function() {
            console.log('Mock SDK ready called from client.js');
            return Promise.resolve();
          }
        }
      };
    }
    
    // Call ready immediately
    window.sdk.actions.ready().then(() => {
      console.log('SDK ready event fired from client.js');
    }).catch(err => {
      console.warn('Error calling ready:', err);
    });
  } catch (error) {
    console.error('Error in client.js:', error);
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