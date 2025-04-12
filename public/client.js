// Simple Frame SDK initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Frame App');
  
  try {
    // Check if we're running in a Farcaster frame context
    if (window.frame && window.frame.isInFrame()) {
      console.log('Running in Farcaster Frame context');
      
      // Mark the app as ready
      await window.frame.ready();
      console.log('Frame ready event fired');
      
      // Handle theme
      if (window.frame.theme) {
        const currentTheme = await window.frame.theme.current();
        console.log('Current theme:', currentTheme);
        document.body.setAttribute('data-theme', currentTheme);
        
        // Subscribe to theme changes
        window.frame.theme.subscribe((theme) => {
          console.log('Theme changed:', theme);
          document.body.setAttribute('data-theme', theme);
        });
      }
    } else {
      console.log('Not running in a Farcaster Frame context');
      // Add indication that this is just a browser view
      document.getElementById('app').innerHTML += '<p><em>Note: This is the direct browser view. For full functionality, access this Frame through a Farcaster client.</em></p>';
    }
  } catch (error) {
    console.error('Error initializing Frame:', error);
    document.getElementById('error-message').style.display = 'block';
    document.getElementById('error-message').textContent = 'Error: ' + error.message;
  }
}); 