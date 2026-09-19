import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { AudioDiscPlayer } from "./audio-disc-player";

describe("AudioDiscPlayer", () => {
  it("renders a black grooved vinyl with a dark red label", () => {
    const html = renderToStaticMarkup(
      <AudioDiscPlayer src="https://oss.test/song.mp3" title="夜行" />
    );
    expect(html).toContain("data-audio-disc-player");
    expect(html).toContain("bg-black");
    expect(html).toContain("data-film-disc");
    expect(html).toContain("bg-red-950");
    expect(html).toContain("<audio");
    expect(html).toContain("https://oss.test/song.mp3");
  });

  it("cover variant shows the disc without mounting playback controls", () => {
    const html = renderToStaticMarkup(<AudioDiscPlayer variant="cover" title="夜行" />);
    expect(html).toContain("data-audio-disc-player");
    expect(html).toContain("data-film-disc");
    expect(html).toContain("bg-black");
    expect(html).toContain("bg-red-950");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain('aria-label="play"');
    expect(html).not.toContain('aria-label="replay"');
    expect(html).not.toContain('aria-label="volume"');
  });

  it("renders replay, play/pause, and volume controls", () => {
    const html = renderToStaticMarkup(
      <AudioDiscPlayer src="https://oss.test/song.mp3" title="夜行" />
    );
    expect(html).toContain('aria-label="replay"');
    expect(html).toContain('aria-label="play"');
    expect(html).toContain("grid-cols-[1fr_auto_1fr]");
    expect(html).toContain("gap-x-16");
    expect(html).toMatch(/aria-label="volume"[^>]*w-16/);
    expect(html.indexOf('data-audio-seek')).toBeGreaterThan(-1);
    expect(html.indexOf('data-audio-transport')).toBeGreaterThan(
      html.indexOf('data-audio-seek')
    );
  });

  it("uses a compact control bar that fits canvas nodes", () => {
    const html = renderToStaticMarkup(
      <AudioDiscPlayer src="https://oss.test/song.mp3" title="夜行" size="sm" />
    );
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("gap-x-4");
    expect(html).not.toContain("gap-x-16");
    expect(html).toContain("h-7 w-7");
    expect(html).toMatch(/aria-label="volume"[^>]*w-10/);
  });

  it("places lyrics on the vinyl label", () => {
    const html = renderToStaticMarkup(
      <AudioDiscPlayer src="https://oss.test/song.mp3" title="夜行">
        <p>推开清晨的玻璃门</p>
      </AudioDiscPlayer>
    );
    expect(html).toContain("推开清晨的玻璃门");
  });
});
