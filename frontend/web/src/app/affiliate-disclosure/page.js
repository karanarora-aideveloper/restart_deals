export const metadata = {
  title: 'Affiliate Disclosure',
  description: 'How ShoppersDeals earns from qualifying purchases through the Amazon Associates Program, Cuelinks, and other affiliate partners.',
  alternates: { canonical: '/affiliate-disclosure' },
};

export default function AffiliateDisclosurePage() {
  return (
    <div className="mx-auto w-full max-w-[800px] px-5 py-6 pb-16">
      <h1 className="mb-2.5 text-[28px] font-bold text-[#111827]">Affiliate Disclosure</h1>
      <p className="mb-7 text-sm text-[#6b7280]">Last Updated: August 2026</p>

      <div className="mb-6 rounded-xl border border-[#d1fae5] bg-[#ecfdf5] px-4 py-3.5">
        <p className="text-[15px] font-semibold leading-6 text-[#065f46]">
          As an Amazon Associate, ShoppersDeals earns from qualifying purchases. This applies to all Amazon links on our site and app.
        </p>
      </div>

      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        In accordance with the Federal Trade Commission&apos;s (FTC) 16 CFR Part 255 guidelines and industry best practices for affiliate disclosure, ShoppersDeals (&quot;we&quot;, &quot;us&quot;) discloses the following relationships as part of our commitment to transparency with our users.
      </p>

      <h2 className="mb-2.5 mt-6 text-xl font-bold text-[#1f2937]">1. What is an affiliate link?</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        A deal, product, or &quot;GET DEAL&quot; / &quot;View on&quot; button on ShoppersDeals typically links out to a retailer&apos;s website (e.g. Amazon.in, Flipkart.com, Myntra.com) using a special tracking link provided by an affiliate program. If you click that link and complete a qualifying purchase, we may earn a small commission from the retailer or affiliate network. This is standard practice across the deals and coupons industry, and it&apos;s how we&apos;re able to keep ShoppersDeals free to use.
      </p>

      <h2 className="mb-2.5 mt-6 text-xl font-bold text-[#1f2937]">2. Amazon Associates Program (India)</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        ShoppersDeals is a participant in the Amazon Services LLC Associates Program / Amazon.in affiliate program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.in. As an Amazon Associate, we earn from qualifying purchases made through Amazon links on our site and app.
      </p>

      <h2 className="mb-2.5 mt-6 text-xl font-bold text-[#1f2937]">3. Cuelinks and other affiliate networks</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        For deals and products from Flipkart, Myntra, Meesho, and other partner retailers, ShoppersDeals uses Cuelinks — an affiliate marketing network that connects publishers like us with hundreds of Indian e-commerce merchants. When you click through one of these links and make a purchase, Cuelinks tracks the referral and we earn a commission from the respective retailer. We may also work directly with individual retailers&apos; own affiliate programs from time to time.
      </p>

      <h2 className="mb-2.5 mt-6 text-xl font-bold text-[#1f2937]">4. What this means for you</h2>
      <ul className="mb-2.5 list-disc space-y-2 pl-5 text-base leading-6 text-[#4b5563]">
        <li><span className="font-semibold text-[#1f2937]">No extra cost:</span> Clicking a deal link and buying through it costs you exactly the same as going directly to the retailer&apos;s site. Our commission is paid by the retailer, never added to your price.</li>
        <li><span className="font-semibold text-[#1f2937]">Unbiased deal selection:</span> Deals are featured based on genuine discount size, price-drop history, and relevance — not on which link pays us more.</li>
        <li><span className="font-semibold text-[#1f2937]">Secure checkout, always:</span> Every purchase is completed directly on the retailer&apos;s own website or app (Amazon, Flipkart, Myntra, etc.). ShoppersDeals never handles your payment details, passwords, or order information.</li>
        <li><span className="font-semibold text-[#1f2937]">Independent opinions:</span> Any recommendations, guides, or reviews on ShoppersDeals reflect our own assessment of a deal and are not influenced by affiliate payouts.</li>
      </ul>

      <h2 className="mb-2.5 mt-6 text-xl font-bold text-[#1f2937]">5. Questions?</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        If you have any questions about this disclosure or how we use affiliate links, contact us at: support@shoppersdeals.in
      </p>
    </div>
  );
}
