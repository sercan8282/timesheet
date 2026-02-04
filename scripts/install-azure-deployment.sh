#!/bin/bash

# Azure VM Deployment Tool - Installation Script
# This script helps set up the Azure VM deployment tool

set -e

echo "================================================"
echo "Azure VM Deployment Tool - Installation"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "Please install Node.js >= 14.x from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm found: $(npm --version)${NC}"
echo ""

# Install dependencies
echo "Installing npm dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi
echo ""

# Initialize database
echo "Initializing database for Azure VM deployment..."
node scripts/init-azure-deployment-db.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database initialized successfully${NC}"
else
    echo -e "${RED}✗ Failed to initialize database${NC}"
    exit 1
fi
echo ""

# Check if main database exists
if [ ! -f "data.db" ]; then
    echo -e "${YELLOW}⚠ Main application database not found${NC}"
    echo "Initializing main database..."
    npm run init-db
    echo ""
fi

echo "================================================"
echo -e "${GREEN}Installation Complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the server:"
echo "   npm start"
echo ""
echo "2. Open browser and go to:"
echo "   http://localhost:3000"
echo ""
echo "3. Login as admin (default credentials in README)"
echo ""
echo "4. Configure Azure VM Deployment:"
echo "   - Go to Admin → Azure Deployment Config"
echo "   - Set up Azure credentials"
echo "   - Configure Terraform state storage"
echo "   - Set up Azure DevOps integration"
echo "   - Configure pipelines"
echo ""
echo "For detailed setup instructions, see:"
echo "   - AZURE-VM-DEPLOYMENT-README.md (Quick Start)"
echo "   - AZURE-VM-DEPLOYMENT-GUIDE.md (Full Documentation)"
echo ""
echo "================================================"
