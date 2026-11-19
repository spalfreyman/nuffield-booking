import './globals.css';
import type { ReactNode } from 'react';
export const metadata = { title: 'Nuffield Health – book an appointment', description: 'Demo booking journey' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en-GB"><body>{children}</body></html>);
}
