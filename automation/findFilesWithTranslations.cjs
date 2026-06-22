const fs = require("fs");
const path = require("path");

function findFilesWithTranslations(directoryPath) {
  const filesWithTranslations = [];

  function checkFile(filePath) {
    const fileContent = fs.readFileSync(filePath, "utf8");
    if (fileContent.includes("const translations =")) {
      filesWithTranslations.push(filePath);
    }
  }

  function checkDirectory(directoryPath) {
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
      const fullPath = path.join(directoryPath, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory() && file !== "node_modules") {
        checkDirectory(fullPath);
      } else if (
        stat.isFile() &&
        (file.endsWith(".js") || file.endsWith(".jsx"))
      ) {
        checkFile(fullPath);
      }
    }
  }

  checkDirectory(directoryPath);

  // Hack to only check one file
  // return [
  //   "./src/components/views/explore/chronology/translations.js"
  // ]

  return filesWithTranslations;
}

module.exports = findFilesWithTranslations;
