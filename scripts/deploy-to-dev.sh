#!/bin/bash
# SPDX-FileCopyrightText: 2025 SecPal Contributors
# SPDX-License-Identifier: CC0-1.0

# Deploy Performance Optimizations to app.secpal.dev
#
# This script connects to the Uberspace server and updates the frontend
# with the latest performance optimizations from the GitHub branch

set -e

echo "🚀 Deploying Performance Optimizations to app.secpal.dev"
echo ""
echo "Target: app.secpal.dev (Uberspace)"
echo "Branch: perf/code-splitting-tbt-optimization"
echo ""

# Instructions for manual deployment
echo "Manual deployment steps:"
echo ""
echo "1. Connect to Uberspace:"
echo "   ssh secpal@triangulum.uberspace.de"
echo ""
echo "2. Navigate to frontend directory:"
echo "   cd /var/www/virtual/secpal/frontend"
echo ""
echo "3. Pull latest changes:"
echo "   git fetch origin"
echo "   git checkout perf/code-splitting-tbt-optimization"
echo "   git pull origin perf/code-splitting-tbt-optimization"
echo ""
echo "4. Install dependencies (if package.json changed):"
echo "   npm ci"
echo ""
echo "5. Build production bundle:"
echo "   npm run build"
echo ""
echo "6. Verify deployment:"
echo "   - Open https://app.secpal.dev in browser"
echo "   - Check DevTools → Network → JS files"
echo "   - Verify code splitting (multiple chunks)"
echo "   - Run Lighthouse audit"
echo ""
echo "7. Test performance:"
echo "   npm run test:e2e:staging -- --grep 'performance'"
echo ""

read -p "Connect to Uberspace now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    ssh secpal@triangulum.uberspace.de
fi
