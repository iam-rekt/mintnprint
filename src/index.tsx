import React from 'react';
import 'dotenv/config';
import { Frog, Button, TextInput } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import OpenAI from 'openai';
import { setOnchainKitConfig } from '@coinbase/onchainkit';
import { buildMintTransaction, buildPayTransaction, type BuildMintTransactionResponse, type BuildPayTransactionResponse } from '@coinbase/onchainkit/api';
// Add NFT minting components
import { NFTMintCardDefault } from '@coinbase/onchainkit/nft';
import { NFTMedia } from '@coinbase/onchainkit/nft/view';
import {
  NFTCreator,
  NFTCollectionTitle,
  NFTQuantitySelector,
  NFTAssetCost,
  NFTMintButton,
} from '@coinbase/onchainkit/nft/mint';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAuth } from 'google-auth-library';
import type { Context } from 'hono';
// Import our SDK connector
import sdkRouter from './sdk-connector.js';

// Configure OnchainKit with CDP API Key only if it exists
if (process.env.CDP_API_KEY) {
  console.log('Configuring OnchainKit with CDP API Key');
  setOnchainKitConfig({ apiKey: process.env.CDP_API_KEY });
} else {
  console.warn('CDP_API_KEY environment variable not set. Minting will be disabled.');
}

// Initialize OpenAI client (validation will happen at runtime)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add type definitions for our stores
type ShippingInfo = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

type OrderInfo = {
  productType: string;
  size: string;
  price: number;
  shipping: ShippingInfo;
  purchaseCompleted?: boolean;
  transactionHash?: string;
};

type ImageInfo = {
  url: string;
  tokenUri?: string;
  productType?: string;
  size?: string;
};

// Temporary in-memory store (replace for production)
const imageStore: Record<string, ImageInfo> = {};
const orderStore: Record<string, OrderInfo> = {};

// Price constants in USD cents with base cost and markup
type PriceStructure = {
  basePrice: number;  // What Printify charges you
  markup: number;     // Your profit
  total: number;      // What customers pay
};

const PRICES: Record<string, PriceStructure> = {
  tshirt: {
    basePrice: 1499,  // $14.99 base cost
    markup: 1000,     // $10.00 profit margin
    total: 2499       // $24.99 total price
  },
  hoodie: {
    basePrice: 2499,  // $24.99 base cost
    markup: 1500,     // $15.00 profit margin 
    total: 3999       // $39.99 total price
  },
  mug: {
    basePrice: 999,   // $9.99 base cost
    markup: 500,      // $5.00 profit margin
    total: 1499       // $14.99 total price
  }
};

// Service fee (optional)
const SERVICE_FEE_PERCENTAGE = 5; // 5% service fee

// Placeholder for NFT Contract Address (replace with your deployed contract)
// For now, we'll set it to null to indicate it's not configured
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || null;
const NFT_NETWORK = process.env.NFT_NETWORK || 'base-sepolia-testnet';

// Path to local error image
const ERROR_IMAGE_PATH = '/public/error-image.svg';
// Base URL for the server (will be dynamic in production)
const BASE_URL = process.env.BASE_URL || 'https://frames-dev.ngrok.io/f/3000';  // Using frames.dev proxy
const ERROR_IMAGE_FULL_URL = `${BASE_URL}${ERROR_IMAGE_PATH}`;

// Constants for Printify
const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const PRINTIFY_DEFAULT_TSHIRT_BLUEPRINT = process.env.PRINTIFY_DEFAULT_TSHIRT_BLUEPRINT || '5d40b179d01f676456a0bbcd'; // Example: Gildan 64000 T-shirt

// Type interfaces for Printify
interface PrintifyAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

interface PrintifyPaymentDetails {
  method: string;
  transaction_id: string;
}

// NFT royalty settings
const NFT_ROYALTY_PERCENTAGE = 10; // 10% royalty on secondary sales
const NFT_MINT_PRICE = 500; // $5.00 mint price (in cents)

// Add mint price configuration
const MINT_PRICE_WEI = process.env.MINT_PRICE_WEI || '10000000000000000'; // Default 0.01 ETH

// Define our custom environment type
type CustomEnv = {
  Variables: {
    frameMeta?: {
      message: string;
    };
  };
};

// Initialize app with Frog
const app = new Frog({
  assetsPath: '/',
  basePath: '/',  // Important: BasePath set to root for frame URLs
  browserLocation: '/',
  title: 'AI Image Generator & NFT Minter',
  verify: false
});

// Register our SDK connector router
app.hono.route('/sdk', sdkRouter);

// --- SIMPLIFIED MIDDLEWARE: Replace all other middleware with this ---
app.hono.use('*', async (c, next) => {
  // Log all incoming requests for debugging
  console.log(`[DEBUG] Incoming request: ${c.req.method} ${c.req.url}`);
  console.log(`[DEBUG] Headers: ${JSON.stringify(c.req.header())}`);
  
  // Set all headers once
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', '*');
  c.header('ngrok-skip-browser-warning', '1');
  
  // Handle OPTIONS preflight requests - CRITICAL for Frame validation
  if (c.req.method === 'OPTIONS') {
    console.log('[DEBUG] Handling OPTIONS preflight request');
    return new Response(null, { 
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'ngrok-skip-browser-warning': '1'
      }
    });
  }
  
  // Proceed to next middleware/handler
  await next();
});
// --- End Simplified Middleware ---

// Add secondary debug logging (Optional) - Moved AFTER static serving
app.hono.use('*', async (c, next) => {
  console.log(`[DEBUG] Path: ${c.req.path}, User-Agent: ${c.req.header('user-agent') || 'N/A'}`);
  await next();
});

// Add this debug log
console.log('Registering root frame handler');
console.log(`Using BASE_URL: ${process.env.BASE_URL}`);
console.log(`Using ngrok subdomain: ${process.env.NGROK_SUBDOMAIN}`);

