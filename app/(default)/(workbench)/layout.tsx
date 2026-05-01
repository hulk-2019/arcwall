'use client';

import { Sidebar } from '@/components/my-works/sidebar';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

export default function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-background">
      <Sidebar locale={locale} pathname={pathname} />
      <div className="flex-1 p-4 md:p-8 overflow-y-auto relative">
        {children}
      </div>
    </div>
  );
}
