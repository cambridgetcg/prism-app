import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PRISM - Price Index for TCG Market Intelligence',
  description: 'Real-time price tracking and market intelligence for One Piece TCG cards',
  keywords: ['One Piece TCG', 'card prices', 'price index', 'TCG market', 'trading cards'],
  authors: [{ name: 'Cambridge TCG' }],
  openGraph: {
    title: 'PRISM - Price Index for TCG Market Intelligence',
    description: 'Real-time price tracking and market intelligence for One Piece TCG cards',
    url: 'https://app.cambridgetcg.com',
    siteName: 'PRISM',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-prism-bg">
          <header className="border-b border-prism-border bg-prism-bg-secondary">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-prism-accent rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-prism-text">PRISM</h1>
                  <p className="text-xs text-prism-text-muted">Price Index for TCG Market Intelligence</p>
                </div>
              </div>
              <nav className="flex items-center gap-6">
                <a href="/" className="text-sm text-prism-text-muted hover:text-prism-text transition-colors">
                  Dashboard
                </a>
                <a href="/tcg100" className="text-sm text-prism-text-muted hover:text-prism-text transition-colors">
                  TCG-100
                </a>
                <a href="/movers" className="text-sm text-prism-text-muted hover:text-prism-text transition-colors">
                  Movers
                </a>
                <a href="/cards" className="text-sm text-prism-text-muted hover:text-prism-text transition-colors">
                  All Cards
                </a>
              </nav>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>
          <footer className="border-t border-prism-border bg-prism-bg-secondary mt-auto">
            <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-prism-text-muted">
              <p>&copy; {new Date().getFullYear()} Cambridge TCG. Prices updated twice daily from TCGplayer.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