// Add a standalone HTML endpoint for direct browser access
app.hono.get('/', (c) => {
  console.log('[ROOT_HANDLER] Serving root HTML (minimal)');
  
  // Set important headers
  c.header('Content-Type', 'text/html');
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', '*');
  
  // Base URL from environment variable or fallback
  const baseUrl = process.env.BASE_URL || 'https://mintnprintv1-one.vercel.app';
  
  // Minimal HTML for browser visits, letting Frog handle frame logic
  return c.body(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Image Generator & NFT Minter Frame</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#3557B7">
  <!-- Optional: Add SDK endpoint if needed for other integrations -->
  <meta name="sdk:endpoint" content="/sdk">
  <meta name="sdk:version" content="0.8.0">
  <meta name="miniapp:manifest" content="/sdk/manifest">
  <!-- Load client-side JS if needed for browser interactions -->
  <script type="module" src="/client.js"></script>
</head>
<body>
  <div id="app">
    <h1>AI Image Generator & NFT Minter</h1>
    <p>This is a Farcaster Frame. Please use it within a Farcaster client like Warpcast.</p>
  </div>
</body>
</html>`);
});

// Add a diagnostic endpoint to test image serving
app.hono.get('/debug-image', (c) => {
  console.log('[DEBUG_IMAGE] Testing image serving');
  
  // Base URL from environment variable or fallback
  const baseUrl = process.env.BASE_URL || 'https://mintnprintv1-one.vercel.app';
  const welcomeImageUrl = `${baseUrl}/welcome.png`;
  const testImageUrl = `${baseUrl}/test-image.svg`;
  
  // HTML for testing image serving
  return c.html(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Serving Diagnostic</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .image-test { margin-bottom: 30px; border: 1px solid #ccc; padding: 15px; border-radius: 5px; }
    img { max-width: 100%; height: auto; display: block; margin: 10px 0; }
    pre { background: #f5f5f5; padding: 10px; overflow: auto; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Image Serving Diagnostic</h1>
  
  <div class="image-test">
    <h2>Welcome Image Test</h2>
    <p>URL: ${welcomeImageUrl}</p>
    <img src="${welcomeImageUrl}" alt="Welcome Image" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmMDAwMCIgLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMjQiPkltYWdlIEVycm9yPC90ZXh0Pjwvc3ZnPg=='; this.after(document.createTextNode('❌ Image failed to load'));" />
  </div>
  
  <div class="image-test">
    <h2>Test Image Test</h2>
    <p>URL: ${testImageUrl}</p>
    <img src="${testImageUrl}" alt="Test Image" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmMDAwMCIgLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMjQiPkltYWdlIEVycm9yPC90ZXh0Pjwvc3ZnPg=='; this.after(document.createTextNode('❌ Image failed to load'));" />
  </div>
  
  <div class="image-test">
    <h2>Environment Information</h2>
    <pre>
BASE_URL: ${process.env.BASE_URL || 'not set'}
NODE_ENV: ${process.env.NODE_ENV || 'not set'}
PORT: ${process.env.PORT || '3000 (default)'}
Has OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}
</pre>
  </div>
</body>
</html>`);
});

// Set up dev tools if not in production
if (process.env.NODE_ENV !== 'production') {
  // Pass the serveStatic function correctly
  devtools(app, { serveStatic });
}

// IMPORTANT: Serve static files from public directory for both prod and dev
app.hono.use('/*', serveStatic({ root: './public' }));

// Error frame component for consistent error display
function ErrorFrame(message: string) {
  return (
    <div style={{ 
      color: 'white', 
      display: 'flex', 
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 40, 
      padding: '40px', 
      backgroundColor: '#E53935',
      height: '100%',
      width: '100%'
    }}>
      <div style={{ 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '60px', marginBottom: '20px', display: 'flex' }}>⚠️</div>
        <div style={{ display: 'flex' }}>{message}</div>
      </div>
    </div>
  );
}

// Initial frame: Prompt for image generation
app.frame('/', (c) => {
  console.log('Frame root handler invoked - for frame interactions only');
  console.log('Request header:', JSON.stringify(c.req.header(), null, 2));
  
  // Reset any stored image for this user when showing the initial frame
  // A better approach would use fid or a session identifier
  delete imageStore['user']; 
  
  const baseUrl = process.env.BASE_URL || 'https://mintnprintv1-one.vercel.app';
  const welcomeImageUrl = `${baseUrl}/welcome.png`;
  
  console.log(`[INITIAL_FRAME] Using welcome image: ${welcomeImageUrl}`);
  
  // This route will handle POST requests from Farcaster frames
  // when users click buttons or submit input
  const response = c.res({
    image: welcomeImageUrl,
    intents: [
      <TextInput placeholder="A cat astronaut in space..." />,
      <Button action="/generate">Generate</Button>,
    ],
  });
  
  console.log('Response:', JSON.stringify(response, null, 2));
  return response;
});

// Frame for displaying the generated image and mint/print options
app.frame('/generate', async (c) => {
  const { inputText } = c;
  const prompt = inputText || 'A default image prompt';
  const userAddress = c.frameData?.address as `0x${string}` | undefined;

  console.log(`[GENERATE] Received generation request with prompt: "${prompt}"`);
  console.log(`[GENERATE] User address: ${userAddress || 'Not connected'}`);

  const baseUrl = process.env.BASE_URL || 'https://mintnprintv1-one.vercel.app';
  let imageUrl = '';
  let error = null;

  // If no OpenAI API key, use fallback test image
  if (!process.env.OPENAI_API_KEY) {
    console.log('[GENERATE] No OpenAI API key configured, using test image');
    imageUrl = `${baseUrl}/test-image.svg`;
  } else {
    try {
      console.log(`[OPENAI_IMAGE] Generating image with prompt: ${prompt}`);
      
      // Use OpenAI's DALL-E to generate the image
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url"
      });

      // Get the image URL from the response
      if (!response.data || response.data.length === 0) {
        throw new Error('No image generated');
      }

      const generatedImage = response.data[0];
      if (!generatedImage.url) {
        throw new Error('No image URL in the response');
      }

      imageUrl = generatedImage.url;
      console.log(`[OPENAI_IMAGE] Got image URL: ${imageUrl.substring(0, 50)}...`);
      
      // Generate a unique timestamp for the filename
      const timestamp = Date.now();
      const imageName = `generated-${timestamp}.png`;
      const imagePath = path.join(process.cwd(), 'public', imageName);
      
      // Download the image
      console.log(`[OPENAI_IMAGE] Downloading image to ${imagePath}`);
      try {
        const imageResponse = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000, // Increased timeout
          validateStatus: (status) => status === 200 // Only accept 200 responses
        });

        // Save the image
        await fs.promises.writeFile(imagePath, imageResponse.data);
        
        // Use the saved file URL with absolute path
        imageUrl = `${baseUrl}/${imageName}`;
        console.log(`[OPENAI_IMAGE] Generated image saved at: ${imageUrl}`);
      } catch (downloadErr) {
        console.error('[OPENAI_IMAGE] Error downloading image:', downloadErr);
        // Still use the direct OpenAI URL if download fails
        console.log('[OPENAI_IMAGE] Using direct OpenAI URL instead');
      }
    } catch (err) {
      console.error('[OPENAI_IMAGE] Error generating image:', err);
      error = err instanceof Error ? err.message : 'Image generation failed';
      
      // Use the test image as fallback
      console.log('[OPENAI_IMAGE] Using test image due to error');
      imageUrl = `${baseUrl}/test-image.svg`;
    }
  }

  // Log the final image URL
  console.log(`[GENERATE] Final image URL: ${imageUrl}`);

  // Store the image URL regardless of source
  imageStore['user'] = { url: imageUrl };

  // Build intents based on available features
  const intents = [];
  
  // Show create collection button if no contract configured
  if (!NFT_CONTRACT_ADDRESS && userAddress) {
    intents.push(<Button.Link href="https://wallet.coinbase.com/nft/create">Create Collection</Button.Link>);
  } else if (NFT_CONTRACT_ADDRESS && userAddress) {
    // Show mint button if contract is configured and wallet connected
    intents.push(<Button action="/mint">Mint NFT</Button>);
  }
  
  // Always show Print button
  intents.push(<Button action="/print">Print Merch</Button>);
  
  // Always show Reset button
  intents.push(<Button.Reset>Reset</Button.Reset>);
  
  // Success response
  console.log(`[GENERATE] Serving frame with image URL: ${imageUrl}`);
  return c.res({
    image: imageUrl,
    imageAspectRatio: "1:1",
    intents,
  });
});

