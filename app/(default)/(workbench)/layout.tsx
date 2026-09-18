"use client";

import { Sidebar } from "@/components/my-works/sidebar";
import { usePathname } from "next/navigation";

export default function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background md:flex-row">
      <Sidebar pathname={pathname} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-background" data-workbench-scroll>
        {children}
      </div>
    </div>
  );
}
