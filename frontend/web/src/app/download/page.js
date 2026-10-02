import Image from 'next/image';
import { SITE_URL } from '@/lib/config';

export const metadata = {
  title: 'Download the ShoppersDeals App',
  description:
    'Download the ShoppersDeals Android app (APK) to get live deals, price-drop alerts, and exclusive offers straight to your phone.',
  alternates: { canonical: '/download' },
};

const APK_URL = '/downloads/shoppersdeals.apk';
const APK_VERSION = '1.2.4';
const APK_SIZE = '57 MB';

const STEPS = [
  {
    title: 'Tap the download button',
    body: 'Your browser will save the ShoppersDeals APK to your Downloads folder.',
  },
  {
    title: 'Allow installs from this source',
    body: 'If prompted, enable "Install unknown apps" for your browser in Android Settings.',
  },
  {
    title: 'Open the downloaded file',
    body: 'Tap the APK in your notifications or Downloads folder, then tap Install.',
  },
];

export default function DownloadPage() {
  return (
    <div className="mx-auto w-full max-w-[800px] px-5 py-10 pb-16">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="ShoppersDeals"
          width={72}
          height={72}
          className="mb-4 rounded-2xl"
        />
        <h1 className="mb-2.5 text-[28px] font-bold text-[#111827]">
          Download the ShoppersDeals App
        </h1>
        <p className="mb-7 max-w-[520px] text-sm text-[#6b7280]">
          Get live deals, price-drop alerts, and exclusive offers on Amazon, Flipkart, Myntra and
          more &mdash; straight to your Android phone.
        </p>

        <a
          href={APK_URL}
          download
          className="inline-flex items-center gap-2 rounded-xl bg-[#ff6b00] px-8 py-4 text-base font-bold text-white shadow-sm transition hover:bg-[#e65f00]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          Download APK
        </a>

        <p className="mt-3 text-xs text-[#9ca3af]">
          Version {APK_VERSION} &middot; {APK_SIZE} &middot; For Android
        </p>
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold text-[#1f2937]">How to install</h2>
      <div className="flex flex-col gap-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff1e6] text-sm font-bold text-[#ff6b00]">
              {i + 1}
            </span>
            <div>
              <p className="text-base font-bold text-[#1f2937]">{step.title}</p>
              <p className="text-sm leading-6 text-[#4b5563]">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs leading-5 text-[#9ca3af]">
        ShoppersDeals is distributed directly as an APK outside the Play Store. Android may warn
        that the app is from an unknown source &mdash; this is expected for direct downloads and
        safe to proceed for this file.
      </p>

      <p className="mt-4 text-sm text-[#4b5563]">
        Having trouble? <a href="/support" className="font-semibold text-[#ff6b00]">Contact support</a>.
      </p>
    </div>
  );
}
