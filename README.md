# AI Image Generator & NFT Minter/Printer Frame

A Farcaster Frame that allows users to generate AI images, mint them as NFTs, and print them as merchandise using crypto wallet payments.

## Features

- AI image generation using OpenAI's DALL-E 3
- NFT minting using Coinbase's OnchainKit
- Cryptocurrency payments via Coinbase OnchainKit (USDC)
- Merchandise printing via Printify API integration
- Complete checkout flow with shipping and payment processing
- Full Farcaster Frame integration

## Workflow

1. **User Prompts AI to Create Image**: 
   - User enters a text prompt for image generation
   - AI generates the image using DALL-E 3
   - Image is displayed for user review

2. **Mint or Print Options**:
   - **Mint as NFT**: Creates an NFT on the Base network using Coinbase OnchainKit
   - **Print as Merchandise**: Proceeds to product selection

3. **Print Workflow**:
   - Select product type (T-shirt, Hoodie, Mug)
   - Select size (if applicable)
   - Pay with crypto wallet (Farcaster or Coinbase Wallet)
   - Enter shipping details
   - Order processed via Printify API

## Prerequisites

- Node.js (v18 or newer)
- OpenAI API key
- CDP API key (for NFT minting and payments)
- Printify API key and Shop ID (for merchandise printing)
- A deployed NFT contract on Base (or Base Sepolia testnet)
- Merchant wallet address to receive payments
- Frog secret for securing your Frame (optional but recommended)

## Setup

1. Clone the repository
2. Navigate to the Frame directory
3. Install dependencies:

```bash
pnpm install
```

4. Copy the example environment file:

```bash
cp .env.example .env
```

5. Fill in your API keys and configuration in the `.env` file:

```
# API Keys
OPENAI_API_KEY=your_openai_api_key_here
PRINTIFY_API_KEY=your_printify_api_key_here
PRINTIFY_SHOP_ID=your_printify_shop_id_here
CDP_API_KEY=your_cdp_api_key_here

# Set development mode (remove for production)
NODE_ENV=development

# Base URL for server (with fallback to localhost)
BASE_URL=http://localhost:3000
LOCAL_URL=http://localhost:3000

# Server port
PORT=3000

PRINTIFY_DEFAULT_TSHIRT_BLUEPRINT=5
PRINTIFY_DEFAULT_HOODIE_BLUEPRINT=6
PRINTIFY_DEFAULT_MUG_BLUEPRINT=9
BYPASS_PRINTIFY=false

# Farcaster Frame
FROG_SECRET=your_frog_secret_here

# NFT Contract Configuration
NFT_CONTRACT_ADDRESS=0xYourContractAddressHere
NFT_NETWORK=base-sepolia-testnet

# Payment Configuration
MERCHANT_WALLET=0xYourMerchantWalletAddress
USDC_CONTRACT=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
PAYMENT_NETWORK=polygon
```

## Running Locally

Start the development server:

```bash
pnpm dev
```

The Frame development UI will be available at: http://localhost:3000/api/dev

## Frame Implementation

This project leverages the Farcaster Frame protocol to create an interactive experience that can be embedded in Farcaster clients:

- Uses `frog` and `frames.js` for Frame implementation
- Provides interactive buttons for users to navigate through the workflow
- Maintains state across Frame interactions
- Optimized for display in Warpcast and other Farcaster clients
- Includes appropriate meta tags for Frame preview

For Frame testing and debugging, you can use the included test-frame.html file located in the public directory.

## Deployment

You can deploy this Frame to any hosting platform that supports Node.js applications:

- Vercel
- Netlify
- Cloudflare Workers (with minor adjustments)
- Any Node.js server

After deployment, update your `robots.txt` file to ensure Frame preview bots can access your Frame:

```
User-agent: *
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: Farcaster
Allow: /

User-agent: Warpcast
Allow: /

# Update with your actual domain
Sitemap: https://your-actual-domain.com/sitemap.xml
```

## Payment Integration

This application uses Coinbase OnchainKit for cryptocurrency payments:

1. User selects product and size
2. Pricing is displayed in USDC (USD Coin)
3. User connects their Farcaster wallet or Coinbase wallet
4. Payment transaction is created and sent to the user's wallet
5. Upon successful payment, user continues to shipping information

The merchant receives payments in USDC to their configured wallet address.

## Printify Integration

The application integrates with Printify to create and fulfill merchandise orders:

1. User-generated image is uploaded to Printify
2. Product is created with the image
3. Order is placed with shipping details
4. User receives confirmation with order details

## Known Issues

- Type errors related to the OnchainKit and Frog libraries may appear in development but should not affect runtime functionality.
- Image storage is currently in-memory and will be lost on server restart. For production, implement a proper storage solution.
- The checkout process should be enhanced with better error handling and security measures for production use.

## Customization

- Error image: Replace the SVG in `public/error-image.svg`
- Product templates: Update the Printify blueprint IDs in the .env file for different product types
- Styling: Modify the styling in the frame definitions and HTML templates
- NFT metadata: Update the mint transaction parameters for your specific NFT requirements
- Payment: Configure different tokens or payment networks in the .env file

## License

MIT 