// Farcaster Mini App SDK initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Frame App');
  
  try {
    // Check if SDK is available through different methods
    if (window.sdk) {
      console.log('Using global SDK');
      await initializeWithSDK(window.sdk);
    } else if (window.frame && window.frame.sdk) {
      console.log('Using frame.sdk');
      await initializeWithSDK(window.frame.sdk);
    } else {
      // Try importing the SDK module directly
      try {
        const { sdk } = await import('@farcaster/frame-sdk');
        if (sdk) {
          console.log('Imported SDK module');
          await initializeWithSDK(sdk);
        } else {
          throw new Error('SDK import failed to provide sdk object');
        }
      } catch (importError) {
        console.error('Failed to import SDK:', importError);
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('error-message').textContent = 'Error: Failed to load Frame SDK';
      }
    }
  } catch (error) {
    console.error('Error initializing Frame:', error);
    document.getElementById('error-message').style.display = 'block';
    document.getElementById('error-message').textContent = 'Error: ' + error.message;
  }
});

// Helper function to initialize with SDK
async function initializeWithSDK(sdk) {
  try {
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
  } catch (error) {
    console.error('Error in SDK initialization:', error);
    throw error;
  }
} 