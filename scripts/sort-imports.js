#!/usr/bin/env node
/**
 * Sort imports in all source files per project convention.
 *
 * Order: react, react-*, capacitor, decimal, libauth, 3rdparty, anticons, @/icons;
 *        @/redux, @/kernel, components, @/hooks, @/util+other, @/routes,
 *        translations, local
 *
 * Blank lines between major groups.
 *
 * Usage: node scripts/sort-imports.js
 */
import fs from "node:fs";
import path from "node:path";

function getImportPath(text) {
  let m = text.match(/from\s+"([^"]+)"/);
  if (m) return m[1];
  m = text.match(/from\s+'([^']+)'/);
  if (m) return m[1];
  // side-effect: import "./index.css"
  m = text.match(/^import\s+"([^"]+)"/);
  if (m) return m[1];
  return null;
}

function priority(importPath) {
  if (importPath === null) return [99, 0];

  const isExternal =
    !importPath.startsWith("@/") &&
    !importPath.startsWith("./") &&
    !importPath.startsWith("../");

  // Group 0: Externals
  if (isExternal) {
    if (importPath === "react") return [0, 0];
    if (importPath.startsWith("react-") || importPath.startsWith("react/"))
      return [0, 1];
    if (
      importPath.startsWith("@capacitor/") ||
      importPath.startsWith("capacitor-plugin") ||
      importPath.startsWith("@capawesome/")
    )
      return [0, 2];
    if (importPath === "decimal.js") return [0, 3];
    if (importPath.startsWith("@bitauth/")) return [0, 4];
    if (importPath.startsWith("@ant-design/")) return [0, 6];
    return [0, 5]; // other 3rd party
  }

  // Group 0 continued: @/icons (after anticons)
  if (importPath.startsWith("@/icons/")) return [0, 7];

  // Group 1: @/redux
  if (importPath.startsWith("@/redux") || importPath === "@/redux")
    return [1, 0];

  // Group 2: @/kernel
  if (importPath.startsWith("@/kernel/")) return [2, 0];

  // Group 3: Components (all as one group)
  if (importPath.startsWith("@/views/") || importPath.startsWith("@/apps/"))
    return [3, 0];
  if (importPath.startsWith("@/layout/")) return [3, 1];
  if (importPath.startsWith("@/atoms/")) return [3, 2];
  if (importPath.startsWith("@/components/")) {
    if (importPath.includes("/atoms/")) return [3, 2];
    if (importPath.includes("/layout/")) return [3, 1];
    if (importPath.includes("/composite/")) return [3, 3];
    if (importPath.includes("/views/")) return [3, 0];
    return [3, 2]; // default component
  }
  if (importPath.startsWith("@/composite/")) return [3, 3];

  // Group 4: @/hooks
  if (importPath.startsWith("@/hooks/")) return [4, 0];

  // Group 6: @/routes
  if (importPath.startsWith("@/routes/")) return [6, 0];

  // Group 7: translations (@/util/translations, @/translations/*, ./translations)
  if (
    importPath === "@/util/translations" ||
    importPath.startsWith("@/translations/")
  )
    return [7, 0];

  // Group 5: @/util and other @/ (apolloClient, etc.)
  if (importPath.startsWith("@/util/")) return [5, 0];
  if (importPath.startsWith("@/")) return [5, 1]; // other @/

  // Group 7: relative translations
  if (
    importPath.endsWith("/translations") ||
    importPath === "./translations" ||
    importPath === "../translations"
  )
    return [7, 1];

  // Group 8: all other ./ and ../ relative imports
  return [8, 0];
}

