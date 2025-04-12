# Deployment Guide for Farcaster Frame

This guide will walk you through deploying your AI Image Generator Farcaster Frame to production.

## Prerequisites

- A hosting provider (Vercel, Render, Railway, etc.)
- Your domain (or a custom subdomain from your hosting provider)
- Node.js and npm/pnpm installed locally

## Steps for Deployment

### 1. Prepare Your Environment Variables

Make sure your `.env` file contains the proper production values:

```
NODE_ENV=production
BASE_URL=https://your-production-domain.com
```

Replace `your-production-domain.com` with your actual domain.

### 2. Build the Project

Run the build command:

```bash
npm run build
```

This will compile the TypeScript code to JavaScript in the `dist` directory.

### 3. Deployment Options

#### Option 1: Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow the prompts to configure your project for deployment.

4. Set environment variables in the Vercel dashboard.

#### Option 2: Render

1. Create a new Web Service on Render.
2. Connect your GitHub repository.
3. Configure build settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/index.js`
4. Add environment variables in the Render dashboard.

#### Option 3: Railway

1. Create a new project on Railway.
2. Connect your GitHub repository.
3. Configure deployment settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/index.js`
4. Add environment variables in the Railway dashboard.

### 4. Verify Your Frame

After deployment, verify your frame using the Farcaster Frame validator:

1. Visit [https://warpcast.com/~/developers/frames](https://warpcast.com/~/developers/frames)
2. Enter your frame URL (your deployed domain)
3. Test the frame functionality

## Important Notes

- Make sure your server can handle CORS requests properly.
- The Frame must be served over HTTPS.
- The frame should respond quickly (under 5 seconds) to avoid timeouts.
- Consider setting up caching for generated images to improve performance.
- Monitor your OpenAI API usage to avoid unexpected charges.

## Testing Your Frame Locally

To test your frame locally before deployment:

1. Use ngrok to create a public URL for your local server:
   ```bash
   ngrok http 3000
   ```

2. Update your `.env` file temporarily:
   ```
   BASE_URL=https://your-ngrok-url.ngrok-free.app
   ```

3. Run your local development server:
   ```bash
   npm run dev
   ```

4. Test the frame using the Farcaster Frame validator.

## Troubleshooting

- **Frame not showing**: Verify that your server is correctly setting the required Frame meta tags.
- **Images not loading**: Check that the image URLs are absolute and accessible.
- **Button actions not working**: Verify that your post_url is correct and your server correctly processes POST requests.
- **CORS errors**: Ensure your server properly handles CORS preflight requests with appropriate headers. 