import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CanvasNodeDTO } from "@/types/canvas";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const state = {
  nodes: [] as CanvasNodeDTO[],
  edges: [],
  updateNodeConfig: vi.fn(),
  editNodeConfig: vi.fn(),
  beginEdit: vi.fn(),
  deleteEdge: vi.fn(),
  setConnectFrom: vi.fn(),
  connectFrom: null,
  canvasId: 12,
  liveExecution: null,
};

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.raw = () => ({});
    return t;
  },
}));
vi.mock("@/store/useCanvasStore", () => ({
  useCanvasStore: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock("@/services/api", () => ({
  polishCanvasText: vi.fn(),
  submitCanvasLyrics: vi.fn(),
  getCanvasLyrics: vi.fn(),
}));
vi.mock("./PropertyFields", () => ({
  PropertyFields: () => null,
}));

import { NodeDock } from "./NodeDock";

function audioNode(mode: "custom" | "auto" | "instrumental"): CanvasNodeDTO {
  return {
    id: "audio-1",
    type: "audio",
    x: 0,
    y: 0,
    status: "idle",
    config: {
      title: "音频生成",
      model: "suno-v5",
      mode,
      text: "一首关于城市夜晚的歌",
      style: "pop",
      vocal: "female",
    },
  };
}

describe("NodeDock Suno lyrics action", () => {
  it("shows generate lyrics beside the text label in custom mode", () => {
    const html = renderToStaticMarkup(
      <NodeDock
        node={audioNode("custom")}
        onRunNode={vi.fn()}
        onRunDownstream={vi.fn()}
        runDisabled={false}
      />
    );

    expect(html).toContain("audioTextCustom");
    expect(html).toContain("generateLyrics");
  });

  it("does not show generate lyrics in automatic or instrumental mode", () => {
    for (const mode of ["auto", "instrumental"] as const) {
      const html = renderToStaticMarkup(
        <NodeDock
          node={audioNode(mode)}
          onRunNode={vi.fn()}
          onRunDownstream={vi.fn()}
          runDisabled={false}
        />
      );
      expect(html).not.toContain("generateLyrics");
    }
  });
});
