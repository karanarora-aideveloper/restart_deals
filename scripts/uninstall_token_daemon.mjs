import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const label = 'com.shoppersdeals.tokendaemon';
const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
const plistPath = path.join(plistDir, `${label}.plist`);

try {
  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`);
    console.log(`✓ Unloaded daemon: ${label}`);
  } catch {}

  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
    console.log(`✓ Removed plist: ${plistPath}`);
  }
  console.log('✓ Token daemon successfully stopped and uninstalled.');
} catch (err) {
  console.error('Failed to uninstall LaunchAgent:', err.message);
  process.exit(1);
}
