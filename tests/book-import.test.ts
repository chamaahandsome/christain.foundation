import { describe, expect, it } from "vitest";
import {
  bodyInnerHtml,
  divideIntoChapters,
  htmlToText,
  isEpubBuffer,
  isPdfBuffer,
  textToHtml,
} from "@/lib/book-import";

describe("file sniffing", () => {
  it("recognizes PDF and EPUB magic bytes", () => {
    expect(isPdfBuffer(Buffer.from("%PDF-1.7 rest"))).toBe(true);
    expect(isEpubBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
    expect(isPdfBuffer(Buffer.from("PK\x03\x04"))).toBe(false);
    expect(isEpubBuffer(Buffer.from("%PDF-"))).toBe(false);
  });
});

describe("bodyInnerHtml", () => {
  it("takes the body, drops scripts/styles and zip-relative images", () => {
    const out = bodyInnerHtml(
      `<html><head><style>p{}</style></head><body class="x"><h2>One</h2><p>text</p><img src="images/cover.jpg"><img src="https://x.org/a.png"><script>x()</script></body></html>`,
    );
    expect(out).toContain("<h2>One</h2>");
    expect(out).toContain(`<img src="https://x.org/a.png">`);
    expect(out).not.toMatch(/cover\.jpg|<script|<style/);
  });
});

describe("divideIntoChapters", () => {
  it("splits on chapter markers and strips page markers", () => {
    const text = `--- Page 1 ---\nChapter 1 In the beginning words here.\n--- Page 2 ---\nChapter 2 More words follow here.`;
    const chapters = divideIntoChapters(text);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Chapter 1");
    expect(chapters[1].title).toBe("Chapter 2");
    expect(chapters[0].content).not.toContain("--- Page");
  });

  it("falls back to word-count blocks without markers", () => {
    const chapters = divideIntoChapters("word ".repeat(7000));
    expect(chapters.length).toBe(3); // 3000-word blocks
    expect(chapters[0].title).toBe("Chapter 1");
  });
});

describe("text/html round-trips", () => {
  it("textToHtml wraps paragraphs", () => {
    expect(textToHtml("One.\n\nTwo.")).toBe("<p>One.</p>\n<p>Two.</p>");
  });
  it("htmlToText flattens markup", () => {
    expect(htmlToText("<h2>A</h2><p>b c</p>")).toBe("A b c");
  });
});
