export const metadata = {
  title: 'Privacy Policy',
  description: 'How ShoppersDeals collects, uses, and protects your information.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-[800px] px-5 py-6 pb-16">
      <h1 className="mb-2.5 text-[28px] font-bold text-[#111827]">Privacy Policy</h1>
      <p className="mb-7 text-sm text-[#6b7280]">Last Updated: August 2026</p>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">1. Information We Collect</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        When you use ShoppersDeals, we may collect the following types of information:
      </p>
      <ul className="mb-2.5 list-disc space-y-1 pl-5 text-base leading-6 text-[#4b5563]">
        <li>Account Information: If you create an account, we collect your name, email address, and profile picture (via Google Sign-in).</li>
        <li>Contact Information: With your explicit permission, we may access your contacts to help you share deals with friends.</li>
        <li>Usage Data: Information about how you interact with our app, the deals you save, and the links you click.</li>
      </ul>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">2. How We Use Your Information</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">We use the collected information to:</p>
      <ul className="mb-2.5 list-disc space-y-1 pl-5 text-base leading-6 text-[#4b5563]">
        <li>Provide and maintain our service</li>
        <li>Personalize your experience and show you relevant deals</li>
        <li>Sync your saved deals across devices</li>
        <li>Allow you to easily share deals with your contacts</li>
      </ul>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">3. Sharing Your Information</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        We do not sell your personal information to third parties. We may share your information only in the following circumstances:
      </p>
      <ul className="mb-2.5 list-disc space-y-1 pl-5 text-base leading-6 text-[#4b5563]">
        <li>With your consent</li>
        <li>To comply with legal obligations</li>
        <li>With service providers who assist us in operating our app (e.g., Firebase for database and authentication)</li>
      </ul>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">4. Data Security</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        We implement appropriate technical and organizational measures to protect your personal data against unauthorized or unlawful processing, accidental loss, destruction, or damage.
      </p>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">5. Your Rights</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        You have the right to access, update, or delete your personal information. You can manage your account settings within the app or contact us directly for assistance.
      </p>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">6. Contact Us</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        If you have any questions about this Privacy Policy, please contact us at: support@shoppersdeals.in
      </p>
    </div>
  );
}
