#!/usr/bin/env bash
set -e

echo "========================================================"
echo "🚀 ShoppersDeals 24/7 Dedicated Linux Server Setup"
echo "========================================================"

# 1. Update APT & install base packages
echo "📦 [1/6] Installing system dependencies (curl, git, redis-server, build-essential)..."
sudo apt-get update -y
sudo apt-get install -y curl git redis-server build-essential ca-certificates gnupg

# 2. Configure & Start Redis
echo "⚡ [2/6] Starting Redis Server..."
sudo service redis-server start || true
redis-cli ping || (echo "❌ Redis failed to start" && exit 1)
echo "✅ Redis is active and responding PONG."

# 3. Install Node.js 20 LTS if needed
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
  echo "🟢 [3/6] Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "✅ [3/6] Node.js is already installed: $(node -v)"
fi

# 4. Install PM2 globally
if ! command -v pm2 &> /dev/null; then
  echo "⚙️ [4/6] Installing PM2 process manager..."
  sudo npm install -g pm2
else
  echo "✅ [4/6] PM2 is already installed: $(pm2 -v)"
fi

# 5. Install Project Dependencies
echo "📥 [5/6] Installing npm dependencies across all services..."
echo "  -> Installing API dependencies..."
(cd api && npm install)

echo "  -> Installing Backend dependencies..."
(cd backend && npm install)

echo "  -> Installing Frontend Web dependencies..."
(cd frontend/web && npm install)

echo "🏗️ Building Next.js Web Frontend..."
(cd frontend/web && npm run build)

echo "========================================================"
echo "🎉 Dependencies & build completed successfully!"
echo "👉 Next: ensure .env files are created, then run:"
echo "   pm2 start ecosystem.config.cjs && pm2 save"
echo "========================================================"
