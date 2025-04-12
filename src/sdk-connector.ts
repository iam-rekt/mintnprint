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

// Handle OPTIONS preflight requests
sdkRouter.options('/*', (c) => {
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
  const body = await c.req.json();
  console.log('Frame client connection attempt:', body);
  
  // Return confirmation of connection
  return c.json({
    success: true,
    message: 'Connected to Frame SDK server',
    timestamp: Date.now()
  });
});

// Endpoint for frame manifest requests
sdkRouter.get('/manifest', (c) => {
  // This should match your public/manifest.json
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
        src: '/image?image=welcome',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/image?image=welcome',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    miniapp: {
      developer: 'Frame Labs',
      website: 'https://mintnprintv1.vercel.app',
      category: 'creative',
      permissions: ['notifications']
    }
  });
});

// Add more endpoints as needed for SDK features

export default sdkRouter; 