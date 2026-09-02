import { describe, expect, it } from "vitest";
import { sanitizeChapterHtml, sanitizeRichHtml } from "@/lib/sanitize-html";

describe("sanitizeChapterHtml", () => {
  it("keeps normal chapter markup", () => {
    const html = `<h2>Chapter One</h2><p>In the <em>beginning</em>…</p><blockquote>John 1:1</blockquote><img src="https://x.org/fig.png" alt="figure">`;
    expect(sanitizeChapterHtml(html)).toBe(html);
  });

  it("strips script/style/iframe and friends", () => {
    const out = sanitizeChapterHtml(
      `<p>hi</p><script>alert(1)</script><iframe src="https://evil"></iframe><style>*{}</style>`,
    );
    expect(out).toBe("<p>hi</p>");
    expect(out).not.toMatch(/<script|<iframe|<style|alert/i);
  });

  it("strips inline event handlers", () => {
    expect(sanitizeChapterHtml(`<p onclick="alert(1)" class="a">x</p>`)).toBe(
      `<p class="a">x</p>`,
    );
    expect(sanitizeChapterHtml(`<img src="x.png" onerror=alert(1)>`)).toBe(
      `<img src="x.png">`,
    );
  });

  it("strips javascript: and data:text/html URLs", () => {
    expect(sanitizeChapterHtml(`<a href="javascript:alert(1)">x</a>`)).toBe(`<a>x</a>`);
    expect(sanitizeChapterHtml(`<a href="data:text/html,<b>x</b>">x</a>`)).toContain("<a");
    expect(sanitizeChapterHtml(`<a href="https://ok.org">x</a>`)).toBe(
      `<a href="https://ok.org">x</a>`,
    );
  });
});

describe("sanitizeRichHtml", () => {
  it("preserves YouTube embeds as canonical nocookie iframes", () => {
    const input =
      '<p>watch</p><div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?start=1" onload="evil()" width="640"></iframe></div>';
    const out = sanitizeRichHtml(input);
    expect(out).toContain(
      'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"',
    );
    expect(out).toContain("data-youtube-video");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("start=1"); // attacker-controlled params dropped
  });

  it("is idempotent over its own output", () => {
    const once = sanitizeRichHtml(
      '<div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>',
    );
    expect(sanitizeRichHtml(once)).toBe(once);
  });

  it("still strips every non-YouTube iframe and script", () => {
    const out = sanitizeRichHtml(
      '<iframe src="https://evil.example/embed/dQw4w9WgXcQ"></iframe><iframe src="https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ"></iframe><script>x()</script><p>ok</p>',
    );
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("script");
    expect(out).toContain("<p>ok</p>");
  });
});
