import type { Metadata } from 'next';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-serif/600.css';
import './globals.css';
import AppProviders from '@/components/AppProviders';
import ScreenLockProvider from '@/components/ScreenLockProvider';
import AuthenticatedShell from '@/components/AuthenticatedShell';

export const metadata: Metadata = {
  title: 'OmniTool — Work Command Centre',
  description: 'Lightweight, self-hosted work command centre for commitment management.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ScreenLockProvider>
        <AppProviders>
          <AuthenticatedShell>{children}</AuthenticatedShell>
        </AppProviders>
        </ScreenLockProvider>
      </body>
    </html>
  );
}
