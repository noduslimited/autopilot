// Org code suggestion. Source: ID and Reference System Specification section 4.1.
//
// Note: the spec's own example table does not perfectly reproduce its own
// 7-step algorithm (e.g. "Oak Tree Support" -> "OAK" implies dropping
// "Tree" entirely rather than taking initials of both remaining words, and
// "Bright Futures Care" -> "BFC" implies "Care" was NOT stripped despite
// being in the generic-word list). This implements the steps as literally
// written; it will not match every example row exactly. This is low-stakes
// since the result is only ever a suggestion — Step 2 lets the manager edit
// it freely before confirming.
const GENERIC_WORDS = new Set([
  "care",
  "services",
  "support",
  "group",
  "the",
  "and",
  "of",
  "ltd",
  "limited",
]);

export function suggestOrgCode(orgName: string): string {
  const words = orgName
    .replace(/&/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z]/g, ""))
    .filter(Boolean);

  if (words.length === 0) return "";

  const meaningful = words.filter((word) => !GENERIC_WORDS.has(word.toLowerCase()));
  const source = meaningful.length > 0 ? meaningful : words;

  let code: string;
  if (source.length === 1) {
    code = source[0].slice(0, 3).toUpperCase();
  } else {
    code = source
      .map((word) => word[0])
      .join("")
      .toUpperCase();
    if (code.length === 1) {
      code = source[0].slice(0, 3).toUpperCase();
    }
  }

  if (code.length > 4) code = code.slice(0, 4);
  if (code.length < 2) code = (code + (source[0]?.slice(1) ?? "")).toUpperCase().slice(0, 3);

  return code;
}

// 2-4 uppercase letters only. Source: ID and Reference System Specification section 4.2.
export function isValidOrgCode(code: string): boolean {
  return /^[A-Z]{2,4}$/.test(code);
}
