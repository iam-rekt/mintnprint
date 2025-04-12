#!/bin/bash

# Exit on error
set -e

# Log messages with color
echo -e "\033[0;32mStarting build process...\033[0m"

# Build the project
echo -e "\033[0;32mRunning pnpm build...\033[0m"
pnpm run build

# Replace placeholders in frame.html with BASE_URL
echo -e "\033[0;32mReplacing placeholders in frame.html with BASE_URL: $BASE_URL\033[0m"
sed -i "s|\${BASE_URL}|$BASE_URL|g" dist/public/frame.html

echo -e "\033[0;32mBuild completed successfully\033[0m" 