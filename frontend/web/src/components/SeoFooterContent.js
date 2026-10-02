// Static, server-rendered long-form editorial & shopping guide copy.
// Rendered on the homepage and editorial hubs to build domain topical authority
// without cluttering individual product entity pages.
export default function SeoFooterContent() {
  return (
    <section className="my-10 rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-10 shadow-xs text-gray-700">
      <div className="border-b border-gray-100 pb-4">
        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-brand">
          📖 Editorial &amp; Shopping Guide
        </span>
        <h2 className="mt-2 text-xl font-black text-gray-900 sm:text-2xl">
          How We Curate &amp; Verify Deals of the Day
        </h2>
      </div>

      <div className="mt-5 space-y-4 text-xs sm:text-sm leading-relaxed text-gray-600">
        <p>
          Most deal platforms simply pull data from an API, slap on a &quot;SALE&quot; badge, and call it a day. That&apos;s not how <strong className="text-gray-900">ShoppersDeals</strong> operates.
        </p>
        <p>
          Our daily deals go through a multi-layered verification process before appearing on this feed. Our proprietary price-tracking system continuously monitors product prices across major platforms including Amazon, Flipkart, Myntra, and Ajio. The system flags a product only when its current price drops meaningfully below its 30-day and 90-day historical average — not just a marginal 1% fluctuation.
        </p>
        <p>
          In addition, our automated validation cross-checks seller ratings, stock availability, and deceptive MRP hikes to ensure that every discount surfaced represents authentic savings.
        </p>
      </div>

      <div className="mt-8 border-t border-gray-100 pt-6">
        <h3 className="text-base font-extrabold text-gray-900 sm:text-lg">
          Smart Shopping Guide: How to Identify Deceptive Discounts
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed">
          Not every &quot;70% off&quot; is genuine. A common e-commerce pattern involves inflating a product&apos;s MRP right before a sale event and then &quot;discounting&quot; it back to its normal selling price. Here&apos;s how to protect your wallet:
        </p>

        <ul className="mt-3 space-y-2 text-xs sm:text-sm text-gray-600 list-disc pl-5">
          <li><strong>Check the 90-day price history:</strong> If a product has been sitting at the &quot;discounted&quot; price for months, it was never really on sale.</li>
          <li><strong>Watch for round-number discounts:</strong> Be cautious of sudden &quot;was ₹9,999, now ₹4,999&quot; cuts during festive sales without historical price support.</li>
          <li><strong>Verify seller authenticity:</strong> Prefer listings fulfilled by official brand stores or top-tier marketplace merchants.</li>
          <li><strong>Look for all-time historical floors:</strong> The biggest genuine savings occur when a product drops below its 6-month historical low.</li>
        </ul>
      </div>

      <div className="mt-8 border-t border-gray-100 pt-6">
        <h3 className="text-base font-extrabold text-gray-900 sm:text-lg">
          Average Savings Comparison: Standard Shopping vs. Verified Deals
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-gray-600">
          Data-backed comparison of verified daily deals versus untracked shopping:
        </p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full min-w-[500px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-900 font-bold">
                <th className="p-3">Feature</th>
                <th className="p-3">Regular Shopping</th>
                <th className="p-3 text-brand">ShoppersDeals Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {[
                ['Avg. Discount on Tech & Mobiles', '5 - 10%', '20 - 45% Genuine Drops'],
                ['Price History Verification', 'None / Manual search', 'Automated 90-day tracking'],
                ['Fake MRP Detection', 'None', 'AI discount anomaly scanner'],
                ['Coupon Codes & Bank Offers', 'Missed on checkout', 'Auto-detected & stacked'],
                ['Multi-Store Comparison', 'Manual tab switching', 'Live 100+ stores comparison'],
              ].map((row, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}>
                  <td className="p-3 font-semibold text-gray-800">{row[0]}</td>
                  <td className="p-3">{row[1]}</td>
                  <td className="p-3 font-bold text-emerald-600">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
