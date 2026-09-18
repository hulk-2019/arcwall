import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "zh",
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

import { ProjectCard, type ProjectRow } from "./ProjectCard";

const baseProject: ProjectRow = {
  id: 1,
  name: "夜行",
  canvasId: 9,
  nodeCount: 4,
  coverUrl: null,
  coverTiles: [],
};

describe("ProjectCard cover mosaic", () => {
  it("renders a 2x2 mosaic of image and video tiles", () => {
    const html = renderToStaticMarkup(
      <ProjectCard
        project={{
          ...baseProject,
          coverTiles: [
            { kind: "image", url: "https://oss.test/a.png" },
            { kind: "image", url: "https://oss.test/b.png" },
            { kind: "video", url: "https://oss.test/c.mp4" },
            { kind: "image", url: "https://oss.test/d.png" },
          ],
        }}
        isRenaming={false}
        renameValue=""
        onRenameValueChange={() => undefined}
        onOpen={() => undefined}
        onStartRename={() => undefined}
        onCommitRename={() => undefined}
        onCancelRename={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(html).toContain("https://oss.test/a.png");
    expect(html).toContain("https://oss.test/b.png");
    expect(html).toContain("https://oss.test/c.mp4");
    expect(html).toContain("<video");
    expect(html).toContain("grid-cols-2");
  });
});
