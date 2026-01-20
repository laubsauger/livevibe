#!/bin/bash

# Exit on error
set -e

echo "🎵 Setting up Strudel Submodule..."

# Initialize submodule if needed
git submodule update --init --recursive

# Navigate to submodule
cd vendor/strudel

# Check if patch is needed
if git apply --check ../../patches/strudel/integration.patch 2>/dev/null; then
    echo "📦 Applying integration patch..."
    git apply ../../patches/strudel/integration.patch
    echo "✅ Patch applied successfully."
else
    echo "ℹ️  Patch already applied or conflicting. Skipping."
fi