// Add transaction verification function
async function verifyTransaction(txHash: string): Promise<boolean> {
  console.log(`Verifying transaction: ${txHash}`);
  // Replace with actual transaction verification logic
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay
  console.log(`Transaction ${txHash} verified (simulated)`);
  try {
    // Use Base network's public RPC to check transaction status
    const response = await axios.post('https://mainnet.base.org', {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [txHash]
    });

    // If we get a receipt and status is 1, transaction was successful
    return response.data?.result?.status === '0x1';
  } catch (error) {
    console.error('[VERIFY_TX] Error:', error);
    return false;
  }
}

// Update mint frame to show price
app.frame('/mint', async (c) => {
  const { frameData } = c;
  const userAddress = frameData?.address;
  const imageUrl = imageStore['user']?.url;

  if (!imageUrl) {
    return c.res({
      image: (
        <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 40, padding: '20px', backgroundColor: '#EF4444', height: '100%', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>❌ Error</div>
          <div style={{ fontSize: '24px', textAlign: 'center' }}>No image found to mint</div>
        </div>
      ),
      intents: [<Button.Reset>Try Again</Button.Reset>]
    });
  }

  if (!userAddress) {
    return c.res({
      image: (
        <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 40, padding: '20px', backgroundColor: '#EF4444', height: '100%', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>❌ Error</div>
          <div style={{ fontSize: '24px', textAlign: 'center' }}>Please connect your wallet</div>
        </div>
      ),
      intents: [<Button.Reset>Try Again</Button.Reset>]
    });
  }

  // Convert wei to ETH for display
  const mintPriceEth = (Number(MINT_PRICE_WEI) / 1e18).toString();

  return c.res({
    action: '/mint-complete',
    image: (
      <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 40, padding: '20px', backgroundColor: '#3557B7', height: '100%', width: '100%' }}>
        <div style={{ marginBottom: '20px' }}>🎉 NFT Ready!</div>
        <div style={{ fontSize: '24px', textAlign: 'center', marginBottom: '10px' }}>Mint Price: {mintPriceEth} ETH</div>
        <div style={{ fontSize: '20px', textAlign: 'center' }}>Sign the transaction in your wallet to mint</div>
      </div>
    ),
    intents: [
      <Button.Transaction target="/mint-tx">Sign & Mint ({mintPriceEth} ETH)</Button.Transaction>,
      <Button action="/print">Skip & Print</Button>,
      <Button.Reset>Cancel</Button.Reset>
    ]
  });
});

// Update mint transaction handler to include payment
app.transaction('/mint-tx', async (c) => {
  const { frameData } = c;
  const userAddress = frameData?.address;
  const imageUrl = imageStore['user']?.url;

  if (!userAddress || !imageUrl) {
    throw new Error('Missing required data for minting');
  }

  if (!process.env.NFT_CONTRACT_ADDRESS) {
    throw new Error('NFT contract address not configured');
  }

  try {
    // Build the mint transaction for Zora's contract
    const mintTx = {
      to: process.env.NFT_CONTRACT_ADDRESS as `0x${string}`,
      data: '0x6a627842' as `0x${string}`,
      value: BigInt(MINT_PRICE_WEI)  // Set mint price
    };

    // Send the transaction
    return c.send({
      chainId: "eip155:8453", // Base Mainnet
      to: mintTx.to,
      data: mintTx.data,
      value: mintTx.value
    });
  } catch (error: any) {
    console.error('[MINT_TX] Error:', error);
    // Check for specific error types
    if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient funds to complete the mint');
    } else if (error.message?.includes('user rejected')) {
      throw new Error('Transaction was rejected by user');
    } else if (error.message?.includes('nonce')) {
      throw new Error('Transaction nonce error - please try again');
    }
    throw error;
  }
});

// Update mint completion handler to verify transaction
app.frame('/mint-complete', async (c) => {
  const { transactionId } = c;

  if (transactionId) {
    // Verify the transaction
    const isSuccess = await verifyTransaction(transactionId);
    
    if (!isSuccess) {
      return c.res({
        image: (
          <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 40, padding: '20px', backgroundColor: '#EF4444', height: '100%', width: '100%' }}>
            <div style={{ marginBottom: '20px' }}>❌ Minting Failed</div>
            <div style={{ fontSize: '24px', textAlign: 'center', marginBottom: '10px' }}>Transaction failed on-chain</div>
            <div style={{ fontSize: '20px', textAlign: 'center' }}>Would you like to try again?</div>
          </div>
        ),
        intents: [
          <Button action="/mint">Try Again</Button>,
          <Button action="/print">Skip to Print</Button>,
          <Button.Reset>Cancel</Button.Reset>
        ]
      });
    }

    // Store the transaction ID
    const userId = 'user';
    if (!imageStore[userId]) {
      imageStore[userId] = { url: '' };
    }
    imageStore[userId].tokenUri = transactionId;

    return c.res({
      image: (
        <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 40, padding: '20px', backgroundColor: '#22C55E', height: '100%', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>✨ NFT Minting Success!</div>
          <div style={{ fontSize: '24px', textAlign: 'center', marginBottom: '10px' }}>Transaction ID: {transactionId.slice(0, 10)}...</div>
          <div style={{ fontSize: '20px', textAlign: 'center' }}>Ready to order merchandise?</div>
        </div>
      ),
      intents: [
        <Button action="/print">Order Merch</Button>,
        <Button.Link href={`https://basescan.org/tx/${transactionId}`}>View Transaction</Button.Link>,
        <Button.Reset>Start Over</Button.Reset>
      ]
    });
  } else {
    return c.res({
      image: (
        <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 40, padding: '20px', backgroundColor: '#EF4444', height: '100%', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>❌ Minting Failed</div>
          <div style={{ fontSize: '24px', textAlign: 'center', marginBottom: '10px' }}>Transaction not found</div>
          <div style={{ fontSize: '20px', textAlign: 'center' }}>Would you like to try again?</div>
        </div>
      ),
      intents: [
        <Button action="/mint">Try Again</Button>,
        <Button action="/print">Skip to Print</Button>,
        <Button.Reset>Cancel</Button.Reset>
      ]
    });
  }
});

