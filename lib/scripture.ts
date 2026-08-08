// Scripture reference parsing and formatting. ContentItem.scriptureRefs stores
// the normalized form so sermons are searchable by passage.

export interface ScriptureRef {
  book: string; // canonical name, e.g. "1 Corinthians"
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

const BOOKS: { name: string; aliases: string[] }[] = [
  { name: "Genesis", aliases: ["gen", "ge", "gn"] },
  { name: "Exodus", aliases: ["exod", "exo", "ex"] },
  { name: "Leviticus", aliases: ["lev", "le", "lv"] },
  { name: "Numbers", aliases: ["num", "nu", "nm", "nb"] },
  { name: "Deuteronomy", aliases: ["deut", "deu", "dt"] },
  { name: "Joshua", aliases: ["josh", "jos", "jsh"] },
  { name: "Judges", aliases: ["judg", "jdg", "jg", "jdgs"] },
  { name: "Ruth", aliases: ["rth", "ru"] },
  { name: "1 Samuel", aliases: ["1 sam", "1sam", "1 sa", "1sa", "i samuel", "1st samuel"] },
  { name: "2 Samuel", aliases: ["2 sam", "2sam", "2 sa", "2sa", "ii samuel", "2nd samuel"] },
  { name: "1 Kings", aliases: ["1 kgs", "1kgs", "1 ki", "1ki", "i kings", "1st kings"] },
  { name: "2 Kings", aliases: ["2 kgs", "2kgs", "2 ki", "2ki", "ii kings", "2nd kings"] },
  { name: "1 Chronicles", aliases: ["1 chron", "1chron", "1 chr", "1chr", "1 ch", "i chronicles"] },
  { name: "2 Chronicles", aliases: ["2 chron", "2chron", "2 chr", "2chr", "2 ch", "ii chronicles"] },
  { name: "Ezra", aliases: ["ezr"] },
  { name: "Nehemiah", aliases: ["neh", "ne"] },
  { name: "Esther", aliases: ["esth", "est", "es"] },
  { name: "Job", aliases: ["jb"] },
  { name: "Psalms", aliases: ["psalm", "ps", "psa", "psm", "pss"] },
  { name: "Proverbs", aliases: ["prov", "pro", "prv", "pr"] },
  { name: "Ecclesiastes", aliases: ["eccles", "eccl", "ecc", "ec"] },
  { name: "Song of Solomon", aliases: ["song", "song of songs", "sos", "so", "ss"] },
  { name: "Isaiah", aliases: ["isa", "is"] },
  { name: "Jeremiah", aliases: ["jer", "je", "jr"] },
  { name: "Lamentations", aliases: ["lam", "la"] },
  { name: "Ezekiel", aliases: ["ezek", "eze", "ezk"] },
  { name: "Daniel", aliases: ["dan", "da", "dn"] },
  { name: "Hosea", aliases: ["hos", "ho"] },
  { name: "Joel", aliases: ["jl"] },
  { name: "Amos", aliases: ["am"] },
  { name: "Obadiah", aliases: ["obad", "ob"] },
  { name: "Jonah", aliases: ["jnh", "jon"] },
  { name: "Micah", aliases: ["mic", "mc"] },
  { name: "Nahum", aliases: ["nah", "na"] },
  { name: "Habakkuk", aliases: ["hab", "hb"] },
  { name: "Zephaniah", aliases: ["zeph", "zep", "zp"] },
  { name: "Haggai", aliases: ["hag", "hg"] },
  { name: "Zechariah", aliases: ["zech", "zec", "zc"] },
  { name: "Malachi", aliases: ["mal", "ml"] },
  { name: "Matthew", aliases: ["matt", "mat", "mt"] },
  { name: "Mark", aliases: ["mrk", "mk", "mr"] },
  { name: "Luke", aliases: ["luk", "lk"] },
  { name: "John", aliases: ["joh", "jhn", "jn"] },
  { name: "Acts", aliases: ["act", "ac"] },
  { name: "Romans", aliases: ["rom", "ro", "rm"] },
  { name: "1 Corinthians", aliases: ["1 cor", "1cor", "1 co", "1co", "i corinthians", "1st corinthians"] },
  { name: "2 Corinthians", aliases: ["2 cor", "2cor", "2 co", "2co", "ii corinthians", "2nd corinthians"] },
  { name: "Galatians", aliases: ["gal", "ga"] },
  { name: "Ephesians", aliases: ["eph", "ephes"] },
  { name: "Philippians", aliases: ["phil", "php", "pp"] },
  { name: "Colossians", aliases: ["col", "co"] },
  { name: "1 Thessalonians", aliases: ["1 thess", "1thess", "1 th", "1th", "i thessalonians"] },
  { name: "2 Thessalonians", aliases: ["2 thess", "2thess", "2 th", "2th", "ii thessalonians"] },
  { name: "1 Timothy", aliases: ["1 tim", "1tim", "1 ti", "1ti", "i timothy"] },
  { name: "2 Timothy", aliases: ["2 tim", "2tim", "2 ti", "2ti", "ii timothy"] },
  { name: "Titus", aliases: ["tit", "ti"] },
  { name: "Philemon", aliases: ["philem", "phm", "pm"] },
  { name: "Hebrews", aliases: ["heb"] },
  { name: "James", aliases: ["jas", "jm"] },
  { name: "1 Peter", aliases: ["1 pet", "1pet", "1 pe", "1pe", "1 pt", "i peter"] },
  { name: "2 Peter", aliases: ["2 pet", "2pet", "2 pe", "2pe", "2 pt", "ii peter"] },
  { name: "1 John", aliases: ["1 jn", "1jn", "1 jo", "1jo", "i john"] },
  { name: "2 John", aliases: ["2 jn", "2jn", "2 jo", "2jo", "ii john"] },
  { name: "3 John", aliases: ["3 jn", "3jn", "3 jo", "3jo", "iii john"] },
  { name: "Jude", aliases: ["jud", "jd"] },
  { name: "Revelation", aliases: ["rev", "re", "revelations"] },
];

const lookup = new Map<string, string>();
for (const { name, aliases } of BOOKS) {
  lookup.set(name.toLowerCase(), name);
  for (const alias of aliases) lookup.set(alias, name);
}

export function canonicalBookName(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\.$/, "").replace(/\s+/g, " ");
  return lookup.get(key) ?? null;
}

