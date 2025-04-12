// Frame SDK Connector
// This file provides endpoints for the Farcaster Frame SDK to connect to

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Create a router for SDK-specific endpoints
export const sdkRouter = new Hono();

// Apply CORS middleware to all routes
sdkRouter.use('/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 86400,
}));

// Handle OPTIONS preflight requests - explicitly
sdkRouter.options('/*', (c) => {
  console.log('[SDK] Handling OPTIONS preflight request');
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  });
});

// Endpoint for clients to connect
sdkRouter.post('/connect', async (c) => {
  try {
    const body = await c.req.json();
    console.log('[SDK] Frame client connection attempt:', body);
    
    // Return confirmation of connection
    return c.json({
      success: true,
      message: 'Connected to Frame SDK server',
      timestamp: Date.now(),
      version: '0.0.34' // Match the installed @farcaster/frame-sdk version
    });
  } catch (error) {
    console.error('[SDK] Error in /connect endpoint:', error);
    return c.json({
      success: false,
      error: 'Failed to process connection request',
      timestamp: Date.now()
    }, 500);
  }
});

// Endpoint for frame manifest requests
sdkRouter.get('/manifest', (c) => {
  console.log('[SDK] Manifest request received');
  
  // Base URL from environment variable or fallback
  const baseUrl = process.env.BASE_URL || 'https://mintnprintv1-one.vercel.app';
  
  // This should match your public/manifest.json but with absolute URLs
  return c.json({
    name: 'AI Image Generator & NFT Minter',
    short_name: 'AI Gen',
    description: 'Generate AI images and mint them as NFTs from Farcaster',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3557B7',
    icons: [
      {
        src: `${baseUrl}/welcome.png`,
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: `${baseUrl}/welcome.png`,
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    miniapp: {
      developer: 'Frame Labs',
      website: baseUrl,
      category: 'creative',
      permissions: ['notifications']
    },
    capabilities: {
      frame: {
        action: 'view',
        post_url: '/',
        input: {
          text: {
            placeholder: 'Enter prompt...'
          }
        },
        buttons: [
          {
            label: 'Generate Image'
          }
        ]
      }
    }
  });
});

// Add API status endpoint
sdkRouter.get('/status', (c) => {
  return c.json({
    status: 'online',
    timestamp: Date.now(),
    sdk_version: '0.0.34',
    app_version: '1.0.0'
  });
});

// Add more endpoints as needed for SDK features

export default sdkRouter; 