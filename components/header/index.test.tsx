import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const state = {
  pathname: "/",
  user: null as unknown,
};

const NAV = [
  { key: "home", title: "首页", url: "/" },
  { key: "canvas", title: "AI画布", url: "/canvas", auth: true },
  { key: "workbench", title: "工作台", url: "/my-works", auth: true },
];

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) =>
      ({
        login: "登录",
        navAria: "主导航",
        openMenu: "打开菜单",
        closeMenu: "关闭菜单",
        brand: "ArcWall",
      })[key] ?? key;
    (t as typeof t & { raw: () => typeof NAV }).raw = () => NAV;
    return t;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/store/useAppStore", () => ({
  useAppStore: () => ({ user: state.user }),
}));

vi.mock("@/components/language-toggle", () => ({
  default: () => <div>language</div>,
}));

vi.mock("@/components/theme-toggle", () => ({
  default: () => <div>theme</div>,
}));

vi.mock("@/components/user", () => ({
  default: () => <div>user-menu</div>,
}));

vi.mock("@/components/ui/loading", () => ({
  Loading: () => <div>loading</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button {...props}>{children}</button>
  ),
}));

import Header from "./index";

describe("Header navigation", () => {
  it("renders home, AI canvas, and workbench links", () => {
    state.pathname = "/";
    state.user = { id: 1 };
    const html = renderToStaticMarkup(<Header />);

    expect(html).toContain("首页");
    expect(html).toContain("AI画布");
    expect(html).toContain("工作台");
    expect(html).toContain('href="/canvas"');
    expect(html).toContain('href="/my-works"');
  });

  it("sends signed-out users to sign-in for canvas and workbench", () => {
    state.pathname = "/";
    state.user = null;
    const html = renderToStaticMarkup(<Header />);

    expect(html).toContain('href="/sign-in?redirect_url=%2Fcanvas"');
    expect(html).toContain('href="/sign-in?redirect_url=%2Fmy-works"');
    expect(html).toContain('href="/"');
  });
});
