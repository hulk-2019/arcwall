import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const state = {
  nodes: [],
  undo: vi.fn(),
  redo: vi.fn(),
  dirty: false,
  isSaving: false,
};

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

vi.mock("@/store/useCanvasStore", () => ({
  useCanvasStore: (selector: (value: typeof state) => unknown) => selector(state),
}));

vi.mock("@/store/useAppStore", () => ({
  useAppStore: (selector: (value: { user: { credits: { left_credits: number } } }) => unknown) =>
    selector({ user: { credits: { left_credits: 12 } } }),
}));

vi.mock("@/components/language-toggle", () => ({
  default: () => <div>language-toggle</div>,
}));

vi.mock("@/components/theme-toggle", () => ({
  default: () => <div>theme-toggle</div>,
}));

import { CanvasToolbar } from "./CanvasToolbar";

describe("CanvasToolbar", () => {
  it("puts language and theme toggles on the right of the top bar", () => {
    const html = renderToStaticMarkup(
      <CanvasToolbar
        projectName="Demo"
        isRunning={false}
        execution={null}
        onRun={() => {}}
      />,
    );

    const runIndex = html.indexOf("runAll");
    const languageIndex = html.indexOf("language-toggle");
    const themeIndex = html.indexOf("theme-toggle");

    expect(runIndex).toBeGreaterThan(-1);
    expect(languageIndex).toBeGreaterThan(runIndex);
    expect(themeIndex).toBeGreaterThan(languageIndex);
  });
});
