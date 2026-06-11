// ---------------------------------------------------------------------------
// Sift classifier — rule-based v1.
//
// SWAP POINT: replace `classify()` with an async call to your AI service
// (e.g. Claude API) returning the same shape:
//   { rows: [{ cat, score, matched[] }], best, total, confidence: 0..100 }
// Keep this module as the zero-latency offline fallback and merge scores.
// ---------------------------------------------------------------------------

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRx = (w) => new RegExp(`\\b${escapeRx(w)}\\b`, "i");

const LEX = {
  tasks: {
    words: [
      "buy", "fix", "finish", "submit", "send", "pay", "clean", "renew",
      "book", "remind", "need to", "have to", "todo", "don't forget",
      "pick up", "order", "return", "install", "call", "email", "deliver",
    ],
    patterns: [],
  },
  ideas: {
    words: [
      "idea", "what if", "concept", "imagine", "feature", "maybe we",
      "could build", "an app", "startup", "prototype", "wouldn't it be",
      "invention", "design a",
    ],
    patterns: [],
  },
  plans: {
    words: [
      "plan", "roadmap", "strategy", "goal", "milestone", "long term",
      "save up", "learn", "prepare for", "apply to", "by next", "this year",
      "budget", "ship by",
    ],
    patterns: [/\bby q[1-4]\b/i],
  },
  events: {
    words: [
      "meeting", "meet", "tomorrow", "today", "tonight", "next week",
      "schedule", "appointment", "deadline", "lunch", "dinner", "interview",
      "standup", "sync", "all-hands",
    ],
    patterns: [
      /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i,
      /\bat\s+\d{1,2}\b/i,
      /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/i,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i,
    ],
  },
  brainstorm: {
    words: [
      "brainstorm", "thoughts on", "let's discuss", "open question",
      "team input", "vote", "poll", "feedback on", "pitch", "naming",
      "should we",
    ],
    patterns: [],
  },
};

// precompile word regexes once
const COMPILED = Object.fromEntries(
  Object.entries(LEX).map(([k, v]) => [
    k,
    { words: v.words.map((w) => ({ w, rx: wordRx(w) })), patterns: v.patterns },
  ])
);

function lexFor(cat) {
  if (cat.lexicon && COMPILED[cat.lexicon]) return COMPILED[cat.lexicon];
  const words = (cat.words && cat.words.length ? cat.words : [cat.name.toLowerCase()])
    .map((w) => ({ w, rx: wordRx(w) }));
  return { words, patterns: [] };
}

export const POLICY = { auto: 75, ask: 35 }; // confidence thresholds, see PRD §5

export function classify(text, categories) {
  const rows = categories.map((cat) => {
    const lex = lexFor(cat);
    const matched = [];
    let score = 0;
    for (const { w, rx } of lex.words) {
      if (rx.test(text)) {
        matched.push(w);
        score += 1;
      }
    }
    for (const p of lex.patterns) {
      const m = text.match(p);
      if (m) {
        matched.push(m[0].trim());
        score += 1.5;
      }
    }
    return { cat, score, matched };
  });

  const total = rows.reduce((s, r) => s + r.score, 0);
  const best = rows.reduce((a, b) => (b.score > (a ? a.score : -1) ? b : a), null);
  const dominance = total && best ? best.score / total : 0;
  const strength = best ? 1 - Math.exp(-best.score / 1.6) : 0;
  const confidence = Math.round(dominance * strength * 100);

  return { rows, best, total, confidence };
}

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "about", "from", "into",
  "should", "would", "could", "need", "want", "have", "will", "make",
  "just", "some", "more", "what", "when", "where", "then", "them", "they",
  "over", "under", "every", "really", "very", "into", "your",
]);

export function suggestName(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
  const pick = words.sort((a, b) => b.length - a.length)[0] || "misc";
  return pick.charAt(0).toUpperCase() + pick.slice(1);
}
