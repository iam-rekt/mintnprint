#!/bin/bash

# Deployment script for Farcaster Frame

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}AI Image Generator Farcaster Frame Deployment Script${NC}"
echo "----------------------------------------"

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env file not found!${NC}"
  echo "Please create a .env file with your production settings before deploying."
  exit 1
fi

# Check if BASE_URL is set to a production URL
if grep -q "BASE_URL=http://localhost" .env; then
  echo -e "${YELLOW}Warning: BASE_URL in .env is set to localhost.${NC}"
  echo "Please update it to your production URL before deploying."
  echo "Example: BASE_URL=https://your-production-domain.com"
  
  read -p "Do you want to continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
  fi
fi

# Ensure NODE_ENV is set to production in .env
if ! grep -q "NODE_ENV=production" .env; then
  echo -e "${YELLOW}Setting NODE_ENV to production in .env file...${NC}"
  sed -i '' "s/NODE_ENV=development/NODE_ENV=production/" .env
fi

# Build the project
echo -e "${GREEN}Building project...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed! Please fix the errors before deploying.${NC}"
  exit 1
fi

# Deployment options
echo -e "${GREEN}Choose a deployment platform:${NC}"
echo "1) Vercel"
echo "2) Render"
echo "3) Railway"
echo "4) Manual deployment"
read -p "Enter your choice (1-4): " deployment_choice

case $deployment_choice in
  1)
    # Vercel deployment
    echo -e "${GREEN}Deploying to Vercel...${NC}"
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
      echo "Vercel CLI not found. Installing..."
      npm install -g vercel
    fi
    
    # Deploy with Vercel
    vercel
    ;;
    
  2)
    # Render deployment guidance
    echo -e "${GREEN}Render Deployment Instructions:${NC}"
    echo "1. Visit https://dashboard.render.com/"
    echo "2. Create a new Web Service"
    echo "3. Connect your GitHub repository"
    echo "4. Configure build settings:"
    echo "   - Build Command: npm install && npm run build"
    echo "   - Start Command: node dist/index.js"
    echo "5. Add your environment variables from .env"
    
    read -p "Press Enter to open the Render dashboard in your browser..." -n 1 -r
    open "https://dashboard.render.com/"
    ;;
    
  3)
    # Railway deployment guidance
    echo -e "${GREEN}Railway Deployment Instructions:${NC}"
    echo "1. Visit https://railway.app/dashboard"
    echo "2. Create a new project"
    echo "3. Connect your GitHub repository"
    echo "4. Configure deployment settings:"
    echo "   - Build Command: npm install && npm run build"
    echo "   - Start Command: node dist/index.js"
    echo "5. Add your environment variables from .env"
    
    read -p "Press Enter to open the Railway dashboard in your browser..." -n 1 -r
    open "https://railway.app/dashboard"
    ;;
    
  4)
    # Manual deployment
    echo -e "${GREEN}Manual Deployment:${NC}"
    echo "Your application is built and ready to deploy."
    echo "1. Copy the dist/ directory and the package.json file to your server"
    echo "2. Run 'npm install --production' on your server"
    echo "3. Start the application with 'node dist/index.js'"
    echo "4. Make sure to set up environment variables on your server"
    ;;
    
  *)
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}Deployment preparation complete!${NC}"
echo -e "${YELLOW}Important:${NC} After deployment, validate your frame at:"
echo "https://warpcast.com/~/developers/frames"
echo ""
echo "Happy framing!" 