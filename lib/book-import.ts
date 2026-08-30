// Whole-book import, ported from Maltivas (lib/epub-parser.ts +
// lib/pdf-to-epub.ts): a creator uploads an EPUB or PDF, we parse it into
// chapters and store them in the database — the uploaded file itself is
// parsed in memory and discarded, never stored (CF has no book files to
// leak, by design).

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface ImportedChapter {
  title: string;
  chapterNumber: number;
  content: string; // HTML for the reader
}

export interface ImportedBook {
  metadata: { title?: string; author?: string; description?: string };
  chapters: ImportedChapter[];
}

// ── File-type sniffing (pure, tested) ───────────────────────────────────────

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("latin1").startsWith("%PDF-");
}

export function isEpubBuffer(buffer: Buffer): boolean {
  // EPUB = ZIP container ("PK\x03\x04") with an OCF mimetype entry.
  return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03;
}

// ── Shared helpers (pure, tested) ───────────────────────────────────────────

/** Inner HTML of <body>, with zip-relative images stripped (they can't
 * resolve outside the container) and scripts/styles gone. */
export function bodyInnerHtml(xhtml: string): string {
  const bodyMatch = xhtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const inner = bodyMatch ? bodyMatch[1] : xhtml;
  return inner
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<img\b(?![^>]*src=["']https?:)[^>]*>/gi, "")
    .trim();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain text → paragraph HTML. */
export function textToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}

/**
 * Split extracted book text into chapters (ported from Maltivas): chapter
 * markers when present, otherwise ~10-page word-count blocks.
 */
export function divideIntoChapters(text: string): ImportedChapter[] {
  const cleaned = text.replace(/---\s*Page\s+\d+\s*---/g, "\n").trim();
  const chapters: ImportedChapter[] = [];

  const chapterRegex = /(?:Chapter|CHAPTER|Ch\.|CH\.)\s+(\d+|[IVXLC]+)/g;
  const matches = Array.from(cleaned.matchAll(chapterRegex));

  if (matches.length > 1) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? cleaned.length) : cleaned.length;
      chapters.push({
        title: matches[i][0],
        chapterNumber: i + 1,
        content: textToHtml(cleaned.slice(start, end).trim()),
      });
    }
    return chapters;
  }

  const WORDS_PER_CHAPTER = 300 * 10; // ~10 average pages
  const words = cleaned.split(/\s+/).filter(Boolean);
  for (let i = 0, n = 1; i < words.length; i += WORDS_PER_CHAPTER, n++) {
    chapters.push({
      title: `Chapter ${n}`,
      chapterNumber: n,
      content: textToHtml(words.slice(i, i + WORDS_PER_CHAPTER).join(" ")),
    });
  }
  return chapters;
}

// ── EPUB (container → OPF → spine, NCX/nav for titles) ─────────────────────

function getFullPath(basePath: string, relativePath: string): string {
  const baseDir = basePath.substring(0, basePath.lastIndexOf("/") + 1);
  return (baseDir + relativePath).replace(/\/\.\//g, "/");
}

function firstText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstText(value[0]);
  if (value && typeof value === "object" && "#text" in value) {
    return String((value as { "#text": unknown })["#text"]);
  }
  return undefined;
}

interface NavPoint {
  title: string;
  src: string;
}

function extractNavPoints(navPoints: unknown): NavPoint[] {
  const results: NavPoint[] = [];
  const process = (point: unknown) => {
    if (!point || typeof point !== "object") return;
    const p = point as {
      navLabel?: { text?: unknown };
      content?: { "@_src"?: string };
      navPoint?: unknown;
    };
    const src = p.content?.["@_src"];
    if (src) {
      results.push({
        title: firstText(p.navLabel?.text) ?? "",
        src: src.split("#")[0],
      });
    }
    if (Array.isArray(p.navPoint)) p.navPoint.forEach(process);
    else if (p.navPoint) process(p.navPoint);
  };
  if (Array.isArray(navPoints)) navPoints.forEach(process);
  else process(navPoints);
  return results;
}

