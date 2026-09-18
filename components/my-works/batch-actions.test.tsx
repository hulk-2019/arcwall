import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { BatchActions } from "./batch-actions";

const copy = {
  batch: {
    selected: "selected",
    deleteSelected: "delete",
    downloadSelected: "download",
    cancel: "cancel",
    unpublishSelected: "unpublish",
  },
};

describe("BatchActions", () => {
  it("centers the bar in the workbench content pane", () => {
    const html = renderToStaticMarkup(
      <BatchActions
        selectedIds={[1, 2]}
        activeTab="creations"
        copy={copy}
        isUnpublishing={false}
        setSelectedIds={() => {}}
        handleBatchDownload={() => {}}
        handleBatchUnpublish={() => {}}
        handleBatchUnfavorite={() => {}}
        handleBatchDelete={() => {}}
        handleBatchPublish={() => {}}
      />,
    );

    expect(html).toContain("justify-center");
    expect(html).toContain("md:left-56");
    expect(html).not.toContain("-translate-x-1/2");
  });
});
