import { beforeEach, describe, expect, it, vi } from "vitest";

const models = [
  { id: 1, category: "canvas_model", key: "seedream", type: "image", sort_order: 1, is_active: true },
  { id: 2, category: "canvas_model", key: "seedance", type: "video", sort_order: 2, is_active: true },
  { id: 3, category: "canvas_model", key: "seed-tts", type: "audio", sort_order: 3, is_active: true },
];

const mocks = vi.hoisted(() => ({
  getDictionariesByCategory: vi.fn(),
}));

vi.mock("@/models/dictionary", () => ({
  getDictionariesByCategory: mocks.getDictionariesByCategory,
}));

import { POST } from "./route";

describe("POST /api/dictionaries canvas models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDictionariesByCategory.mockImplementation(
      async (_categories: string[], type?: string) =>
        type ? models.filter((model) => model.type === type) : models
    );
  });

  it.each([
    ["image", ["seedream"]],
    ["video", ["seedance"]],
    ["audio", ["seed-tts"]],
  ])("returns only %s models", async (type, expectedKeys) => {
    const response = await POST(
      new Request("http://localhost/api/dictionaries", {
        method: "POST",
        body: JSON.stringify({ categories: ["canvas_model"], type }),
      })
    );
    const payload = await response.json();

    expect(payload.code).toBe(0);
    expect(payload.data.map((model: { key: string }) => model.key)).toEqual(expectedKeys);
  });
});
