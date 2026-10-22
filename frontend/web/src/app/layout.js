import { Suspense } from 'react';
import Script from 'next/script';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { CompareProvider } from '@/lib/useCompare';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import MobileTabBar from '@/components/MobileTabBar';
import CompareDock from '@/components/CompareDock';
import NavigationProgressBar from '@/components/NavigationProgressBar';
import PushPromptBanner from '@/components/PushPromptBanner';
import PostHogProvider from '@/components/PostHogProvider';
import { headers } from 'next/headers';
import { SITE_URL, GA_MEASUREMENT_ID, getSiteBranding } from '@/lib/config';
import './globals.css';


const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export async function generateMetadata() {
  let host = '';
  try {
    const headerList = await headers();
    host = headerList.get('x-site-host') || headerList.get('x-forwarded-host') || headerList.get('host') || '';
  } catch (_) {}
  const branding = getSiteBranding(host);

  return {
    metadataBase: new URL(branding.siteUrl),
    title: {
      default: branding.defaultTitle,
      template: branding.titleTemplate,
    },
    description: branding.description,
    applicationName: branding.brandName,
    appleWebApp: { title: branding.brandName },
    manifest: '/site.webmanifest',
    icons: {
      icon: [
        { url: branding.isDealPanda ? '/dealpanda-logo.png' : '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
        { url: branding.isDealPanda ? '/dealpanda-logo.png' : '/favicon.svg', type: 'image/svg+xml' },
      ],
      shortcut: '/favicon.ico',
      apple: branding.isDealPanda ? '/dealpanda-logo.png' : '/apple-touch-icon.png',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      url: branding.siteUrl,
      title: `${branding.brandName} - The Best Live Shopping Deals, Coupons & Discounts`,
      description: branding.description,
      siteName: branding.brandName,
      images: [branding.isDealPanda ? `${branding.siteUrl}/dealpanda-banner.png` : `${branding.siteUrl}/logo.png`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${branding.brandName} - The Best Live Shopping Deals, Coupons & Discounts`,
      description: branding.description,
      images: [branding.isDealPanda ? `${branding.siteUrl}/dealpanda-banner.png` : `${branding.siteUrl}/logo.png`],
    },
    other: {
      'cuelinks-verification': 'VERIFY-CL-MKDHHLCP',
    },
  };
}

export default async function RootLayout({ children }) {
  let host = '';
  try {
    const headerList = await headers();
    host = headerList.get('x-site-host') || headerList.get('x-forwarded-host') || headerList.get('host') || '';
  } catch (_) {}
  const branding = getSiteBranding(host);

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: branding.brandName,
    url: `${branding.siteUrl}/`,
    logo: `${branding.siteUrl}${branding.logoUrl}`,
    sameAs: branding.isDealPanda ? [] : [
      'https://www.facebook.com/shoppersdeals',
      'https://twitter.com/shoppersdeals',
      'https://www.instagram.com/shoppersdeals',
      'https://www.linkedin.com/company/shoppersdeals',
      'https://www.youtube.com/@shoppersdeals',
    ],
  };

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: branding.brandName,
    url: `${branding.siteUrl}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${branding.siteUrl}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
  return (
    <html lang="en" className={`${outfit.variable} ${plusJakarta.variable}`}>
      <head>
        <meta name="cuelinks-verification" content="VERIFY-CL-MKDHHLCP" />
      </head>
      <body className="flex min-h-screen flex-col bg-[#faf8ff] font-sans text-[#0f172a] antialiased">
        {GA_MEASUREMENT_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}


        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }} />

        <PostHogProvider>
          <AuthProvider>
            <CompareProvider>
              <Suspense fallback={null}>
                <NavigationProgressBar />
              </Suspense>
              {/* SiteHeader reads useSearchParams (for the search box) — Suspense keeps that from
                  forcing every page in the app to opt out of static rendering. */}
              <Suspense fallback={<div className="h-[96px] w-full border-b border-[#eee] bg-white md:h-[76px]" />}>
                <SiteHeader />
              </Suspense>

              <main className="flex-1 pb-16 md:pb-0">{children}</main>
              <CompareDock />
              <PushPromptBanner />
              <SiteFooter />
              <MobileTabBar />
            </CompareProvider>
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
