import { describe, expect, it } from "vitest";
import {
  WORKBENCH_GRID_CLASS,
  flattenMyWorksPages,
  getNextWorksPageParam,
  getSelectAllState,
  mapMyWorksPages,
} from "./workbench-list";

describe("getSelectAllState", () => {
  it("is none when nothing is selected or loaded", () => {
    expect(getSelectAllState(0, 12)).toBe("none");
    expect(getSelectAllState(4, 0)).toBe("none");
  });

  it("is all when every loaded item is selected", () => {
    expect(getSelectAllState(12, 12)).toBe("all");
  });

  it("becomes some after a new page loads while previous items stay selected", () => {
    expect(getSelectAllState(12, 24)).toBe("some");
  });
});

describe("getNextWorksPageParam", () => {
  it("stops when the last page is empty or the total is loaded", () => {
    expect(getNextWorksPageParam({ data: { wallpapers: [], total: 12 } }, [{ data: { wallpapers: [] } }])).toBeUndefined();
    expect(
      getNextWorksPageParam(
        { data: { wallpapers: [{ id: 1 }], total: 1 } },
        [{ data: { wallpapers: [{ id: 1 }] } }],
      ),
    ).toBeUndefined();
  });

  it("requests the next page while more items remain", () => {
    const page1 = { data: { wallpapers: Array.from({ length: 12 }, (_, i) => ({ id: i })), total: 25 } };
    expect(getNextWorksPageParam(page1, [page1])).toBe(2);
  });
});

describe("flattenMyWorksPages", () => {
  it("appends later pages without replacing the first page", () => {
    const result = flattenMyWorksPages([
      { data: { wallpapers: [{ id: 1 }], total: 3 } },
      { data: { wallpapers: [{ id: 2 }, { id: 3 }], total: 3 } },
    ]);
    expect(result.wallpapers.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(result.total).toBe(3);
  });
});

describe("WORKBENCH_GRID_CLASS", () => {
  it("packs more cards per row on wide screens", () => {
    expect(WORKBENCH_GRID_CLASS).toContain("xl:grid-cols-6");
    expect(WORKBENCH_GRID_CLASS).toContain("lg:grid-cols-5");
  });
});

describe("mapMyWorksPages", () => {
  it("updates matching wallpapers across loaded pages", () => {
    const next = mapMyWorksPages(
      {
        pages: [
          { data: { wallpapers: [{ id: 1, status: 0 }, { id: 2, status: 1 }] } },
          { data: { wallpapers: [{ id: 3, status: 0 }] } },
        ],
        pageParams: [1, 2],
      },
      (wallpaper) => (wallpaper.id === 3 ? { ...wallpaper, status: 1 } : wallpaper),
    );

    expect(next?.pages[1].data.wallpapers[0].status).toBe(1);
    expect(next?.pages[0].data.wallpapers[0].status).toBe(0);
  });
});
