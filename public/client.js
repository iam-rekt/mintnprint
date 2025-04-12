// Farcaster Mini App SDK initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Frame App');
  
  try {
    // Wait for the SDK to be available (up to 2 seconds)
    const sdk = await waitForSDK();
    
    if (sdk) {
      // Call the SDK's ready method to dismiss the splash screen
      await sdk.actions.ready();
      console.log('SDK ready event fired');
      
      // Get the current theme if available
      if (sdk.theme) {
        const currentTheme = await sdk.theme.current();
        console.log('Current theme:', currentTheme);
        document.body.setAttribute('data-theme', currentTheme);
        
        // Subscribe to theme changes
        sdk.theme.subscribe((theme) => {
          console.log('Theme changed:', theme);
          document.body.setAttribute('data-theme', theme);
        });
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
function waitForSDK(timeout = 2000) {
  return new Promise((resolve) => {
    // Check if SDK is already available
    if (window.sdk) {
      console.log('SDK found immediately');
      return resolve(window.sdk);
    }
    
    // Set a timeout for waiting
    const timeoutId = setTimeout(() => {
      console.warn('SDK not found after timeout');
      resolve(null);
    }, timeout);
    
    // Set up an interval to check for SDK
    const intervalId = setInterval(() => {
      if (window.sdk) {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        console.log('SDK found during polling');
        resolve(window.sdk);
      }
    }, 100);
  });
} 