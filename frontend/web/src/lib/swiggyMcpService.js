/**
 * Swiggy Builders Club MCP Client Service
 * Official integration for Swiggy Instamart MCP Server (https://mcp.swiggy.com/im)
 * Reference: https://mcp.swiggy.com/builders/llms.txt
 */

export const SWIGGY_MCP_IM_ENDPOINT = 'https://mcp.swiggy.com/im';
export const SWIGGY_MCP_FOOD_ENDPOINT = 'https://mcp.swiggy.com/food';
export const SWIGGY_OAUTH_AUTHORIZE_URL = 'https://mcp.swiggy.com/auth/authorize';
export const SWIGGY_OAUTH_TOKEN_URL = 'https://mcp.swiggy.com/auth/token';
export const SWIGGY_CLIENT_ID = 'swiggy-mcp';

/**
 * Generate PKCE Code Verifier & Challenge (RFC 7636)
 */
export async function generatePkcePair() {
  const crypto = await import('crypto');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Build the official OAuth 2.1 PKCE authorization URL
 */
export function getSwiggyAuthUrl({
  redirectUri,
  state,
  codeChallenge,
  scope = 'mcp:tools',
}) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SWIGGY_CLIENT_ID,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    scope,
  });
  return `${SWIGGY_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange Authorization Code for 5-day Access Token
 */
export async function exchangeSwiggyAuthCode({
  code,
  codeVerifier,
  redirectUri,
}) {
  const res = await fetch(SWIGGY_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error_description || `Failed to exchange Swiggy auth code (${res.status})`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 432000,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
  };
}

/**
 * Generic JSON-RPC 2.0 tool caller for Swiggy MCP servers
 */
export async function callSwiggyMcpTool({
  token,
  serverEndpoint = SWIGGY_MCP_IM_ENDPOINT,
  toolName,
  args = {},
  timeoutMs = 8000,
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(serverEndpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
        id: Math.floor(Math.random() * 100000),
      }),
    });

    clearTimeout(timeoutId);

    if (res.status === 401) {
      throw new Error('SWIGGY_AUTH_EXPIRED');
    }

    if (!res.ok) {
      throw new Error(`Swiggy MCP server responded with HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(json.error.message || 'Swiggy MCP tool call failed');
    }

    return json.result || json;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Instamart: Search live products by address
 */
export async function searchInstamartProducts({
  token,
  addressId,
  query,
  offset = 0,
}) {
  return callSwiggyMcpTool({
    token,
    serverEndpoint: SWIGGY_MCP_IM_ENDPOINT,
    toolName: 'search_products',
    args: { addressId, query, offset },
  });
}

/**
 * Instamart: Fetch user's saved delivery addresses
 */
export async function getInstamartAddresses({ token }) {
  return callSwiggyMcpTool({
    token,
    serverEndpoint: SWIGGY_MCP_IM_ENDPOINT,
    toolName: 'get_addresses',
    args: {},
  });
}

/**
 * Instamart: Update / push items to user's real Instamart cart
 */
export async function updateInstamartCart({ token, items }) {
  return callSwiggyMcpTool({
    token,
    serverEndpoint: SWIGGY_MCP_IM_ENDPOINT,
    toolName: 'update_cart',
    args: { items },
  });
}

/**
 * Instamart: List applicable coupons for current cart
 */
export async function listInstamartCoupons({ token }) {
  return callSwiggyMcpTool({
    token,
    serverEndpoint: SWIGGY_MCP_IM_ENDPOINT,
    toolName: 'list_coupons',
    args: {},
  });
}
