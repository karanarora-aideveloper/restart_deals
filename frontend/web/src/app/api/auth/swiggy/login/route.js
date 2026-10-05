import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  generatePkcePair,
  getSwiggyAuthUrl,
} from '@/lib/swiggyMcpService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const host = request.headers.get('host') || 'shoppersdeals.in';
    let redirectUri = 'https://shoppersdeals.in/api/auth/swiggy/callback';

    if (host.includes('localhost')) {
      redirectUri = 'http://localhost:3000/api/auth/swiggy/callback';
    } else if (host.startsWith('www.')) {
      redirectUri = 'https://www.shoppersdeals.in/api/auth/swiggy/callback';
    }

    // Generate PKCE code verifier and challenge
    const { codeVerifier, codeChallenge } = await generatePkcePair();
    const state = crypto.randomBytes(16).toString('hex');

    // Build official Swiggy authorization URL
    const authUrl = getSwiggyAuthUrl({
      redirectUri,
      state,
      codeChallenge,
      scope: 'mcp:tools',
    });

    // Package session data to verify callback
    const sessionData = JSON.stringify({
      codeVerifier,
      state,
      redirectUri,
      createdAt: Date.now(),
    });

    const response = NextResponse.redirect(authUrl);

    // Set secure cookie valid for 10 minutes
    response.cookies.set('swiggy_pkce_session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('Error starting Swiggy OAuth flow:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Swiggy authentication', details: error.message },
      { status: 500 }
    );
  }
}