/**
 * Parse a single scripture reference like:
 *   "John 3:16", "1 Cor 13:4-7", "Psalm 23", "Rom. 8"
 * Returns null when the book is unknown or the shape is invalid.
 */
export function parseScriptureRef(input: string): ScriptureRef | null {
  const match = input
    .trim()
    .match(/^([1-3]?(?:st|nd|rd)?\s*[A-Za-z. ]+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!match) return null;

  const book = canonicalBookName(match[1]);
  if (!book) return null;

  const chapter = Number(match[2]);
  if (chapter < 1) return null;

  const ref: ScriptureRef = { book, chapter };

  if (match[3]) {
    const verseStart = Number(match[3]);
    if (verseStart < 1) return null;
    ref.verseStart = verseStart;
    if (match[4]) {
      const verseEnd = Number(match[4]);
      if (verseEnd < verseStart) return null;
      ref.verseEnd = verseEnd;
    }
  }

  return ref;
}

export function formatScriptureRef(ref: ScriptureRef): string {
  let out = `${ref.book} ${ref.chapter}`;
  if (ref.verseStart !== undefined) {
    out += `:${ref.verseStart}`;
    if (ref.verseEnd !== undefined && ref.verseEnd !== ref.verseStart) {
      out += `-${ref.verseEnd}`;
    }
  }
  return out;
}

/** Parse a comma/semicolon separated list, dropping anything unparseable. */
export function parseScriptureRefList(input: string): ScriptureRef[] {
  return input
    .split(/[;,]/)
    .map((part) => parseScriptureRef(part))
    .filter((ref): ref is ScriptureRef => ref !== null);
}
