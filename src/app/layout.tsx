import type { Metadata } from 'next';
import { archiveConfig } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${archiveConfig.name} / ${archiveConfig.title}`, template: `%s / ${archiveConfig.name}` },
  description: archiveConfig.description,
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