// Shipping information collection
app.frame('/print/shipping-address', (c) => {
  const userId = 'user';
  const orderInfo = orderStore[userId];
  const imageUrl = imageStore[userId]?.url;
  
  if (!orderInfo || !imageUrl || !orderInfo.purchaseCompleted) {
    return c.res({ 
      image: ErrorFrame('Payment must be completed first. Please start over.'), 
      intents: [ <Button.Reset>Reset</Button.Reset> ] 
    });
  }
  
  // For shipping collection, we'll need to redirect to a web page
  // as Frames don't support complex form input
  
  // Create a checkout link with parameters for shipping
  const checkoutParams = new URLSearchParams({
    image_url: imageUrl,
    product_type: orderInfo.productType,
    size: orderInfo.size,
    tx_hash: orderInfo.transactionHash || 'unknown',
  });
  
  const shippingUrl = `${BASE_URL}/shipping?${checkoutParams.toString()}`;
  
  return c.res({
    image: (
      <div style={{ 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40, 
        padding: '20px', 
        backgroundColor: '#3557B7',
        height: '100%',
        width: '100%'
      }}>
        <div style={{ marginBottom: '20px', display: 'flex' }}>🚚 Final Step</div>
        <div style={{ fontSize: '30px', textAlign: 'center', display: 'flex' }}>Enter Shipping Details</div>
      </div>
    ),
    intents: [
      <Button.Link href={shippingUrl}>Enter Shipping Details</Button.Link>,
      <Button.Reset>Start Over</Button.Reset>,
    ]
  });
});

// Shipping information page (web)
app.get('/shipping', (c) => {
  const { image_url, product_type, size, tx_hash } = c.req.query();
  
  if (!image_url || !product_type || !size) {
    return c.html(`
      <html>
        <head>
          <title>Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 40px auto; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Error</h1>
            <p>Missing required parameters for shipping.</p>
            <a href="javascript:history.back()">Go Back</a>
          </div>
        </body>
      </html>
    `);
  }
  
  return c.html(`
    <html>
      <head>
        <title>Complete Your Order</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1, h2 { color: #3557B7; }
          .product-image { width: 100%; max-width: 300px; height: auto; display: block; margin: 20px auto; border-radius: 5px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
          button { background: #3557B7; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-size: 16px; }
          button:hover { background: #2a4590; }
          .product-details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .separator { margin: 30px 0; border-top: 1px solid #eee; }
          .success-badge { background-color: #2ecc71; color: white; padding: 5px 10px; border-radius: 4px; font-size: 14px; display: inline-block; margin-bottom: 15px; }
          .error-message { color: #e74c3c; margin-top: 15px; padding: 10px; border-radius: 4px; background-color: #fceaea; display: none; }
          .loading { display: none; text-align: center; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Enter Shipping Information</h1>
          
          <div class="product-details">
            <div class="success-badge">Payment Successful</div>
            <h2>Order Summary</h2>
            <img src="${image_url}" alt="Generated Image" class="product-image">
            <p><strong>Product:</strong> ${product_type.charAt(0).toUpperCase() + product_type.slice(1)}</p>
            <p><strong>Size:</strong> ${size}</p>
            <p><strong>Payment Transaction:</strong> ${tx_hash || 'Confirmed'}</p>
          </div>
          
          <form id="shipping-form">
            <input type="hidden" name="image_url" value="${image_url}">
            <input type="hidden" name="product_type" value="${product_type}">
            <input type="hidden" name="size" value="${size}">
            <input type="hidden" name="tx_hash" value="${tx_hash || ''}">
            
            <h2>Shipping Information</h2>
            
            <div class="form-group">
              <label for="first_name">First Name</label>
              <input type="text" id="first_name" name="first_name" required>
            </div>
            
            <div class="form-group">
              <label for="last_name">Last Name</label>
              <input type="text" id="last_name" name="last_name" required>
            </div>
            
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required>
            </div>
            
            <div class="form-group">
              <label for="phone">Phone</label>
              <input type="tel" id="phone" name="phone" required>
            </div>
            
            <div class="form-group">
              <label for="address1">Address Line 1</label>
              <input type="text" id="address1" name="address1" required>
            </div>
            
            <div class="form-group">
              <label for="address2">Address Line 2 (Optional)</label>
              <input type="text" id="address2" name="address2">
            </div>
            
            <div class="form-group">
              <label for="city">City</label>
              <input type="text" id="city" name="city" required>
            </div>
            
            <div class="form-group">
              <label for="zip">ZIP / Postal Code</label>
              <input type="text" id="zip" name="zip" required>
            </div>
            
            <div class="form-group">
              <label for="country">Country</label>
              <select id="country" name="country" required>
                <option value="">Select Country</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <!-- Add more countries as needed -->
              </select>
            </div>
            
            <div class="form-group">
              <label for="region">State / Province / Region</label>
              <input type="text" id="region" name="region" required>
            </div>
            
            <div class="error-message" id="error-message"></div>
            <div class="loading" id="loading">Processing your order...</div>
            
            <button type="submit">Complete Order</button>
          </form>
          
          <script>
            document.getElementById('shipping-form').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              // Show loading, hide any previous errors
              document.getElementById('loading').style.display = 'block';
              document.getElementById('error-message').style.display = 'none';
              
              const formData = new FormData(e.target);
              const formDataObj = Object.fromEntries(formData.entries());
              
              try {
                const response = await fetch('/api/complete-order', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(formDataObj),
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                  // Redirect to confirmation page
                  window.location.href = '/order-confirmation?order_id=' + encodeURIComponent(result.orderId);
                } else {
                  // Show error
                  const errorMsg = result.error || 'There was an error processing your order. Please try again.';
                  document.getElementById('error-message').textContent = errorMsg;
                  document.getElementById('error-message').style.display = 'block';
                  document.getElementById('loading').style.display = 'none';
                }
              } catch (error) {
                console.error('Error:', error);
                document.getElementById('error-message').textContent = 'Network error. Please check your connection and try again.';
                document.getElementById('error-message').style.display = 'block';
                document.getElementById('loading').style.display = 'none';
              }
            });
          </script>
        </div>
      </body>
    </html>
  `);
});

