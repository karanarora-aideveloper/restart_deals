import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Not committed (see api/.gitignore) — generate from the Firebase console for the
// "shoppers-deals" project: Project Settings -> Service Accounts -> Generate New Private Key.
// Override the path via FIREBASE_SERVICE_ACCOUNT_PATH in api/.env if you'd rather keep it
// elsewhere.
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  || path.resolve(process.cwd(), 'firebase-service-account.json');

let app = null;
let initError = null;

function initFirebaseAdmin() {
  if (app || initError) return;
  try {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      initError = `Firebase service account not found at ${SERVICE_ACCOUNT_PATH}. Generate one from the Firebase console (Project Settings → Service Accounts → Generate New Private Key) for the "shoppers-deals" project and save it there, or set FIREBASE_SERVICE_ACCOUNT_PATH in api/.env.`;
      console.warn(`[Firebase Admin] ${initError}`);
      return;
    }
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase Admin] Initialized for project:', serviceAccount.project_id);
  } catch (err) {
    initError = `Failed to initialize Firebase Admin: ${err.message}`;
    console.error(`[Firebase Admin] ${initError}`);
  }
}

initFirebaseAdmin();

export function isFirebaseAdminReady() {
  return !!app;
}

export function getFirebaseAdminError() {
  return initError;
}

export function getMessaging() {
  return app ? admin.messaging(app) : null;
}

export function getAuth() {
  return app ? admin.auth(app) : null;
}
