import { NextResponse } from 'next/server';
import { getInstamartAddresses } from '@/lib/swiggyMcpService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const token = request.cookies.get('swiggy_access_token')?.value;

  if (!token) {
    return NextResponse.json({
      connected: false,
      message: 'No active Swiggy MCP session found',
    });
  }

  try {
    const addressData = await getInstamartAddresses({ token });
    const addresses = addressData?.data?.addresses || [];

    return NextResponse.json({
      connected: true,
      addressesCount: addresses.length,
      primaryAddress: addresses[0] || null,
      message: 'Active 5-day Swiggy MCP session',
    });
  } catch (err) {
    if (err.message === 'SWIGGY_AUTH_EXPIRED') {
      const res = NextResponse.json({
        connected: false,
        expired: true,
        message: 'Swiggy MCP session has expired. Re-authentication required.',
      });
      res.cookies.delete('swiggy_access_token');
      return res;
    }

    // Token exists but address call failed (e.g. timeout) - still connected
    return NextResponse.json({
      connected: true,
      message: 'Active Swiggy MCP session',
    });
  }
}

export async function DELETE() {
  const res = NextResponse.json({
    connected: false,
    message: 'Swiggy MCP session disconnected',
  });
  res.cookies.delete('swiggy_access_token');
  return res;
}
