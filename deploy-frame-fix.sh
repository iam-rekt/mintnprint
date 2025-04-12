#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying Frame fix to Vercel...${NC}"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo -e "${YELLOW}Vercel CLI not found. Installing...${NC}"
  npm install -g vercel
fi

# Building the project
echo -e "${GREEN}Building project...${NC}"
npm run build

# Deploy to Vercel
echo -e "${GREEN}Deploying to Vercel...${NC}"
echo -e "${YELLOW}You may be prompted to log in if this is your first time using Vercel CLI.${NC}"
vercel --prod

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}Important:${NC} After deployment, validate your frame at:"
echo "https://warpcast.com/~/developers/frames"
echo ""
echo -e "${YELLOW}You can also test your frame manually by visiting:${NC}"
echo "https://www.farcaster.xyz/frame-validators" 