// API endpoint to handle order completion with shipping details
app.post('/api/complete-order', async (c) => {
  try {
    const body = await c.req.json();
    const { image_url, product_type, size, tx_hash, ...shippingDetails } = body;
    
    console.log(`[ORDER] Processing order with Printify API`);
    console.log(`[ORDER] API Key configured: ${!!PRINTIFY_API_KEY}`);
    console.log(`[ORDER] Shop ID configured: ${!!PRINTIFY_SHOP_ID}`);
    console.log(`[ORDER] Product: ${product_type} (${size})`);
    console.log(`[ORDER] Image URL length: ${image_url?.length || 0} characters`);
    
    if (!PRINTIFY_API_KEY || !PRINTIFY_SHOP_ID) {
      return c.json({ error: 'Printify API not configured - check PRINTIFY_API_KEY and PRINTIFY_SHOP_ID env variables' }, 500);
    }
    
    if (!image_url) {
      return c.json({ error: 'Missing image URL' }, 400);
    }
    
    // Check if in dev mode to bypass Printify integration
    if (process.env.NODE_ENV !== 'production' && process.env.BYPASS_PRINTIFY === 'true') {
      console.log('[PRINTIFY] 🧪 Dev mode with BYPASS_PRINTIFY=true, skipping Printify integration');
      
      // Return a mock successful response for testing
      return c.json({ 
        success: true, 
        orderId: `dev-${Date.now()}`,
        note: 'This is a dev mode bypass. No actual order was created in Printify.'
      });
    }
    
    // Upload image to Printify
    console.log('[PRINTIFY] Step 1: Uploading image...');
    try {
      const printifyImageId = await uploadImageToPrintify(image_url);
      console.log(`[PRINTIFY] Image uploaded with ID: ${printifyImageId}`);
      
      // Create product in Printify
      console.log('[PRINTIFY] Step 2: Creating product...');
      const productId = await createPrintifyProduct(printifyImageId, product_type, size);
      console.log(`[PRINTIFY] Product created with ID: ${productId}`);
      
      // Publish the product (makes it available for ordering)
      console.log('[PRINTIFY] Step 3: Publishing product...');
      await publishPrintifyProduct(productId);
      console.log('[PRINTIFY] Product published successfully');
      
      // Create shipping address object from form data
      const shippingAddress: PrintifyAddress = {
        first_name: shippingDetails.first_name,
        last_name: shippingDetails.last_name,
        email: shippingDetails.email,
        phone: shippingDetails.phone,
        country: shippingDetails.country,
        region: shippingDetails.region,
        address1: shippingDetails.address1,
        address2: shippingDetails.address2,
        city: shippingDetails.city,
        zip: shippingDetails.zip
      };
      
      // Create order in Printify
      // Use the blockchain tx hash as the payment identifier
      const paymentDetails: PrintifyPaymentDetails = {
        method: 'crypto',
        transaction_id: tx_hash || `crypto-${Date.now()}`
      };
      
      // Create order in Printify
      // In production, you'd need to get the variant ID from the product creation response
      console.log('[PRINTIFY] Step 4: Creating order...');
      const orderId = await createPrintifyOrder(productId, '1', shippingAddress, paymentDetails);
      console.log(`[PRINTIFY] Order created with ID: ${orderId}`);
      
      return c.json({ success: true, orderId });
    } catch (apiError: any) {
      console.error('[PRINTIFY] API Error:', apiError);
      
      // If in development mode, we can still bypass after showing the error
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PRINTIFY] 🧪 Dev mode - returning mock success response despite error');
        return c.json({ 
          success: true, 
          orderId: `dev-error-bypass-${Date.now()}`,
          error: apiError.message || 'Printify API error',
          note: 'This is a dev mode error bypass. The error was logged but a success response was returned for testing.'
        });
      }
      
      return c.json({ 
        error: apiError.message || 'Printify API error',
        details: apiError.toString()
      }, 500);
    }
  } catch (error: any) {
    console.error('Error processing order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage, details: JSON.stringify(error) }, 500);
  }
});

// Add a simple order confirmation page
app.get('/order-confirmation', (c) => {
  const orderId = c.req.query('order_id') || 'unknown';
  
  return c.html(`
    <html>
      <head>
        <title>Order Confirmation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 40px auto; padding: 30px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
          h1 { color: #3557B7; margin-bottom: 30px; }
          .success-icon { font-size: 80px; margin-bottom: 20px; }
          .order-id { background: #f0f7ff; padding: 12px; border-radius: 6px; margin: 20px 0; font-family: monospace; font-size: 18px; }
          .button { background: #3557B7; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Order Successfully Placed!</h1>
          <p>Thank you for your order. ${process.env.NODE_ENV !== 'production' ? '(Development Mode)' : ''}</p>
          <p>Your order has been received and is being processed.</p>
          <div class="order-id">Order ID: ${orderId}</div>
          <p>A confirmation email will be sent shortly with your order details.</p>
          <a href="/" class="button">Return Home</a>
        </div>
      </body>
    </html>
  `);
});

// Printify API integration helpers
// These would be used in your web app to complete the order process

