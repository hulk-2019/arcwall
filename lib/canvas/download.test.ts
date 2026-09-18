import { describe, expect, it, vi } from "vitest";
import * as download from "./download";

describe("withDownloadLock", () => {
  it("blocks concurrent downloads and unlocks after the request settles", async () => {
    let resolveFirst!: (value: string) => void;
    const firstRequest = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const action = vi.fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce("second download");
    const lock = { current: false };

    const first = (download as any).withDownloadLock(lock, action);
    const duplicate = (download as any).withDownloadLock(lock, action);

    expect(action).toHaveBeenCalledTimes(1);
    await expect(duplicate).resolves.toBeUndefined();

    resolveFirst("first download");
    await expect(first).resolves.toBe("first download");
    await expect((download as any).withDownloadLock(lock, action)).resolves.toBe(
      "second download"
    );
    expect(action).toHaveBeenCalledTimes(2);
  });
});

describe("startIsolatedDownload", () => {
  it("navigates a hidden iframe instead of the current browsing context", () => {
    const frame = {
      id: "",
      title: "",
      src: "",
      tabIndex: 0,
      style: {},
      setAttribute: vi.fn(),
    };
    const document = {
      body: { appendChild: vi.fn() },
      createElement: vi.fn().mockReturnValue(frame),
      getElementById: vi.fn().mockReturnValue(null),
    };

    (download as any).startIsolatedDownload(
      "https://oss.test/file.mp3",
      document as unknown as Document
    );

    expect(document.createElement).toHaveBeenCalledWith("iframe");
    expect(document.body.appendChild).toHaveBeenCalledWith(frame);
    expect(frame.src).toBe("https://oss.test/file.mp3");
  });
});
