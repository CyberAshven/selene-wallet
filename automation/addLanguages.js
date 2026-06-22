import path from "path";
import { fileURLToPath } from "url";
import findFilesWithTranslations from "./findFilesWithTranslations.cjs";
import processFile from "./processFile.js";

if (!process.env?.GOOGLE_TRANSLATE_API_KEY) {
  throw new Error("No GOOGLE_TRANSLATE_API_KEY provided!");
}

const directoryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src");
const filesWithTranslations = findFilesWithTranslations(directoryPath);

if (filesWithTranslations.length === 0) {
  console.log("No files with translations found.");
} else {
  console.log("Files with translations:");
  filesWithTranslations.forEach((filePath) => {
    console.log("Translating: ...", filePath);
    processFile(filePath);
  });
}