async function uploadImageToPrintify(imageUrl: string): Promise<string> {
  if (!PRINTIFY_API_KEY) {
    throw new Error('Printify API key not configured');
  }
  
  try {
    console.log(`[PRINTIFY_UPLOAD] Starting image upload from URL: ${imageUrl.substring(0, 50)}...`);
    
    // Printify requires a proper image URL - check if we're dealing with a direct URL or base64 data
    if (imageUrl.startsWith('data:image') || !imageUrl.startsWith('http')) {
      console.log(`[PRINTIFY_UPLOAD] Image is not a valid URL. Using a test image URL instead.`);
      // For testing, use a placeholder image URL that Printify can access
      imageUrl = "https://placekitten.com/1024/1024";
    }
    
    // Printify expects a JSON object with a URL, not raw image data
    console.log(`[PRINTIFY_UPLOAD] Sending Printify API request with URL: ${imageUrl.substring(0, 50)}...`);
    
    const uploadResponse = await axios.post(
      'https://api.printify.com/v1/uploads/images.json',
      {
        file_name: `ai-generated-${Date.now()}.png`,
        url: imageUrl
      },
      {
        headers: {
          'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    console.log(`[PRINTIFY_UPLOAD] Upload successful, response:`, uploadResponse.data);
    return uploadResponse.data.id;
  } catch (error) {
    console.error('[PRINTIFY_UPLOAD] Error uploading image to Printify:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[PRINTIFY_UPLOAD] API response:', error.response.data);
      throw new Error(`Printify upload failed: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function createPrintifyProduct(printifyImageId: string, productType: string, size: string): Promise<string> {
  if (!PRINTIFY_API_KEY || !PRINTIFY_SHOP_ID) {
    throw new Error('Printify credentials not configured');
  }
  
  // Get the appropriate blueprint ID based on product type - keep as string
  let blueprintId = PRINTIFY_DEFAULT_TSHIRT_BLUEPRINT;
  if (productType === 'hoodie') {
    blueprintId = process.env.PRINTIFY_DEFAULT_HOODIE_BLUEPRINT || '5f46ce428a99620c0651a406';
  } else if (productType === 'mug') {
    blueprintId = process.env.PRINTIFY_DEFAULT_MUG_BLUEPRINT || '5f46ce5b8a99620c0651a407';
  }

  console.log(`[PRINTIFY_PRODUCT] Creating product with blueprint ID: ${blueprintId}`);
  console.log(`[PRINTIFY_PRODUCT] Image ID: ${printifyImageId}`);
  console.log(`[PRINTIFY_PRODUCT] Product type: ${productType}, Size: ${size}`);
  console.log(`[PRINTIFY_PRODUCT] Shop ID: ${PRINTIFY_SHOP_ID}`);
  
  try {
    // Verify shop exists first
    try {
      const shopResponse = await axios.get(
        `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}.json`,
        {
          headers: {
            'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );
      console.log(`[PRINTIFY_PRODUCT] Shop verified: ${shopResponse.data?.title || 'Unknown'}`);
    } catch (shopError: any) {
      console.error('[PRINTIFY_PRODUCT] Error verifying shop:', shopError.response?.data || shopError.message);
      throw new Error(`Shop verification failed. Shop ID ${PRINTIFY_SHOP_ID} may be invalid.`);
    }
    
    // Generate a variant ID
    const variantId = 1; // Start with ID 1
    
    // Create a product with the image
    const productData = {
      title: 'AI Generated Design',
      description: 'Custom AI-generated artwork created through Farcaster Frame',
      blueprint_id: blueprintId, // Keep as string, don't parse to int
      print_provider_id: 1, // This varies by blueprint
      variants: [
        {
          id: variantId, // Add required variant ID
          title: size,
          price: productType === 'mug' ? 1499 : productType === 'hoodie' ? 3999 : 2499, // Price in cents
          sku: `AI-${productType}-${size}`,
          is_enabled: true
        }
      ],
      print_areas: [
        {
          position: 'front',
          variant_ids: [variantId], // Add required variant_ids
          placeholders: [
            {
              position: 'front',
              height: 4000,
              width: 4000,
              images: [
                {
                  id: printifyImageId,
                  x: 0.5,
                  y: 0.5,
                  scale: 0.8,
                  angle: 0
                }
              ]
            }
          ]
        }
      ]
    };
    
    console.log(`[PRINTIFY_PRODUCT] Sending product data:`, JSON.stringify(productData));
    
    const productResponse = await axios.post(
      `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products.json`,
      productData,
      {
        headers: {
          'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    console.log(`[PRINTIFY_PRODUCT] Product created successfully, response:`, productResponse.data);
    return productResponse.data.id;
  } catch (error) {
    console.error('[PRINTIFY_PRODUCT] Error creating Printify product:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[PRINTIFY_PRODUCT] API response:', error.response.data);
      throw new Error(`Printify product creation failed: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function publishPrintifyProduct(productId: string): Promise<boolean> {
  if (!PRINTIFY_API_KEY || !PRINTIFY_SHOP_ID) {
    throw new Error('Printify credentials not configured');
  }
  
  console.log(`[PRINTIFY_PUBLISH] Publishing product ID: ${productId}`);
  
  try {
    const publishResponse = await axios.post(
      `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${productId}/publish.json`,
      { title: 'AI Generated Design' },
      {
        headers: {
          'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    console.log(`[PRINTIFY_PUBLISH] Product published successfully, response:`, publishResponse.data);
    return true;
  } catch (error) {
    console.error('[PRINTIFY_PUBLISH] Error publishing Printify product:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[PRINTIFY_PUBLISH] API response:', error.response.data);
      throw new Error(`Printify product publishing failed: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function createPrintifyOrder(
  productId: string, 
  variantId: string, 
  shippingAddress: PrintifyAddress, 
  paymentDetails: PrintifyPaymentDetails
): Promise<string> {
  if (!PRINTIFY_API_KEY || !PRINTIFY_SHOP_ID) {
    throw new Error('Printify credentials not configured');
  }
  
  console.log(`[PRINTIFY_ORDER] Creating order for product ID: ${productId}, variant: ${variantId}`);
  console.log(`[PRINTIFY_ORDER] Shipping to: ${shippingAddress.first_name} ${shippingAddress.last_name}, ${shippingAddress.city}, ${shippingAddress.country}`);
  
  try {
    const orderData = {
      external_id: `AI-${Date.now()}`,
      line_items: [
        {
          product_id: productId,
          variant_id: variantId,
          quantity: 1
        }
      ],
      shipping_method: 1, // Standard shipping
      address_to: shippingAddress,
      send_shipping_notification: true,
      payment_details: {
        payment_method: paymentDetails.method,
        transaction_id: paymentDetails.transaction_id
      }
    };
    
    console.log(`[PRINTIFY_ORDER] Sending order data:`, JSON.stringify(orderData));
    
    const orderResponse = await axios.post(
      `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/orders.json`,
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    console.log(`[PRINTIFY_ORDER] Order created successfully, response:`, orderResponse.data);
    return orderResponse.data.id;
  } catch (error) {
    console.error('[PRINTIFY_ORDER] Error creating Printify order:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[PRINTIFY_ORDER] API response:', error.response.data);
      throw new Error(`Printify order creation failed: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Add a development bypass route for testing order flow without payment
app.frame('/print/dev-bypass', (c) => {
  // Only allow this in development environment
  if (process.env.NODE_ENV === 'production') {
    return c.res({ 
      image: ErrorFrame('This route is only available in development mode'), 
      intents: [ <Button.Reset>Reset</Button.Reset> ] 
    });
  }
  
  const userId = 'user';
  const orderInfo = orderStore[userId];
  const imageUrl = imageStore[userId]?.url;
  
  if (!orderInfo || !imageUrl) {
    return c.res({ 
      image: ErrorFrame('Order information missing. Please start over.'), 
      intents: [ <Button.Reset>Reset</Button.Reset> ] 
    });
  }
  
  // Mark the order as completed with a test transaction hash
  orderInfo.purchaseCompleted = true;
  orderInfo.transactionHash = `dev-test-${Date.now()}`;
  
  // For debugging, log the order info
  console.log('DEV TEST: Bypassing payment with order info:', orderInfo);
  
  return c.res({
    image: (
      <div style={{ 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40, 
        padding: '20px', 
        backgroundColor: '#3557B7',
        height: '100%',
        width: '100%'
      }}>
        <div style={{ marginBottom: '20px', display: 'flex' }}>✅ DEV TEST MODE</div>
        <div style={{ fontSize: '28px', textAlign: 'center', display: 'flex' }}>
          Payment bypassed for testing
        </div>
      </div>
    ),
    intents: [
      <Button action="/print/shipping-address">Continue to Shipping</Button>,
      <Button.Reset>Reset</Button.Reset>
    ]
  });
});

// Add this after server setup code but before app startup
// Function to detect and log shop information
async function checkPrintifySetup() {
  if (!process.env.PRINTIFY_API_KEY) {
    console.log('[PRINTIFY] Warning: No API key configured');
    return;
  }
  
  try {
    console.log('[PRINTIFY] Checking shop configuration...');
    const response = await axios.get('https://api.printify.com/v1/shops.json', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (response.data && response.data.length > 0) {
      console.log('[PRINTIFY] Available shops:');
      response.data.forEach((shop: any, index: number) => {
        console.log(`[PRINTIFY] Shop #${index + 1}: ID=${shop.id}, Title="${shop.title}", External ID="${shop.sales_channel}"`);
      });
      console.log('[PRINTIFY] Set PRINTIFY_SHOP_ID in your .env file to one of these IDs');
    } else {
      console.log('[PRINTIFY] No shops found for this API key');
    }
  } catch (error) {
    console.error('[PRINTIFY] Error checking shops:', error);
  }
}

// Run the setup check when the server starts
checkPrintifySetup();

// Add a debug endpoint to see Printify shops
app.hono.get('/debug/printify-shops', async (c) => {
  if (!process.env.PRINTIFY_API_KEY) {
    return c.json({ error: 'No Printify API key configured' }, 500);
  }
  
  try {
    const response = await axios.get('https://api.printify.com/v1/shops.json', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    return c.json({
      message: 'Available Printify shops',
      shops: response.data
    });
  } catch (error) {
    console.error('[DEBUG] Printify shops error:', error);
    return c.json({ 
      error: 'Error fetching shops',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Add a debug endpoint to see Printify blueprints (for product creation)
app.hono.get('/debug/printify-blueprints', async (c) => {
  if (!process.env.PRINTIFY_API_KEY) {
    return c.json({ error: 'No Printify API key configured' }, 500);
  }
  
  try {
    const response = await axios.get('https://api.printify.com/v1/catalog/blueprints.json', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    return c.json({
      message: 'Available Printify blueprints',
      blueprints: response.data.map((blueprint: any) => ({
        id: blueprint.id,
        title: blueprint.title,
        description: blueprint.description,
        brand: blueprint.brand,
      }))
    });
  } catch (error) {
    console.error('[DEBUG] Printify blueprints error:', error);
    return c.json({ 
      error: 'Error fetching blueprints',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Add a debug endpoint for testing Printify image upload directly
app.hono.get('/debug/test-printify-upload', async (c) => {
  if (!process.env.PRINTIFY_API_KEY) {
    return c.json({ error: 'No Printify API key configured' }, 500);
  }
  
  try {
    // Use a reliable test image URL
    const testImageUrl = "https://placekitten.com/1024/1024";
    
    console.log('[DEBUG] Testing Printify upload with URL:', testImageUrl);
    
    const uploadResponse = await axios.post(
      'https://api.printify.com/v1/uploads/images.json',
      {
        file_name: `test-upload-${Date.now()}.jpg`,
        url: testImageUrl
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    return c.json({
      message: 'Test image uploaded successfully',
      uploadResult: uploadResponse.data
    });
  } catch (error: any) {
    console.error('[DEBUG] Printify upload test error:', error.response?.data || error.message);
    return c.json({ 
      error: 'Error uploading test image',
      details: error.response?.data || error.message || String(error)
    }, 500);
  }
});

// Add a debug endpoint to get a specific blueprint's details
app.hono.get('/debug/printify-blueprint/:id', async (c) => {
  if (!process.env.PRINTIFY_API_KEY) {
    return c.json({ error: 'No Printify API key configured' }, 500);
  }
  
  const blueprintId = c.req.param('id');
  
  try {
    const response = await axios.get(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}.json`, {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    // Extract just the print areas for easier debugging
    const printAreas = response.data.print_areas || [];
    const printProviders = response.data.print_providers || [];
    
    return c.json({
      message: `Details for blueprint ${blueprintId}`,
      title: response.data.title,
      description: response.data.description,
      print_areas: printAreas,
      print_providers: printProviders.map((pp: any) => ({
        id: pp.id,
        title: pp.title
      }))
    });
  } catch (error: any) {
    console.error('[DEBUG] Printify blueprint details error:', error.response?.data || error.message);
    return c.json({ 
      error: 'Error fetching blueprint details',
      details: error.response?.data || error.message || String(error)
    }, 500);
  }
});

// Add a detailed debug endpoint to examine available blueprint options with full details
app.hono.get('/debug/printify-blueprint-details', async (c) => {
  if (!process.env.PRINTIFY_API_KEY) {
    return c.json({ error: 'No Printify API key configured' }, 500);
  }
  
  try {
    // First get list of all available blueprints
    const blueprintsResponse = await axios.get('https://api.printify.com/v1/catalog/blueprints.json', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    // Get the first few blueprint IDs to examine in detail
    const blueprintIds = blueprintsResponse.data.slice(0, 3).map((bp: any) => bp.id);
    console.log('[DEBUG] First few blueprint IDs:', blueprintIds);
    
    // Examine each blueprint in detail
    const detailedResults = [];
    for (const id of blueprintIds) {
      try {
        const detailResponse = await axios.get(`https://api.printify.com/v1/catalog/blueprints/${id}.json`, {
          headers: {
            'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
            'Content-Type': 'application/json',
          }
        });
        
        detailedResults.push({
          id: id,
          title: detailResponse.data.title,
          printAreas: detailResponse.data.print_areas?.map((pa: any) => ({
            position: pa.position,
            placeholders: pa.placeholders
          })) || [],
          variants: (detailResponse.data.variants || []).slice(0, 3) // Just show first few variants
        });
      } catch (error: any) {
        detailedResults.push({
          id: id,
          error: error.message,
          response: error.response?.data
        });
      }
    }
    
    return c.json({
      message: 'Blueprint analysis',
      totalBlueprints: blueprintsResponse.data.length,
      exampleBlueprints: blueprintsResponse.data.slice(0, 5).map((bp: any) => ({
        id: bp.id,
        title: bp.title
      })),
      detailedResults
    });
  } catch (error: any) {
    console.error('[DEBUG] Printify blueprints error:', error);
    return c.json({ 
      error: 'Error fetching blueprints',
      details: error instanceof Error ? error.message : String(error),
      response: error.response?.data
    }, 500);
  }
});

// Add a shop verification endpoint
app.hono.get('/debug/printify-verify-shop', async (c) => {
  if (!process.env.PRINTIFY_API_KEY) {
    return c.json({ error: 'No Printify API key configured' }, 500);
  }
  
  const shopId = c.req.query('shop_id') || process.env.PRINTIFY_SHOP_ID;
  if (!shopId) {
    return c.json({ error: 'No shop ID provided' }, 400);
  }
  
  try {
    // Try to get the shop details
    const shopResponse = await axios.get(`https://api.printify.com/v1/shops/${shopId}.json`, {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    return c.json({
      message: 'Shop verification successful',
      shop: shopResponse.data
    });
  } catch (error: any) {
    console.error('[DEBUG] Shop verification error:', error);
    return c.json({ 
      error: 'Error verifying shop',
      shopId: shopId,
      details: error.response?.data || error.message,
      note: 'The shop ID may be invalid or you may not have access to it.',
      status: error.response?.status
    }, 500);
  }
});

// Frame route to create NFT collection through Coinbase Wallet
app.frame('/create-nft-collection', (c) => {
  const COINBASE_WALLET_CREATE_MINT_URL = 'https://wallet.coinbase.com/nft/create';
  
  return c.res({
    image: (
      <div style={{ 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40, 
        padding: '20px', 
        backgroundColor: '#3557B7',
        height: '100%',
        width: '100%'
      }}>
        <div style={{ marginBottom: '20px', display: 'flex' }}>🎨 Create NFT Collection</div>
        <div style={{ fontSize: '28px', textAlign: 'center', display: 'flex' }}>
          Create your NFT collection in Coinbase Wallet
        </div>
      </div>
    ),
    intents: [
      <Button.Link href={COINBASE_WALLET_CREATE_MINT_URL}>Open Coinbase Wallet</Button.Link>,
      <Button.Reset>Cancel</Button.Reset>
    ]
  });
});

// --- Server Configuration and Start --- 
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting server on port ${port}...`);
console.log(`⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯`);
// Devtools URL is typically /dev relative to the Frog base path
console.log(`🐸 Frame Dev UI: http://localhost:${port}/dev`);
console.log(`⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯`);

// Add type-safe rate limiting using a Map
const rateLimits = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // 100 requests per window

// Custom rate limiting middleware
app.hono.use('*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown';
  const now = Date.now();
  
  // Get or create rate limit entry
  let limit = rateLimits.get(ip);
  if (!limit || (now - limit.timestamp) > RATE_LIMIT_WINDOW) {
    limit = { count: 0, timestamp: now };
  }
  
  // Check if rate limit exceeded
  if (limit.count >= RATE_LIMIT_MAX) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  
  // Update rate limit
  limit.count++;
  rateLimits.set(ip, limit);
  
  await next();
});

// Frame verification middleware (simplified for now)
app.hono.use('*', async (c: Context<CustomEnv>, next) => {
  const frameMessage = c.req.header('fc-frame');
  
  if (frameMessage) {
    try {
      // Store frame message in request variables
      c.set('frameMeta', { message: frameMessage });
    } catch (error) {
      console.error('Frame verification error:', error);
      return c.json({ error: 'Frame verification failed' }, 401);
    }
  }
  
  await next();
});

// Redirect frame for printing on demand
app.frame('/print', (c) => {
  const imageUrl = imageStore['user']?.url; // Retrieve stored image URL
  
  if (!imageUrl) {
    return c.res({
      image: ErrorFrame('No image generated or found to print.'),
      intents: [ <Button.Reset>Reset</Button.Reset> ]
    });
  }
  
  console.log(`Preparing print options for image: ${imageUrl}`);
  
  return c.res({
    image: (
      <div style={{ 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40, 
        padding: '20px', 
        backgroundColor: '#3557B7',
        height: '100%',
        width: '100%'
      }}>
        <div style={{ marginBottom: '20px', display: 'flex' }}>👕 Print Options</div>
        <div style={{ fontSize: '30px', textAlign: 'center', display: 'flex' }}>Select a product type</div>
      </div>
    ),
    intents: [
      <Button action="/print/tshirt">T-Shirt</Button>,
      <Button action="/print/hoodie">Hoodie</Button>,
      <Button action="/print/mug">Mug</Button>,
      <Button.Reset>Back</Button.Reset>,
    ]
  });
});

// T-shirt specific print setup
app.frame('/print/tshirt', (c) => {
  const imageUrl = imageStore['user']?.url;
  
  if (!imageUrl) {
    return c.res({
      image: ErrorFrame('No image found to print.'),
      intents: [ <Button.Reset>Reset</Button.Reset> ]
    });
  }
  
  // Store the selected product type
  imageStore['user'] = { url: imageUrl, productType: 'tshirt' };
  
  return c.res({
    image: (
      <div style={{ 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40, 
        padding: '20px', 
        backgroundColor: '#3557B7',
        height: '100%',
        width: '100%'
      }}>
        <div style={{ marginBottom: '20px', display: 'flex' }}>👕 T-Shirt Size</div>
        <div style={{ fontSize: '30px', textAlign: 'center', display: 'flex' }}>Select your size</div>
      </div>
    ),
    intents: [
      <Button action="/print/size/S">Small</Button>,
      <Button action="/print/size/M">Medium</Button>,
      <Button action="/print/size/L">Large</Button>,
      <Button action="/print/size/XL">XL</Button>,
      <Button action="/print">Back</Button>
    ]
  });
});

// Hoodie specific print setup
app.frame('/print/hoodie', (c) => {
  const imageUrl = imageStore['user']?.url;
  
  if (!imageUrl) {
    return c.res({
      image: ErrorFrame('No image found to print.'),
      intents: [ <Button.Reset>Reset</Button.Reset> ]
    });
  }
  
  // Store the selected product type
  imageStore['user'] = { url: imageUrl, productType: 'hoodie' };
  
  return c.res({
    image: (
      <div style={{ 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40, 
        padding: '20px', 
        backgroundColor: '#3557B7',
        height: '100%',
        width: '100%'
      }}>
        <div style={{ marginBottom: '20px', display: 'flex' }}>🧥 Hoodie Size</div>
        <div style={{ fontSize: '30px', textAlign: 'center', display: 'flex' }}>Select your size</div>
      </div>
    ),
    intents: [
      <Button action="/print/size/S">Small</Button>,
      <Button action="/print/size/M">Medium</Button>,
      <Button action="/print/size/L">Large</Button>,
      <Button action="/print/size/XL">XL</Button>,
      <Button action="/print">Back</Button>
    ]
  });
});

// Mug specific print setup
app.frame('/print/mug', (c) => {
  const imageUrl = imageStore['user']?.url;
  
  if (!imageUrl) {
    return c.res({
      image: ErrorFrame('No image found to print.'),
      intents: [ <Button.Reset>Reset</Button.Reset> ]
    });
  }
  
  // For mugs, no size selection needed
  imageStore['user'] = { url: imageUrl, productType: 'mug', size: 'one-size' };
  imageStore['user'].tokenUri = imageUrl;
  
  // Skip to shipping info for mugs
  return c.res({
    action: '/print/shipping',
    image: (
      <div style={{ 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40, 
        padding: '20px', 
        backgroundColor: '#3557B7',
        height: '100%',
        width: '100%'
      }}>
        <div style={{ marginBottom: '20px', display: 'flex' }}>☕ Mug Selected</div>
        <div style={{ fontSize: '30px', textAlign: 'center', display: 'flex' }}>Continuing to shipping details</div>
      </div>
    ),
    intents: [
      <Button action="/print/shipping-address">Continue to Shipping</Button>,
      <Button action="/print">Back</Button>
    ]
  });
});

// Size selection handler
app.frame('/print/size/:size', (c) => {
  const size = c.req.param('size');
  const imageUrl = imageStore['user']?.url;
  const productType = imageStore['user']?.productType;
  
  if (!imageUrl || !productType) {
    return c.res({
      image: ErrorFrame('Session data missing. Please start over.'),
      intents: [ <Button.Reset>Reset</Button.Reset> ]
    });
  }
  
  // Store the selected size and order info
  const userId = 'user'; // In production, use FID or unique identifier
  
  // Set the appropriate price based on product type
  let price = PRICES[productType]?.total || 2499;
  
  // Store order info
  orderStore[userId] = {
    productType,
    size,
    price,
    shipping: {
      // Placeholder for shipping information
    },
    purchaseCompleted: false
  };
  
  return c.res({
    action: '/print/shipping-address',
    image: (
      <div style={{ 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40, 
        padding: '20px', 
        backgroundColor: '#3557B7',
        height: '100%',
        width: '100%'
      }}>
        <div style={{ marginBottom: '20px', display: 'flex' }}>✓ Size Selected: {size}</div>
        <div style={{ fontSize: '30px', textAlign: 'center', display: 'flex' }}>Continue to shipping</div>
      </div>
    ),
    intents: [
      <Button action="/print/shipping-address">Continue to Shipping</Button>,
      <Button action={`/print/${productType}`}>Back</Button>
    ]
  });
});

// Start the server using the Frog application's fetch handler
if (process.env.NODE_ENV !== 'production') {
  // Only run the server directly when not in production (local development)
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  console.log(`Starting server on port ${port}...`);
  console.log(`⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯`);
  // Devtools URL is typically /dev relative to the Frog base path
  console.log(`🐸 Frame Dev UI: http://localhost:${port}/dev`);
  console.log(`⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯`);
  
  serve({
    fetch: app.fetch, // Use the fetch handler from the Frog app
    port
  });
}

// For Vercel serverless deployment, export the fetch handler directly
export default app.fetch;
