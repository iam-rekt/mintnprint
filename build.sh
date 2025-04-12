#!/bin/bash

# Exit on error
set -e

echo "Building application for production..."

# Clean up dist directory if it exists
if [ -d "dist" ]; then
  echo "Cleaning up dist directory..."
  rm -rf dist
fi

# Compile TypeScript to JavaScript
echo "Compiling TypeScript..."
npx tsc

# Copy public directory to dist
echo "Copying public directory..."
cp -r public dist/

echo "Build completed successfully!" 