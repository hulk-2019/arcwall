"use client";

import { AppStoreProvider } from "@/components/providers/AppStoreProvider";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { usePathname } from "next/navigation";

export default function ({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <AppStoreProvider>
      <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 flex flex-col w-full">
            <div className="flex-1 w-full">
              {children}
            </div>
          </main>
          {pathname === "/" && <Footer />}
      </div>
    </AppStoreProvider>
  );
}