export async function parseEpubBuffer(buffer: Buffer): Promise<ImportedBook> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("Invalid ePub: container.xml not found");
  const container = parser.parse(containerXml);
  const rootfile = container?.container?.rootfiles?.rootfile;
  const opfPath = (Array.isArray(rootfile) ? rootfile[0] : rootfile)?.["@_full-path"];
  if (!opfPath) throw new Error("Invalid ePub: OPF path not found");

  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error("Invalid ePub: OPF file not found");
  const pkg = parser.parse(opfXml)?.package;

  const metadata = {
    title: firstText(pkg?.metadata?.["dc:title"]),
    author: firstText(pkg?.metadata?.["dc:creator"]),
    description: firstText(pkg?.metadata?.["dc:description"]),
  };

  const manifestItems = pkg?.manifest?.item;
  const manifest = new Map<string, string>();
  for (const item of Array.isArray(manifestItems) ? manifestItems : [manifestItems]) {
    if (item?.["@_id"]) manifest.set(item["@_id"], item["@_href"]);
  }

  const spineItems = pkg?.spine?.itemref;
  const spine: string[] = (Array.isArray(spineItems) ? spineItems : [spineItems])
    .map((item: { "@_idref"?: string } | undefined) => item?.["@_idref"])
    .filter((id: string | undefined): id is string => Boolean(id));

  // Chapter titles: NCX (ePub 2) first, nav document (ePub 3) fallback.
  const titles = new Map<string, string>();
  const ncxId = pkg?.spine?.["@_toc"];
  if (ncxId && manifest.has(ncxId)) {
    const ncxXml = await zip.file(getFullPath(opfPath, manifest.get(ncxId)!))?.async("text");
    if (ncxXml) {
      const nav = parser.parse(ncxXml);
      for (const point of extractNavPoints(nav?.ncx?.navMap?.navPoint)) {
        if (point.title) titles.set(point.src, point.title);
      }
    }
  }
  if (titles.size === 0) {
    for (const href of manifest.values()) {
      if (!/nav|toc/i.test(href)) continue;
      const navXml = await zip.file(getFullPath(opfPath, href))?.async("text");
      if (!navXml) continue;
      for (const match of navXml.matchAll(/<a[^>]*href=["']([^"'#]+)[^"']*["'][^>]*>([^<]+)<\/a>/gi)) {
        titles.set(match[1], match[2].trim());
      }
    }
  }

  const chapters: ImportedChapter[] = [];
  for (const itemId of spine) {
    const href = manifest.get(itemId);
    if (!href) continue;
    const xhtml = await zip.file(getFullPath(opfPath, href))?.async("text");
    if (!xhtml) continue;

    const content = bodyInnerHtml(xhtml);
    // Skip covers/blank pages — nothing worth a chapter row.
    if (htmlToText(content).length < 40) continue;

    let title = `Chapter ${chapters.length + 1}`;
    for (const [tocHref, tocTitle] of titles.entries()) {
      if (href.includes(tocHref) || tocHref.includes(href)) {
        title = tocTitle;
        break;
      }
    }
    chapters.push({ title, chapterNumber: chapters.length + 1, content });
  }

  return { metadata, chapters };
}

// ── PDF (pdf2json → text → chapter split) ───────────────────────────────────

export async function parsePdfBuffer(buffer: Buffer): Promise<ImportedBook> {
  const { default: PDFParser } = await import("pdf2json");

  const parsed = await new Promise<{
    meta: { title?: string; author?: string };
    text: string;
  }>((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", (err) =>
      reject(new Error(String((err as { parserError?: unknown })?.parserError ?? err))),
    );
    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        const data = pdfData as unknown as {
          Meta?: { Title?: string; Author?: string };
          Pages?: { Texts?: { R?: { T?: string }[] }[] }[];
        };
        let text = "";
        for (const [index, page] of (data.Pages ?? []).entries()) {
          text += `\n\n--- Page ${index + 1} ---\n\n`;
          for (const item of page.Texts ?? []) {
            const raw = item.R?.[0]?.T;
            if (raw) text += decodeURIComponent(raw) + " ";
          }
        }
        resolve({
          meta: { title: data.Meta?.Title, author: data.Meta?.Author },
          text: text.trim(),
        });
      } catch (err) {
        reject(err);
      }
    });
    pdfParser.parseBuffer(buffer);
  });

  return {
    metadata: { title: parsed.meta.title, author: parsed.meta.author },
    chapters: divideIntoChapters(parsed.text),
  };
}
