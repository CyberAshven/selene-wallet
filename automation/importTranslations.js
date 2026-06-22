import findFilesWithTranslations from "./findFilesWithTranslations.cjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get input file path from command line arguments
const inputFilePath = process.argv[2];

if (!inputFilePath) {
  console.error("Error: Please provide an input file path as an argument.");
  console.error("Usage: node importTranslations.js <input-file-path>");
  console.error("Example: node importTranslations.js translations_es.txt");
  process.exit(1);
}

// Resolve input file path (can be relative or absolute)
const resolvedInputPath = path.isAbsolute(inputFilePath)
  ? inputFilePath
  : path.resolve(process.cwd(), inputFilePath);

if (!fs.existsSync(resolvedInputPath)) {
  console.error(`Error: Input file not found: ${resolvedInputPath}`);
  process.exit(1);
}

console.log(`Reading translations from: ${resolvedInputPath}`);

// Parse the input file
function parseTranslationFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  const translations = [];
  let currentFile = null;
  let currentKey = null;
  let currentEnglish = null;
  let currentTranslation = null;
  let currentLanguage = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and separators
    if (!line || line.startsWith("=") || line.startsWith("-")) {
      // If we have a complete entry, save it
      if (
        currentKey &&
        currentEnglish &&
        currentTranslation &&
        currentLanguage
      ) {
        translations.push({
          file: currentFile,
          key: currentKey,
          english: currentEnglish,
          translation: currentTranslation,
          language: currentLanguage,
        });
        // Reset for next entry
        currentKey = null;
        currentEnglish = null;
        currentTranslation = null;
        currentLanguage = null;
      }
      continue;
    }

    // Parse file header
    if (line.startsWith("File: ")) {
      currentFile = line.replace(/^File: /, "").trim();
      continue;
    }

    // Parse key
    if (line.startsWith("Key: ")) {
      currentKey = line.replace(/^Key: /, "").trim();
      continue;
    }

    // Parse English
    if (line.startsWith("English: ")) {
      currentEnglish = line.replace(/^English: /, "").trim();
      continue;
    }

    // Parse translation (format: "LANG: translation")
    const translationMatch = line.match(/^([A-Z_]+):\s*(.+)$/);
    if (translationMatch) {
      currentLanguage = translationMatch[1].toLowerCase();
      currentTranslation = translationMatch[2].trim();
      continue;
    }
  }

  // Handle last entry if file doesn't end with empty line
  if (currentKey && currentEnglish && currentTranslation && currentLanguage) {
    translations.push({
      file: currentFile,
      key: currentKey,
      english: currentEnglish,
      translation: currentTranslation,
      language: currentLanguage,
    });
  }

  return translations;
}

// Parse the input file
const translationsToImport = parseTranslationFile(resolvedInputPath);

if (translationsToImport.length === 0) {
  console.error("Error: No translations found in input file.");
  process.exit(1);
}

// Extract language code from first entry
const targetLanguage = translationsToImport[0].language;
console.log(`Target language: ${targetLanguage}`);
console.log(
  `Found ${translationsToImport.length} translation entries to import\n`
);

// Find all translation files
const directoryPath = "..";
const filesWithTranslations = findFilesWithTranslations(directoryPath);

if (filesWithTranslations.length === 0) {
  console.error("No translation files found in repository.");
  process.exit(1);
}

// Create a map of file paths to their content
const fileMap = new Map();
for (const filePath of filesWithTranslations) {
  const relativePath = path.relative(path.resolve(directoryPath), filePath);
  fileMap.set(relativePath, filePath);
}