function parseFile(filepath) {
  const lines = fs.readFileSync(filepath, "utf8").split("\n");
  // Re-add newlines to match line-by-line processing
  const rawLines = lines.map((l, i) =>
    i < lines.length - 1 ? l + "\n" : l === "" ? "" : l + "\n"
  );
  // Remove trailing empty string from split if file ends with newline
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  // Collect preamble (eslint-disable comments, shebang, etc.)
  const preamble = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i].trimEnd();
    if (
      line.startsWith("/*") ||
      (line.startsWith("//") && !line.startsWith("//import"))
    ) {
      if (line.startsWith("/*")) {
        preamble.push(rawLines[i]);
        while (!rawLines[i].includes("*/")) {
          i++;
          preamble.push(rawLines[i]);
        }
        i++;
        continue;
      } else {
        preamble.push(rawLines[i]);
        i++;
        continue;
      }
    }
    break;
  }

  // Parse import block
  const imports = [];
  let inImport = false;
  let currentLines = [];

  while (i < rawLines.length) {
    const line = rawLines[i].trimEnd();

    // Start of import statement
    if (
      line.startsWith("import ") ||
      line.startsWith("import{") ||
      line.startsWith("import type ")
    ) {
      inImport = true;
      currentLines = [rawLines[i]];
      if (line.includes(";")) {
        inImport = false;
        imports.push([...currentLines]);
        currentLines = [];
      }
      i++;
      continue;
    }

    // Commented-out import
    if (line.startsWith("//import ")) {
      imports.push([rawLines[i]]);
      i++;
      continue;
    }

    // Continuation of multi-line import
    if (inImport) {
      currentLines.push(rawLines[i]);
      if (line.includes(";")) {
        inImport = false;
        imports.push([...currentLines]);
        currentLines = [];
      }
      i++;
      continue;
    }

    // Blank line or comment between imports
    if (
      line === "" ||
      (line.startsWith("//") && !line.startsWith("//import"))
    ) {
      let j = i + 1;
      let hasMoreImports = false;
      while (j < rawLines.length) {
        const nextLine = rawLines[j].trimEnd();
        if (
          nextLine.startsWith("import ") ||
          nextLine.startsWith("import{") ||
          nextLine.startsWith("import type ") ||
          nextLine.startsWith("//import ")
        ) {
          hasMoreImports = true;
          break;
        }
        if (nextLine === "" || nextLine.startsWith("//")) {
          j++;
          continue;
        }
        break;
      }
      if (hasMoreImports) {
        i++;
        continue;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  const rest = rawLines.slice(i);
  return { preamble, imports, rest };
}

function alphabetizeSpecifiers(impLines) {
  const text = impLines.join("");

  // Match destructured imports: import { A, B, C } from "..."
  // Also handles multi-line: import {\n  A,\n  B,\n} from "..."
  const match = text.match(
    /^(import\s+(?:type\s+)?)\{([^}]+)\}(\s+from\s+.+)$/s
  );
  if (!match) return impLines;

  const [, prefix, specBlock, suffix] = match;
  const isMultiLine = specBlock.includes("\n");

  // Parse specifiers, preserving "as" aliases
  const specifiers = specBlock
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (specifiers.length <= 1) return impLines;

  // Sort by the imported name (before "as")
  specifiers.sort((a, b) => {
    const nameA = a.split(/\s+as\s+/)[0].trim();
    const nameB = b.split(/\s+as\s+/)[0].trim();
    return nameA.localeCompare(nameB);
  });

  let result;
  if (isMultiLine) {
    const joined = specifiers.map((s) => `  ${s},`).join("\n");
    result = `${prefix}{\n${joined}\n}${suffix}`;
  } else {
    result = `${prefix}{ ${specifiers.join(", ")} }${suffix}`;
  }

  return result.split("\n").map((l, i, arr) => {
    return i < arr.length - 1 ? l + "\n" : l;
  });
}

function sortImports(imports) {
  const tagged = imports.map((impLines) => {
    const sorted = alphabetizeSpecifiers(impLines);
    const text = sorted.join("");
    let importPath;
    if (text.trimStart().startsWith("//import")) {
      const uncommented = text.replace(/^\/+/, "").trimStart();
      importPath = getImportPath(uncommented);
    } else {
      importPath = getImportPath(text);
    }
    const prio = priority(importPath);
    return { prio, importPath: importPath || "", impLines: sorted };
  });

  // Sort by priority, then alphabetically by import path within group
  tagged.sort((a, b) => {
    if (a.prio[0] !== b.prio[0]) return a.prio[0] - b.prio[0];
    if (a.prio[1] !== b.prio[1]) return a.prio[1] - b.prio[1];
    return a.importPath.localeCompare(b.importPath);
  });

  // Insert blank lines between major groups
  const resultLines = [];
  let prevMajor = null;
  tagged.forEach(({ prio, impLines }) => {
    const mg = prio[0];
    if (prevMajor !== null && mg !== prevMajor) {
      resultLines.push("\n");
    }
    resultLines.push(...impLines);
    prevMajor = mg;
  });

  return resultLines;
}

function processFile(filepath) {
  const { preamble, imports, rest } = parseFile(filepath);

  if (imports.length === 0) return false;

  const sortedImportLines = sortImports(imports);

  // Ensure blank line between imports and rest of file
  if (rest.length > 0 && rest[0].trim() !== "") {
    sortedImportLines.push("\n");
  }

  const newContent = [...preamble, ...sortedImportLines, ...rest].join("");
  const oldContent = fs.readFileSync(filepath, "utf8");

  if (newContent === oldContent) return false;

  fs.writeFileSync(filepath, newContent);
  return true;
}

function walkDir(dir, callback) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === "node_modules") return;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath);
    }
  });
}

const changed = [];
walkDir("src", (filepath) => {
  if (!/\.(ts|tsx|js|jsx)$/.test(filepath)) return;
  if (filepath.includes(".test.")) return;
  if (processFile(filepath)) {
    changed.push(filepath);
  }
});

console.log(`Changed ${changed.length} files:`);
changed.forEach((f) => console.log(`  ${f}`));
