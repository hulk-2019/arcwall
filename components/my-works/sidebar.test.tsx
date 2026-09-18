import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
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

import { Sidebar } from "./sidebar";

describe("Workbench sidebar", () => {
  it("marks the current workbench section and links to each page", () => {
    const html = renderToStaticMarkup(<Sidebar pathname="/my-works" />);

    expect(html).toContain('href="/my-works"');
    expect(html).toContain('href="/published"');
    expect(html).toContain('href="/favorites"');
    expect(html).toContain('href="/trash"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("creations");
    expect(html).toContain("published");
  });
});
