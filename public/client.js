// Import the Frame SDK (will be loaded via the script tag in HTML)
async function initFrameApp() {
  console.log('Initializing Frame App');
  
  // Wait for the SDK to be available with unified approach
  let frameSDK;
  
  try {
    // Prioritize window.frame.sdk as recommended in docs
    if (window.frame && window.frame.sdk) {
      console.log('Using window.frame.sdk');
      frameSDK = window.frame.sdk;
    } 
    // Fallback to window.sdk if available
    else if (window.sdk) {
      console.log('Using window.sdk');
      frameSDK = window.sdk;
    } 
    // Final fallback - directly importing the SDK module
    else {
      console.log('Attempting to import SDK module');
      try {
        const module = await import('@farcaster/frame-sdk');
        frameSDK = module.default || module.sdk;
        console.log('Imported SDK module successfully');
      } catch (importError) {
        console.error('Failed to import SDK module:', importError);
      }
    }

    if (!frameSDK) {
      console.error('Frame SDK not available after all attempts');
      document.getElementById('app').innerHTML += '<p style="color:red">Frame SDK failed to load. Please try again.</p>';
      return;
    }
    
    console.log('Frame SDK initialized successfully');
    
    // Mark the app as ready to hide splash screen
    try {
      console.log('Calling sdk.actions.ready() to hide splash screen');
      await frameSDK.actions.ready({
        disableNativeGestures: false
      });
      console.log('Splash screen hidden successfully');
    } catch (readyError) {
      console.error('Error hiding splash screen:', readyError);
    }
    
    // Connect to server SDK endpoint
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
        console.warn('Failed to connect to server SDK endpoint:', await response.text());
      }
    } catch (error) {
      console.warn('Error connecting to server SDK endpoint:', error);
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
    console.error('Error in Frame SDK initialization:', error);
    document.getElementById('app').innerHTML += '<p style="color:red">Error initializing Frame: ' + error.message + '</p>';
  }
}

// Initialize when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFrameApp);
} else {
  initFrameApp();
} 