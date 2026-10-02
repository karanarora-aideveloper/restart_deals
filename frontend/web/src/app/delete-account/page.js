export const metadata = {
  title: 'Delete Your Account',
  description: 'How to request deletion of your ShoppersDeals account and the data tied to it.',
  alternates: { canonical: '/delete-account' },
};

export default function DeleteAccountPage() {
  return (
    <div className="mx-auto w-full max-w-[800px] px-5 py-6 pb-16">
      <h1 className="mb-2.5 text-[28px] font-bold text-[#111827]">Delete Your ShoppersDeals Account</h1>
      <p className="mb-7 text-sm text-[#6b7280]">Last Updated: August 2026</p>

      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        This page explains how to request that your ShoppersDeals account, and the personal data tied to it, is permanently deleted — whether or not you still have the app installed.
      </p>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">Option 1: Delete it yourself, in the app</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        This is the fastest way — it deletes your account immediately, with no waiting period.
      </p>
      <ol className="mb-2.5 list-decimal space-y-1 pl-5 text-base leading-6 text-[#4b5563]">
        <li>Open the ShoppersDeals app and sign in</li>
        <li>Go to the <strong>Account</strong> tab</li>
        <li>Scroll down and tap <strong>Delete Account Permanently</strong></li>
        <li>Confirm when prompted</li>
      </ol>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">Option 2: Request deletion by email</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        If you no longer have the app installed, can't sign in, or would rather not use the app, email{' '}
        <a href="mailto:support@shoppersdeals.in?subject=Account%20Deletion%20Request" className="font-semibold text-[#ff6b00]">
          support@shoppersdeals.in
        </a>{' '}
        from the email address on your account with the subject line <strong>"Account Deletion Request"</strong>. Include the email or phone number you signed up with so we can find your account. We process email requests within <strong>7 business days</strong>.
      </p>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">What gets deleted</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        Deleting your account is immediate and permanent — there is no recovery period. It removes:
      </p>
      <ul className="mb-2.5 list-disc space-y-1 pl-5 text-base leading-6 text-[#4b5563]">
        <li>Your name, email address, and profile photo</li>
        <li>Your Google sign-in ID and phone number (if either was used to sign in)</li>
        <li>Your saved/wishlisted deals list</li>
        <li>Your account and login history</li>
      </ul>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">What isn't deleted</h2>
      <ul className="mb-2.5 list-disc space-y-1 pl-5 text-base leading-6 text-[#4b5563]">
        <li>
          <strong>Push notification data.</strong> Your device's notification token is tied to the app installed on your phone, not to your account or identity, so account deletion doesn't remove it. Uninstalling the app (or turning off notifications in your phone's settings) stops deal alerts.
        </li>
        <li>
          <strong>Deals and product listings you interacted with.</strong> These are public catalog data, not personal to you, and aren't affected by your account deletion.
        </li>
      </ul>

      <h2 className="mb-2.5 mt-5 text-xl font-bold text-[#1f2937]">Questions</h2>
      <p className="mb-2.5 text-base leading-6 text-[#4b5563]">
        Contact us at <a href="mailto:support@shoppersdeals.in" className="font-semibold text-[#ff6b00]">support@shoppersdeals.in</a> — see also our{' '}
        <a href="/privacy" className="font-semibold text-[#ff6b00]">Privacy Policy</a>.
      </p>
    </div>
  );
}
