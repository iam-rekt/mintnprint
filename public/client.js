// Farcaster Mini App SDK initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Frame App');
  
  try {
    // Wait for the SDK to be available (up to 5 seconds)
    const sdk = await waitForSDK(5000);
    
    if (sdk) {
      // Call the SDK's ready method to dismiss the splash screen
      await sdk.actions.ready();
      console.log('SDK ready event fired');
      
      // Get the current theme if available
      if (sdk.theme) {
        try {
          const currentTheme = await sdk.theme.current();
          console.log('Current theme:', currentTheme);
          document.body.setAttribute('data-theme', currentTheme);
          
          // Subscribe to theme changes
          sdk.theme.subscribe((theme) => {
            console.log('Theme changed:', theme);
            document.body.setAttribute('data-theme', theme);
          });
        } catch (themeError) {
          console.warn('Theme API error:', themeError);
        }
      }
    } else {
      throw new Error('SDK not found after timeout');
    }
  } catch (error) {
    console.error('Error initializing Frame:', error);
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.style.display = 'block';
      errorElement.textContent = 'Error: ' + error.message;
    }
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