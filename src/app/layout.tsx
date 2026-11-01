import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StoreProvider } from '@/lib/store';

// Mirrors the basePath resolution in next.config.js; metadata asset URLs are not prefixed automatically.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || (process.env.GITHUB_ACTIONS ? '/BLS-Kicker-App' : '')).replace(/\/+$/, '');

export const metadata: Metadata = {
  title: 'Kicker League – Digitale Tischkicker-Liga',
  description: 'Moderne, hochwertige Web-App für geschlossene Tischkicker-Ligen mit ELO-System, Turniermodus, Leveling und Statistiken.',
  manifest: `${basePath}/manifest.json`,
  icons: {
    icon: `${basePath}/icon.svg`,
    apple: `${basePath}/icon.svg`,
  },
};

// Pinch-zoom stays enabled for accessibility; viewport-fit=cover enables safe-area insets.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#091b12',
};

// The static export inlines bootstrap scripts, so 'unsafe-inline' is required.
// 'unsafe-eval' is only needed by the Next.js dev server (React Refresh).
const scriptSrc = process.env.NODE_ENV === 'production'
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// Note: X-Content-Type-Options, frame-ancestors and HSTS are ignored in <meta>
// tags. They must be sent as real HTTP response headers by the hosting layer
// (GitHub Pages cannot set custom headers; use a proxy/CDN if they are required).
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen text-slate-100 flex flex-col selection:bg-emerald-600 selection:text-white">
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
