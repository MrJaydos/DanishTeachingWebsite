// Client-side answer checking for the "type your answer" study mode.
// Compares a typed answer against the card's English text, tolerating
// alternatives ("egg / eggs"), articles, "to " infinitives, and small typos.

function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFC")
    .replace(/\(.*?\)/g, " ") // drop parentheticals
    .replace(/[.,!?;:'"’]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^to\s+/, "") // "to travel" -> "travel"
    .replace(/^(a|an|the)\s+/, ""); // drop leading article
}

// Split "holiday / vacation", "road, way" etc. into accepted variants.
function variantsOf(englishText) {
  return String(englishText)
    .split(/[/;,]| or /i)
    .map(normalize)
    .filter(Boolean);
}

// Classic Levenshtein distance for fuzzy "close" matching.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Grade a typed answer.
 * @returns {"correct"|"close"|"wrong"|null} null if the input is empty.
 */
export function gradeAnswer(input, englishText) {
  const typed = normalize(input);
  if (!typed) return null;

  const variants = variantsOf(englishText);
  if (variants.includes(typed)) return "correct";

  // Allow a one-off typo relative to the closest variant (~20% of its length).
  let best = Infinity;
  for (const v of variants) {
    const d = levenshtein(v, typed);
    const tolerance = Math.max(1, Math.floor(v.length * 0.2));
    if (d <= tolerance) best = Math.min(best, d);
  }
  return best !== Infinity ? "close" : "wrong";
}

// A progressive hint: first letter of each word, rest masked.
// "bread" -> "b ▢▢▢▢", "get up" -> "g▢▢ u▢"
export function makeHint(englishText) {
  const primary = String(englishText).split(/[/;,]| or /i)[0].trim();
  return primary
    .split(/\s+/)
    .map((w) => w[0] + "▢".repeat(Math.max(0, w.length - 1)))
    .join("  ");
}

// Rating suggested by how the typed answer scored, to nudge the user.
export function suggestedRating(result) {
  if (result === "correct") return "good";
  if (result === "close") return "hard";
  if (result === "wrong") return "again";
  return null;
}
