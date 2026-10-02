export const metadata = {
  title: 'Support',
  description: 'Get help with ShoppersDeals — FAQs and how to reach us.',
  alternates: { canonical: '/support' },
};

const FAQS = [
  {
    q: 'How does ShoppersDeals find and verify deals?',
    a: 'Our price-tracking engine monitors product prices in real time across Amazon, Flipkart, Myntra, Meesho and more. A deal only appears once it’s checked against its 30-day and 90-day price history — not just badged "SALE" by a feed.',
  },
  {
    q: 'Why did a deal price change when I opened the retailer’s app?',
    a: 'Hot deals sell out quickly — sellers can change prices or end a flash sale within minutes. We recommend grabbing a verified hot deal as soon as you see it.',
  },
  {
    q: 'Are there any extra costs for buying through ShoppersDeals?',
    a: 'No. Prices are identical to (or cheaper than) buying directly. You check out on Amazon, Flipkart, Myntra, or Meesho using your own account.',
  },
  {
    q: 'How do I save deals for later?',
    a: 'Tap the heart icon on any deal card. Sign in to sync your saved deals across devices, or use them as a guest on this device only.',
  },
  {
    q: 'How do I delete my account and data?',
    a: 'See our dedicated Delete Your Account page for both in-app and email options.',
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-[800px] px-5 py-6 pb-16">
      <h1 className="mb-2.5 text-[28px] font-bold text-[#111827]">Support</h1>
      <p className="mb-7 text-sm text-[#6b7280]">We're here to help.</p>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">Contact us</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        Email <a href="mailto:support@shoppersdeals.in" className="font-semibold text-[#ff6b00]">support@shoppersdeals.in</a> for anything — a bug, a deal that looks wrong, an account question, or feedback. We reply within 2 business days.
      </p>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">Frequently asked questions</h2>
      <div className="mt-3 flex flex-col gap-5">
        {FAQS.map((item) => (
          <div key={item.q}>
            <p className="mb-1.5 text-base font-bold text-[#1f2937]">{item.q}</p>
            <p className="text-base leading-6 text-[#4b5563]">{item.a}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2.5 mt-8 text-xl font-bold text-[#1f2937]">More</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        <a href="/privacy" className="font-semibold text-[#ff6b00]">Privacy Policy</a> &middot;{' '}
        <a href="/delete-account" className="font-semibold text-[#ff6b00]">Delete Your Account</a> &middot;{' '}
        <a href="/affiliate-disclosure" className="font-semibold text-[#ff6b00]">Affiliate Disclosure</a>
      </p>
    </div>
  );
}
