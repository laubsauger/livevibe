#!/usr/bin/env node

/**
 * Cross-platform setup script for Strudel submodule
 * Works on Windows, macOS, and Linux
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const VENDOR_STRUDEL = path.join(ROOT, 'vendor', 'strudel');
const PATCH_FILE = path.join(ROOT, 'patches', 'strudel', 'integration.patch');

function run(cmd, opts = {}) {
    console.log(`> ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit', ...opts });
        return true;
    } catch (e) {
        if (!opts.ignoreError) {
            console.error(`Command failed: ${cmd}`);
            throw e;
        }
        return false;
    }
}

function main() {
    console.log('🎵 Setting up Strudel Submodule...');

    // Initialize submodule if needed
    run('git submodule update --init --recursive', { cwd: ROOT });

    // Check if strudel directory exists
    if (!fs.existsSync(VENDOR_STRUDEL)) {
        console.error('❌ Strudel submodule not found at vendor/strudel');
        process.exit(1);
    }

    // Check if patch file exists
    if (!fs.existsSync(PATCH_FILE)) {
        console.log('ℹ️  No patch file found. Skipping patch step.');
        return;
    }

    // Check if patch can be applied (dry run)
    const canApply = run(
        `git apply --check "${PATCH_FILE}"`,
        { cwd: VENDOR_STRUDEL, ignoreError: true }
    );

    if (canApply) {
        console.log('📦 Applying integration patch...');
        run(`git apply "${PATCH_FILE}"`, { cwd: VENDOR_STRUDEL });
        console.log('✅ Patch applied successfully.');
    } else {
        console.log('ℹ️  Patch already applied or conflicting. Skipping.');
    }
}

main();
