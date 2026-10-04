import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const projectRoot = path.resolve(process.cwd());
const nodeBin = process.execPath;
const scriptPath = path.join(projectRoot, 'api', 'token_daemon.mjs');
const workingDir = path.join(projectRoot, 'api');
const logsDir = path.join(projectRoot, 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const label = 'com.shoppersdeals.tokendaemon';
const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
const plistPath = path.join(plistDir, `${label}.plist`);

const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodeBin}</string>
        <string>${scriptPath}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${workingDir}</string>
    <key>StandardOutPath</key>
    <string>${path.join(logsDir, 'token_daemon.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(logsDir, 'token_daemon.err.log')}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
`;

try {
  // Unload existing if loaded
  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`);
  } catch {}

  fs.writeFileSync(plistPath, plistContent, 'utf8');
  console.log(`✓ Created LaunchAgent plist: ${plistPath}`);

  execSync(`launchctl load "${plistPath}"`);
  console.log(`✓ Successfully loaded and started background daemon: ${label}`);
  console.log(`\nLogs: ${path.join(logsDir, 'token_daemon.log')}`);
  console.log(`To inspect logs: tail -f ${path.join(logsDir, 'token_daemon.log')}`);
  console.log(`To uninstall: npm run token:daemon:uninstall\n`);
} catch (err) {
  console.error('Failed to install LaunchAgent:', err.message);
  process.exit(1);
}
