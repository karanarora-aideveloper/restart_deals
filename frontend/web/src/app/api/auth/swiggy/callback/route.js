import { NextResponse } from 'next/server';
import {
  exchangeSwiggyAuthCode,
  getInstamartAddresses,
} from '@/lib/swiggyMcpService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    if (errorParam) {
      return new NextResponse(
        renderErrorHtml(`Swiggy Authentication Declined: ${errorDesc || errorParam}`),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    if (!code) {
      return new NextResponse(
        renderErrorHtml('Missing authorization code from Swiggy OAuth.'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Retrieve PKCE session cookie
    const sessionCookie = request.cookies.get('swiggy_pkce_session')?.value;
    if (!sessionCookie) {
      return new NextResponse(
        renderErrorHtml('Session expired or invalid. Please try logging in again.'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie);
    } catch {
      return new NextResponse(
        renderErrorHtml('Malformed session cookie. Please retry login.'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    if (state && sessionData.state !== state) {
      return new NextResponse(
        renderErrorHtml('Security state mismatch (CSRF protection). Please retry login.'),
        { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Exchange code for 5-day access token
    const tokenResult = await exchangeSwiggyAuthCode({
      code,
      codeVerifier: sessionData.codeVerifier,
      redirectUri: sessionData.redirectUri,
    });

    const accessToken = tokenResult.accessToken;
    const expiresIn = tokenResult.expiresIn || 432000;

    // Discover user's saved addresses via Instamart MCP
    let primaryAddress = null;
    let addressesCount = 0;
    try {
      const addressData = await getInstamartAddresses({ token: accessToken });
      if (addressData?.data?.addresses && Array.isArray(addressData.data.addresses)) {
        addressesCount = addressData.data.addresses.length;
        primaryAddress = addressData.data.addresses[0];
      }
    } catch (addrErr) {
      console.warn('Could not fetch addresses on first login (non-fatal):', addrErr.message);
    }

    const html = renderSuccessHtml({
      expiresDays: Math.round(expiresIn / 86400),
      addressesCount,
      primaryAddress,
    });

    const response = new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    // Store access token in secure 5-day cookie
    response.cookies.set('swiggy_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn,
    });

    // Clear one-time PKCE cookie
    response.cookies.delete('swiggy_pkce_session');

    return response;
  } catch (error) {
    console.error('Error in Swiggy OAuth callback:', error);
    return new NextResponse(
      renderErrorHtml(`Failed to complete authentication: ${error.message}`),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

function renderSuccessHtml({ expiresDays, addressesCount, primaryAddress }) {
  const addressText = primaryAddress
    ? `${primaryAddress.formattedAddress || primaryAddress.addressLine || 'Connected'}`
    : `${addressesCount > 0 ? `${addressesCount} saved addresses` : 'Active'}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Swiggy Instamart Connected | ShoppersDeals</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; max-width: 480px; width: 100%; padding: 36px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .badge-icon { width: 64px; height: 64px; background: #fc8019; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(252, 128, 25, 0.4); }
    .badge-icon svg { width: 36px; height: 36px; fill: white; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #ffffff; }
    p.subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
    .info-box { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 16px; text-align: left; margin-bottom: 24px; font-size: 13px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { color: #64748b; font-weight: 600; }
    .info-val { color: #f1f5f9; font-weight: 700; max-width: 60%; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn { display: block; width: 100%; padding: 14px 20px; border-radius: 14px; font-size: 14px; font-weight: 700; text-decoration: none; transition: all 0.2s; cursor: pointer; border: none; }
    .btn-primary { background: #fc8019; color: white; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(252, 128, 25, 0.3); }
    .btn-primary:hover { background: #e26e0e; }
    .btn-secondary { background: rgba(255,255,255,0.08); color: #cbd5e1; }
    .btn-secondary:hover { background: rgba(255,255,255,0.12); color: white; }
    .secure-note { font-size: 11px; color: #64748b; margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge-icon">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
    </div>
    <h1>Swiggy Instamart Connected!</h1>
    <p class="subtitle">Official Swiggy Builders Club MCP integration is now active on ShoppersDeals.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-val" style="color: #34d399;">● Connected & Verified</span>
      </div>
      <div class="info-row">
        <span class="info-label">Token Validity</span>
        <span class="info-val">${expiresDays} Days</span>
      </div>
      <div class="info-row">
        <span class="info-label">Linked Address</span>
        <span class="info-val" title="${addressText}">${addressText}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Capabilities</span>
        <span class="info-val">Live Stock & 1-Click Cart</span>
      </div>
    </div>

    <a href="/compare/grocery" class="btn btn-primary">Open Grocery Comparison →</a>
    <a href="/" class="btn btn-secondary">Return to Homepage</a>

    <div class="secure-note">
      🔒 Authenticated via Swiggy OAuth 2.1 PKCE (mcp.swiggy.com)
    </div>
  </div>
</body>
</html>`;
}

function renderErrorHtml(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authentication Error | ShoppersDeals</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; max-width: 440px; width: 100%; padding: 36px; text-align: center; }
    .icon { width: 56px; height: 56px; background: rgba(239, 68, 68, 0.15); border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 18px; color: #ef4444; font-size: 24px; font-weight: bold; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 13px; margin-bottom: 24px; line-height: 1.5; }
    .btn { display: block; padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; background: #334155; color: white; transition: background 0.2s; }
    .btn:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h1>Authentication Failed</h1>
    <p>${message}</p>
    <a href="/api/auth/swiggy/login" class="btn">Try Again →</a>
  </div>
</body>
</html>`;
}
