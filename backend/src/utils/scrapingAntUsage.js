/**
 * ScrapingAnt Usage & Quota Verification Utility
 * Calls ScrapingAnt's live usage API to inspect credit status, plan, and monthly renewal dates.
 */
export async function checkScrapingAntUsage(token) {
  try {
    const url = `https://api.scrapingant.com/v2/usage?x-api-key=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();

    if (!response.ok || data.detail) {
      return {
        valid: false,
        statusCode: response.status,
        error: data.detail || `HTTP ${response.status}: Failed to fetch usage`
      };
    }

    return {
      valid: true,
      statusCode: response.status,
      planName: data.plan_name || 'Free',
      planTotalCredits: data.plan_total_credits || 10000,
      remainedCredits: typeof data.remained_credits === 'number' ? data.remained_credits : 0,
      renewalDate: data.end_date ? new Date(data.end_date) : null,
      startDate: data.start_date ? new Date(data.start_date) : null,
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message
    };
  }
}
