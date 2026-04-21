import type { ReactNode } from 'react';

export const metadata = {
  title: 'NeoSim',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000' }}>{children}</body>
    </html>
  );
}
