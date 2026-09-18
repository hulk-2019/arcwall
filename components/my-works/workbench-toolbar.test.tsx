import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { WorkbenchToolbar } from "./workbench-toolbar";

const tWorkbench = (key: string) => key;

function renderToolbar(overrides: Partial<React.ComponentProps<typeof WorkbenchToolbar>> = {}) {
  return renderToStaticMarkup(
    <WorkbenchToolbar
      selectedCount={0}
      loadedCount={12}
      totalCount={24}
      activeTab="creations"
      keyword=""
      startDate=""
      endDate=""
      sortByLikes=""
      tWorkbench={tWorkbench}
      onToggleSelectAll={() => {}}
      onKeywordChange={() => {}}
      onStartDateChange={() => {}}
      onEndDateChange={() => {}}
      onSortByLikesChange={() => {}}
      onResetFilters={() => {}}
      onOpenGenerate={() => {}}
      {...overrides}
    />,
  );
}

describe("WorkbenchToolbar", () => {
  it("places filter before create and keeps a visible, non-stretching search field", () => {
    const html = renderToolbar();
    const filterIndex = html.indexOf(">filter<");
    const createIndex = html.indexOf(">startCreating<");
    expect(filterIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(filterIndex);
    expect(html).not.toContain("flex-1");
    expect(html).toContain("justify-between");
    expect(html).toContain("md:w-80");
    expect(html).toContain("bg-muted/50");
    expect(html).not.toContain("rounded-full");
  });

  it("marks select-all as mixed after a new page loads on a full selection", () => {
    const html = renderToolbar({ selectedCount: 12, loadedCount: 24, totalCount: 36 });
    expect(html).toContain('aria-checked="mixed"');
    expect(html).toContain("selectAll");
  });

  it("marks select-all as checked when every loaded item is selected", () => {
    const html = renderToolbar({ selectedCount: 12, loadedCount: 12, totalCount: 12 });
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("deselectAll");
  });
});
