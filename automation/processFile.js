import translateJSONKeys from "./translateJSONkeys.js";
import fs from "fs";
import { ISO_639_1_LANGUAGES } from "./languages.js";

/**
 * Extract translation objects from a JS file, translate missing languages,
 * and write back. Works by finding `{ en: "..." }` patterns and expanding
 * them in place — no fragile JS-to-JSON conversion needed.
 */
async function processFile(filePath) {
  try {
    const original = fs.readFileSync(filePath, "utf8");

    // Match translation objects: `key: { en: "...", ... }`
    // Uses brace-depth tracking to handle nested braces in values.
    const result = await expandTranslations(original);

    if (result === original) {
      console.log(`No changes needed: ${filePath}`);
      return;
    }

    fs.writeFileSync(filePath, result, "utf8");
    console.log(`File processed successfully and saved: ${filePath}`);
  } catch (err) {
    console.error(`Error processing file: ${filePath}`);
    console.error(err.message);
  }
}

/**
 * Find all `{ en: "...", ... }` translation objects in the source and
 * expand any that are missing languages.
 */
async function expandTranslations(source) {
  // Find all translation object positions: `{ en: "..." ... }`
  // We look for `{` that is followed (possibly after whitespace/other keys)
  // by `en:` to identify translation objects.
  const objects = findTranslationObjects(source);

  if (objects.length === 0) return source;

  // Process from end to start so indices stay valid
  let result = source;
  for (let i = objects.length - 1; i >= 0; i--) {
    const { start, end, parsed } = objects[i];
    if (!parsed.en) continue;

    // Check if all languages are present
    const missing = ISO_639_1_LANGUAGES.filter((lang) => !parsed[lang]);
    if (missing.length === 0) continue;

    // Translate missing keys
    const translated = await translateJSONKeys(parsed, ISO_639_1_LANGUAGES);

    // Format the replacement object
    const indent = detectIndent(source, start);
    const formatted = formatTranslationObject(translated, indent);

    result = result.substring(0, start) + formatted + result.substring(end);
  }

  return result;
}

/**
 * Find all leaf-level brace-delimited objects that contain an `en:` key.
 * A "leaf" object has no nested `{...}` blocks inside it.
 * Returns array of { start, end, parsed } sorted by position.
 */
function findTranslationObjects(source) {
  const results = [];
  let i = 0;

  while (i < source.length) {
    if (source[i] === "{") {
      const end = findMatchingBrace(source, i);
      if (end < 0) break;

      const inner = source.substring(i + 1, end);

      // Check if this block contains nested braces (not a leaf)
      if (inner.includes("{")) {
        // Not a leaf — advance past the opening brace and keep scanning
        i++;
        continue;
      }

      // Leaf block — check if it has an `en:` key
      if (/\ben\s*:/.test(inner)) {
        const block = source.substring(i, end + 1);
        const parsed = parseTranslationObject(block);
        if (parsed && parsed.en) {
          results.push({ start: i, end: end + 1, parsed });
        }
      }

      i = end + 1;
    } else {
      i++;
    }
  }

  return results;
}

/**
 * Find the matching closing brace for an opening brace at position `start`.
 */
function findMatchingBrace(source, start) {
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = start; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (ch === "\\" && i + 1 < source.length) {
        i++; // skip escaped char
        continue;
      }
      if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

/**
 * Parse a `{ en: "Hello", fr: "Bonjour" }` block into a plain object.
 * Handles both quoted and unquoted keys, and string values with escapes.
 */
function parseTranslationObject(block) {
  const obj = {};
  // Match key: "value" or key: 'value' patterns
  // Keys can be unquoted identifiers or quoted strings
  const re = /(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  let match;

  while ((match = re.exec(block)) !== null) {
    const key = match[1];
    let value = match[2];
    // Strip surrounding quotes
    value = value.slice(1, -1);
    // Unescape
    if (match[2][0] === '"') {
      value = value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else if (match[2][0] === "'") {
      value = value.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    }
    obj[key] = value;
  }

  return Object.keys(obj).length > 0 ? obj : null;
}

/**
 * Detect the indentation level of the line containing `pos`.
 */
function detectIndent(source, pos) {
  const lineStart = source.lastIndexOf("\n", pos - 1) + 1;
  const beforeBrace = source.substring(lineStart, pos);
  // The key is on this line before the brace, indent one level deeper
  const baseIndent = beforeBrace.match(/^(\s*)/)[1];
  return baseIndent + "  ";
}

/**
 * Format a translation object as a JS object literal string.
 * Keys are unquoted (prettier style), values are double-quoted.
 */
function formatTranslationObject(obj, indent) {
  const entries = Object.entries(obj);
  if (entries.length <= 1) {
    // Single entry: inline
    const [key, value] = entries[0];
    return `{ ${key}: "${escapeString(value)}" }`;
  }

  const lines = entries.map(
    ([key, value]) => `${indent}${key}: "${escapeString(value)}",`
  );

  const outerIndent = indent.substring(2) || "";
  return `{\n${lines.join("\n")}\n${outerIndent}}`;
}

/**
 * Escape a string for use inside double quotes in JS source.
 */
function escapeString(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

export default processFile;
