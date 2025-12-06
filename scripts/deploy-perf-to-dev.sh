#!/bin/bash
# SPDX-FileCopyrightText: 2025 SecPal
# SPDX-License-Identifier: CC0-1.0

#!/usr/bin/env bash

# Deploy performance optimization branch to app.secpal.dev for testing
# This script should be run from the frontend directory

set -euo pipefail
# Branch: perf/aggressive-code-splitting

set -e

echo "🚀 Deploying Performance Optimizations to app.secpal.dev"
echo "=========================================================="
echo ""

# SSH connection details
SSH_HOST="secpal@triangulum.uberspace.de"
FRONTEND_DIR="/var/www/virtual/secpal/frontend"
BRANCH="perf/aggressive-code-splitting"

echo "📡 Connecting to Uberspace..."
ssh "$SSH_HOST" << 'ENDSSH'

# Navigate to frontend directory
cd /var/www/virtual/secpal/frontend

echo "📦 Fetching latest changes..."
git fetch origin

echo "🔀 Checking out performance branch..."
git checkout perf/aggressive-code-splitting
git pull origin perf/aggressive-code-splitting

echo "📥 Installing dependencies..."
npm ci

echo "🏗️  Building production bundle..."
npm run build

echo "✅ Deployment complete!"
echo ""
echo "🔍 Verify deployment:"
echo "  1. Open https://app.secpal.dev"
echo "  2. DevTools → Network → Reload"
echo "  3. Check for multiple small JS chunks"
echo "  4. Main bundle should be ~57KB (14KB gzipped)"
echo ""
echo "📊 Run performance tests:"
echo "  npm run test:e2e:staging -- --grep \"performance\""
echo "  npm run lighthouse:ci"

ENDSSH

echo ""
echo "🎉 Deployment successful!"
echo "Next steps:"
echo "  1. Run: npm run test:e2e:staging -- --grep \"performance\""
echo "  2. Run: npm run lighthouse:ci"
echo "  3. Document results in PR #318"