// Function to find and update a translation in a file
function updateTranslationInFile(
  filePath,
  keyPath,
  englishText,
  newTranslation,
  languageCode
) {
  const fileContent = fs.readFileSync(filePath, "utf8");

  // Strip prefix (imports) before const translations =
  const constIdx = fileContent.indexOf("const translations =");
  const prefix = constIdx > 0 ? fileContent.substring(0, constIdx) : "";
  const afterConst =
    constIdx > 0 ? fileContent.substring(constIdx) : fileContent;

  // Extract imported-reference lines to re-insert later
  const refLinePattern = /^\s+(\w+,|\w+:\s+\w+,)\s*$/gm;
  const refLines = [];
  const cleanedContent = afterConst.replace(refLinePattern, (match) => {
    refLines.push(match);
    return "";
  });

  // Parse to JSON (same approach as processFile.js)
  let parsedJSON;
  try {
    const originalJSON = cleanedContent
      .replace(/^const translations = /, "")
      .replace(/export default translations;/, "")
      .replace(/;\n\n\n/, "")
      .replace(/(\w+):/g, '"$1":')
      .replace(/,\s+}/g, "}");

    parsedJSON = JSON.parse(originalJSON);
  } catch (err) {
    console.error(`  ⚠ Error parsing file: ${err.message}`);
    return false;
  }

  // Navigate to the key (handle nested keys)
  const keyParts = keyPath.split(".");
  let currentObj = parsedJSON;

  for (let i = 0; i < keyParts.length; i++) {
    const part = keyParts[i];
    if (!currentObj[part]) {
      console.error(`  ⚠ Key not found: "${keyPath}"`);
      return false; // Key not found
    }
    if (i < keyParts.length - 1) {
      currentObj = currentObj[part];
    } else {
      // Last part - this should be the translation object
      const translationObj = currentObj[part];

      // Verify English text matches
      if (translationObj.en !== englishText) {
        console.error(`  ⚠ English text mismatch for key "${keyPath}":`);
        console.error(`     Expected: "${englishText}"`);
        console.error(`     Found: "${translationObj.en}"`);
        return false;
      }

      // Update the translation
      translationObj[languageCode] = newTranslation;

      // Sort language keys alphabetically (same as processFile.js does)
      const sortedKeys = Object.keys(translationObj).sort();
      const sortedTranslationObj = {};
      sortedKeys.forEach((key) => {
        sortedTranslationObj[key] = translationObj[key];
      });
      currentObj[part] = sortedTranslationObj;

      // Convert back to file format (same as processFile.js)
      const startFile = "const translations = ";
      const endFile = ";\n\nexport default translations;\n";
      const formattedJson = JSON.stringify(parsedJSON, null, 2).replace(
        /"([^"]+)"(?=:)/g,
        "$1"
      ); // Strip doublequotes from key values for prettier

      // Re-insert imported reference lines after opening brace
      let finalJson = formattedJson;
      if (refLines.length > 0) {
        const jsonLines = finalJson.split("\n");
        jsonLines.splice(1, 0, ...refLines.map((r) => r.trimEnd()));
        finalJson = jsonLines.join("\n");
      }

      const fullFile = prefix + startFile + finalJson + endFile;

      // Write back to file
      fs.writeFileSync(filePath, fullFile, "utf8");
      return true;
    }
  }

  return false;
}

// Process each translation
let successCount = 0;
let errorCount = 0;
let skippedCount = 0;
const errors = [];

for (const translation of translationsToImport) {
  // Skip missing translations
  if (translation.translation === "[MISSING TRANSLATION]") {
    skippedCount++;
    continue;
  }

  const filePath = fileMap.get(translation.file);

  if (!filePath) {
    console.error(`  ✗ File not found: ${translation.file}`);
    errorCount++;
    errors.push({
      key: translation.key,
      file: translation.file,
      error: "File not found in repository",
    });
    continue;
  }

  console.log(`  Processing: ${translation.file} -> ${translation.key}`);

  const success = updateTranslationInFile(
    filePath,
    translation.key,
    translation.english,
    translation.translation,
    translation.language
  );

  if (success) {
    successCount++;
    console.log(`    ✓ Updated`);
  } else {
    errorCount++;
    console.log(`    ✗ Failed to update`);
    errors.push({
      key: translation.key,
      file: translation.file,
      error: "Could not find or update translation",
    });
  }
}

// Summary
console.log(`\n${"=".repeat(80)}`);
console.log(`Import Summary:`);
console.log(`  Total entries: ${translationsToImport.length}`);
console.log(`  Successfully updated: ${successCount}`);
console.log(`  Skipped (missing): ${skippedCount}`);
console.log(`  Errors: ${errorCount}`);

if (errors.length > 0) {
  console.log(`\nErrors:`);
  errors.forEach((err) => {
    console.log(`  - ${err.file} -> ${err.key}: ${err.error}`);
  });
}
