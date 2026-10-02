import Link from 'next/link';

/**
 * Clean, fast server-rendered footer — brand summary, navigation links,
 * legal compliance, and Amazon Associate disclosure.
 */
export default function SiteFooter() {
  return (
    <footer className="w-full bg-[#0f172a] pt-12 text-[#94a3b8]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap justify-between gap-10 px-6 pb-10">
        {/* Brand & Mission */}
        <div className="min-w-[280px] max-w-[420px] flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white font-black text-lg">
              SD
            </span>
            <h2 className="text-xl font-black text-white">
              Shoppers<span className="text-brand">Deals</span>
            </h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#94a3b8]">
            ShoppersDeals is India&apos;s premier live deal tracking platform. We monitor Amazon, Flipkart, Myntra, and top stores 24/7 to bring you verified price drops, lightning loot deals, and coupons.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Price Tracker Active Across 100+ Stores</span>
          </div>
        </div>

        {/* Explore Hubs */}
        <div className="min-w-[160px] flex-1">
          <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-white">Explore</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/" className="text-[#cbd5e1] hover:text-white transition-colors">Live Feed</Link></li>
            <li><Link href="/hot" className="text-[#cbd5e1] hover:text-white transition-colors">Hot Deals 🔥</Link></li>
            <li><Link href="/products" className="text-[#cbd5e1] hover:text-white transition-colors">Price Tracker</Link></li>
            <li><Link href="/compare" className="text-[#cbd5e1] hover:text-white transition-colors">Compare Products</Link></li>
            <li><Link href="/categories" className="text-[#cbd5e1] hover:text-white transition-colors">Browse Categories</Link></li>
            <li><Link href="/blog" className="text-[#cbd5e1] hover:text-white transition-colors">Shopping Guides</Link></li>
          </ul>
        </div>

        {/* Categories Quick Links */}
        <div className="min-w-[160px] flex-1">
          <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-white">Categories</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/categories/electronics" className="text-[#cbd5e1] hover:text-white transition-colors">Electronics &amp; Mobiles</Link></li>
            <li><Link href="/categories/fashion" className="text-[#cbd5e1] hover:text-white transition-colors">Fashion &amp; Apparel</Link></li>
            <li><Link href="/categories/home" className="text-[#cbd5e1] hover:text-white transition-colors">Home &amp; Kitchen</Link></li>
            <li><Link href="/categories/beauty" className="text-[#cbd5e1] hover:text-white transition-colors">Beauty &amp; Grooming</Link></li>
            <li><Link href="/categories/fitness" className="text-[#cbd5e1] hover:text-white transition-colors">Fitness &amp; Sports</Link></li>
          </ul>
        </div>

        {/* Top 20 Buying Guides */}
        <div className="min-w-[160px] flex-1">
          <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-white">Top 20 Guides</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/best/mobiles" className="text-[#cbd5e1] hover:text-white transition-colors font-bold text-amber-400">Best 5G Mobile Phones 🔥</Link></li>
            <li><Link href="/best/laptops" className="text-[#cbd5e1] hover:text-white transition-colors">Best Laptops (2026)</Link></li>
            <li><Link href="/best/earbuds-headphones" className="text-[#cbd5e1] hover:text-white transition-colors">Best Earbuds &amp; Audio</Link></li>
            <li><Link href="/best/smartwatches" className="text-[#cbd5e1] hover:text-white transition-colors">Best Smartwatches</Link></li>
            <li><Link href="/best/skincare" className="text-[#cbd5e1] hover:text-white transition-colors">Best Skincare Deals</Link></li>
            <li><Link href="/best/makeup" className="text-[#cbd5e1] hover:text-white transition-colors">Best Makeup &amp; Cosmetics</Link></li>
            <li><Link href="/best/supplements" className="text-[#cbd5e1] hover:text-white transition-colors">Best Supplements &amp; Whey</Link></li>
            <li><Link href="/best/running-shoes" className="text-[#cbd5e1] hover:text-white transition-colors">Best Running Shoes</Link></li>
          </ul>
        </div>

        {/* Legal & Compliance */}
        <div className="min-w-[160px] flex-1">
          <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-white">Legal &amp; Trust</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/privacy" className="text-[#cbd5e1] hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link href="/affiliate-disclosure" className="text-[#cbd5e1] hover:text-white transition-colors">Affiliate Disclosure</Link></li>
            <li><Link href="/delete-account" className="text-[#cbd5e1] hover:text-white transition-colors">Delete Account</Link></li>
            <li><Link href="/support" className="text-[#cbd5e1] hover:text-white transition-colors">Support &amp; Feedback</Link></li>
            <li><Link href="/sitemap" className="text-[#cbd5e1] hover:text-white transition-colors">Sitemap &amp; Directory</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright & Disclaimer Bar */}
      <div className="w-full border-t border-[#1e293b] px-6 py-5 text-center bg-[#090e1a]">
        <p className="mx-auto max-w-[1440px] text-[11px] leading-relaxed text-[#64748b]">
          © {new Date().getFullYear()} ShoppersDeals. All rights reserved. Prices and availability are accurate as of the date/time indicated and are subject to change. As an Amazon Associate and affiliate partner, we earn from qualifying purchases.
        </p>
      </div>
    </footer>
  );
}
