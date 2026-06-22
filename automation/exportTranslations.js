import findFilesWithTranslations from "./findFilesWithTranslations.cjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get language code from command line arguments
const languageCode = process.argv[2];

if (!languageCode) {
  console.error("Error: Please provide a language code as an argument.");
  console.error("Usage: node exportTranslations.js <language-code>");
  console.error("Example: node exportTranslations.js es");
  process.exit(1);
}

// Validate language code format (2-5 characters, may include underscore)
if (!/^[a-z]{2}(_[A-Z]{2})?$/i.test(languageCode)) {
  console.error(`Error: Invalid language code format: "${languageCode}"`);
  console.error(
    "Expected format: 2-letter code (e.g., 'es', 'fr') or regional code (e.g., 'zh_TW')"
  );
  process.exit(1);
}

console.log(`Extracting translations for language: ${languageCode}`);

const directoryPath = "..";
const filesWithTranslations = findFilesWithTranslations(directoryPath);

if (filesWithTranslations.length === 0) {
  console.log("No files with translations found.");
  process.exit(0);
}

console.log(`Found ${filesWithTranslations.length} translation file(s)`);

// Function to recursively extract translations
function extractTranslations(obj, prefix = "", results = []) {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const item = obj[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Check if this is a translation object (has 'en' key)
      if (
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item) &&
        "en" in item
      ) {
        const englishText = item.en || "";
        const targetText = item[languageCode] || "[MISSING TRANSLATION]";

        results.push({
          key: fullKey,
          english: englishText,
          translation: targetText,
        });
      } else if (
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item)
      ) {
        // Recursively process nested objects
        extractTranslations(item, fullKey, results);
      }
    }
  }
  return results;
}

// Process all files and collect translations
const allTranslations = [];

for (const filePath of filesWithTranslations) {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");

    // Strip prefix (imports) before const translations =
    const constIdx = fileContent.indexOf("const translations =");
    const afterConst =
      constIdx > 0 ? fileContent.substring(constIdx) : fileContent;

    // Process the file into valid JSON (similar to processFile.js)
    const originalJSON = afterConst
      // Remove "const translations = " from the start
      .replace(/^const translations = /, "")
      // Remove "; export default translations;" from the end
      .replace(/export default translations;/, "")
      // Remove excess end keys
      .replace(/;\n\n\n/, "")
      // Remove imported-reference lines (shorthand `back,` or aliased `key: varName,`)
      .replace(/^\s+\w+,\s*$/gm, "")
      .replace(/^\s+\w+:\s+\w+,\s*$/gm, "")
      // Add double quotes around keys
      .replace(/(\w+):/g, '"$1":')
      // Remove trailing commas
      .replace(/,\s+}/g, "}");

    const translationObject = JSON.parse(originalJSON);
    const translations = extractTranslations(translationObject);

    // Add file path info to each translation
    const relativePath = path.relative(path.resolve(directoryPath), filePath);
    translations.forEach((t) => {
      t.file = relativePath;
    });

    allTranslations.push(...translations);

    console.log(`  Processed: ${relativePath} (${translations.length} keys)`);
  } catch (err) {
    console.error(`Error processing file: ${filePath}`);
    console.error(err.message);
  }
}

// Sort translations by key for easier reading
allTranslations.sort((a, b) => {
  if (a.file !== b.file) {
    return a.file.localeCompare(b.file);
  }
  return a.key.localeCompare(b.key);
});

// Generate output text
let output = `Translation Export for Language: ${languageCode}\n`;
output += `Generated: ${new Date().toISOString()}\n`;
output += `Total translation keys: ${allTranslations.length}\n`;
output += "=".repeat(80) + "\n\n";

let currentFile = "";
for (const t of allTranslations) {
  // Add file header when file changes
  if (t.file !== currentFile) {
    if (currentFile !== "") {
      output += "\n";
    }
    output += `File: ${t.file}\n`;
    output += "-".repeat(80) + "\n";
    currentFile = t.file;
  }

  output += `Key: ${t.key}\n`;
  output += `English: ${t.english}\n`;
  output += `${languageCode.toUpperCase()}: ${t.translation}\n`;
  output += "\n";
}

// Write to output file
const outputFileName = `translations_${languageCode}.txt`;
const outputPath = path.join(__dirname, outputFileName);

fs.writeFileSync(outputPath, output, "utf8");

console.log(`\n✓ Export complete!`);
console.log(`  Output file: ${outputPath}`);
console.log(`  Total keys exported: ${allTranslations.length}`);

// Count missing translations
const missingCount = allTranslations.filter(
  (t) => t.translation === "[MISSING TRANSLATION]"
).length;
if (missingCount > 0) {
  console.log(`  ⚠ Missing translations: ${missingCount}`);
}
