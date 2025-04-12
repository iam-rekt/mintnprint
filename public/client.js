// Import the Frame SDK (will be loaded via the script tag in HTML)
async function initFrameApp() {
  // Wait for the SDK to be available (if loaded via script tag)
  let frameSDK;
  try {
    // Check if using CDN (accessed via frame.sdk)
    if (window.frame && window.frame.sdk) {
      frameSDK = window.frame.sdk;
    } else if (window.sdk) {
      // Fallback to direct SDK access
      frameSDK = window.sdk;
    } else {
      // Fallback attempt to import from node_modules
      const module = await import('@farcaster/frame-sdk');
      frameSDK = module.sdk;
    }

    if (!frameSDK) {
      console.error('Frame SDK not available');
      return;
    }
    
    console.log('Frame SDK initialized');
    
    // Mark the app as ready FIRST to hide splash screen as soon as possible
    try {
      console.log('Calling sdk.actions.ready() to hide splash screen');
      await frameSDK.actions.ready({
        disableNativeGestures: false // Set to true if your app has custom gestures
      });
      console.log('Splash screen hidden');
    } catch (readyError) {
      console.error('Error hiding splash screen:', readyError);
    }
    
    // Connect to our server SDK endpoint AFTER ready is called
    try {
      const response = await fetch('/sdk/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: 'web-client-' + Math.random().toString(36).substring(2, 10),
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        console.log('Connected to server SDK endpoint');
      } else {
        console.warn('Failed to connect to server SDK endpoint, but continuing');
      }
    } catch (error) {
      console.warn('Error connecting to server SDK endpoint, but continuing:', error);
    }
    
    // Listen for frame events
    frameSDK.registerEvents({
      onMessage: (data) => {
        console.log('Message received:', data);
      },
      onClose: () => {
        console.log('Frame closed');
      }
    });
    
    // Subscribe to theme changes
    frameSDK.theme.subscribe((theme) => {
      console.log('Theme changed:', theme);
      // Apply theme changes to your app
      document.body.setAttribute('data-theme', theme);
    });
  } catch (error) {
    console.error('Error initializing Frame SDK:', error);
  }
}

// Initialize when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFrameApp);
} else {
  initFrameApp();
} 