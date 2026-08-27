// Minimal chapter-HTML sanitizer (pure, tested). Creator-authored markup is
// rendered to READERS, so active content must not survive: script/embed
// vectors, event handlers, and javascript: URLs are stripped. This is a
// conservative regex pass, not a full parser — good enough for trusted-ish
// creators behind the gate; swap for a real sanitizer if authoring opens up.

// Script/style blocks go wholesale — their inner text is code, not prose.
const BANNED_BLOCKS = /<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BANNED_TAGS = /<\s*\/?\s*(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi;
const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URLS = /\s+(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi;
const DATA_URLS = /\s+(href|src)\s*=\s*(["']?)\s*data:text\/html[^"'>\s]*\2/gi;

export function sanitizeChapterHtml(html: string): string {
  return html
    .replace(BANNED_BLOCKS, "")
    .replace(BANNED_TAGS, "")
    .replace(EVENT_ATTRS, "")
    .replace(JS_URLS, "")
    .replace(DATA_URLS, "");
}
