import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Footer, Nav } from '@/components/ui';

export const metadata: Metadata = { title: { default: 'DBZ Rush Fighter 2.0 Analytics', template: '%s · DBZ Rush Fighter 2.0' }, description: 'Match analytics, playstyle classification, coaching and Elo rankings for DBZ Rush Fighter 2.0.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0a0b10' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Nav />{children}<Footer /></body></html>;
}
