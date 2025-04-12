#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying to Vercel...${NC}"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo -e "${YELLOW}Vercel CLI not found. Installing...${NC}"
  npm install -g vercel
fi

# Check if the pnpm-lock.yaml file is consistent with package.json
echo -e "${GREEN}Checking pnpm-lock.yaml...${NC}"
pnpm install

# Update the BASE_URL in the frame.html file
echo -e "${GREEN}Please enter your Vercel deployment URL (e.g., https://your-app.vercel.app):${NC}"
read VERCEL_URL

if [ -z "$VERCEL_URL" ]; then
  echo -e "${YELLOW}No URL provided. Will use placeholder that you'll need to update later.${NC}"
  VERCEL_URL="https://your-app.vercel.app"
fi

# Update the .env file
echo -e "${GREEN}Updating .env file...${NC}"
sed -i '' "s|BASE_URL=.*|BASE_URL=$VERCEL_URL|g" .env
echo -e "${GREEN}Updated BASE_URL in .env to: $VERCEL_URL${NC}"

# Update the frame.html file
echo -e "${GREEN}Updating frame.html file...${NC}"
sed -i '' "s|content=\"http://localhost:3000/image?image=welcome\"|content=\"$VERCEL_URL/image?image=welcome\"|g" public/frame.html
sed -i '' "s|content=\"http://localhost:3000\"|content=\"$VERCEL_URL\"|g" public/frame.html
echo -e "${GREEN}Updated URLs in frame.html${NC}"

# Building the project
echo -e "${GREEN}Building project...${NC}"
./build.sh

# Deploy to Vercel
echo -e "${GREEN}Deploying to Vercel...${NC}"
echo -e "${YELLOW}You may be prompted to log in if this is your first time using Vercel CLI.${NC}"
vercel --prod

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}Important:${NC} After deployment, validate your frame at:"
echo "https://warpcast.com/~/developers/frames" 