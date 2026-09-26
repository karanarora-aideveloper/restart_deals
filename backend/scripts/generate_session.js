import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const apiId = parseInt(process.env.TELEGRAM_API_ID || '7415209', 10);
const apiHash = process.env.TELEGRAM_API_HASH || '50a6b3dd64ff2f45b0bc834c3561e83d';

console.log('==================================================');
console.log('       SHOPPERSDEALS TELEGRAM AUTHENTICATION      ');
console.log('==================================================');
console.log(`Using API ID: ${apiId}`);
console.log('Connecting to Telegram MTProto servers...\n');

const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
  connectionRetries: 5,
});

async function main() {
  await client.start({
    phoneNumber: async () => await input.text('📱 Enter your Telegram Phone Number (with country code, e.g. +91XXXXXXXXXX): '),
    password: async () => await input.text('🔒 Enter your Telegram 2FA Password (leave empty and press Enter if none): '),
    phoneCode: async () => await input.text('💬 Enter the verification code received in Telegram app: '),
    onError: (err) => console.error('❌ Auth Error:', err.message),
  });

  console.log('\n✅ Telegram client authenticated successfully!');
  const newSession = client.session.save();

  console.log('\n=================== NEW TELEGRAM SESSION ===================');
  console.log(newSession);
  console.log('============================================================\n');

  // 1. Update local backend/.env
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('TELEGRAM_SESSION=')) {
      envContent = envContent.replace(/TELEGRAM_SESSION=.*/, `TELEGRAM_SESSION=${newSession}`);
    } else {
      envContent += `\nTELEGRAM_SESSION=${newSession}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log('✓ Successfully saved new TELEGRAM_SESSION to backend/.env');
  } catch (err) {
    console.warn('⚠️ Could not update backend/.env automatically:', err.message);
  }

  // 2. Update Railway shoppersdeals-backend service
  try {
    console.log('\n🚀 Updating Railway service shoppersdeals-backend with new session...');
    execSync(`railway variable set 'TELEGRAM_SESSION=${newSession}' --service shoppersdeals-backend`, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../'),
    });
    console.log('✓ Railway environment variable updated!');

    console.log('\n🔄 Restarting shoppersdeals-backend service on Railway...');
    execSync('railway restart --service shoppersdeals-backend', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../'),
    });
    console.log('✓ shoppersdeals-backend restarted and live!');
  } catch (err) {
    console.warn('⚠️ Automatic Railway update failed, please copy the session string manually into Railway:', err.message);
  }

  console.log('\n🎉 Engine 1 is now fully operational and listening to live Telegram deal channels!');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Fatal Error during Telegram authentication:', err.message);
  process.exit(1);
});
