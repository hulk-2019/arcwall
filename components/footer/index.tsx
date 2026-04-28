import Link from "next/link";
import Image from "next/image";
import { Github, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="w-full border-t border-border bg-background py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">{t("rights")}</p>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center gap-4 border-t sm:border-t-0 border-border pt-4 sm:pt-0 sm:pl-6">
            <Link
              href="https://github.com/hulk-2019"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
            </Link>

            <div className="relative group flex items-center justify-center cursor-pointer text-muted-foreground hover:text-[#07C160] transition-colors">
              <MessageCircle className="w-5 h-5" />

              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                <div className="bg-card border border-border rounded-lg shadow-xl p-3 flex flex-col items-center gap-2">
                  <div className="w-32 h-32 relative bg-white rounded-md flex items-center justify-center overflow-hidden">
                    <Image src="/wechat-qr.jpg" alt="WeChat QR Code" fill className="object-contain" />
                  </div>
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">扫一扫联系我们</span>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-b border-r border-border transform rotate-45"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
