import fetch from "node-fetch"; // For making HTTP requests in Node.js

async function translateJSONKeys(jsonObject, targetLanguages) {
  const translations = {};

  for (const lang of targetLanguages) {
    // Skip translations that are already present
    if (jsonObject[lang]) {
      continue;
    }

    const translation = await translateText(
      jsonObject.en,
      lang,
      process.env.GOOGLE_TRANSLATE_API_KEY
    );

    console.log(
      "New translation: ",
      jsonObject.en,
      " // ",
      lang,
      " // ",
      translation
    );

    translations[lang] = translation;
  }

  const aggregatedTranslations = {
    ...jsonObject,
    ...translations,
  };

  // Sort the keys alphabetically
  const sortedKeys = Object.keys(aggregatedTranslations).sort();

  // Create a new object with sorted keys
  const sortedTranslations = {};
  sortedKeys.forEach((key) => {
    sortedTranslations[key] = aggregatedTranslations[key];
  });

  return sortedTranslations;
}

// Brand names and terms that must never be translated or transliterated.
// Each entry is replaced with a numbered placeholder before sending to
// Google Translate, then restored in the result.
const PROTECTED_TERMS = [
  "Bitcoin Cash",
  "Selene",
  "BCH",
  "PIN",
  "CashTokens",
  "CashFusion",
  "WalletConnect",
  "Cauldron",
  "BCMR",
  "BChat",
  "NFT",
  "NFTs",
  "Telegram",
  "Electrum",
];

async function translateText(text, targetLang, GOOGLE_TRANSLATE_API_KEY) {
  try {
    // Replace protected terms with placeholders
    const replacements = [];
    let safeText = text;
    PROTECTED_TERMS.forEach((term, i) => {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      if (re.test(safeText)) {
        const placeholder = `<x id="${i}"/>`;
        replacements.push({ placeholder, term });
        safeText = safeText.replace(re, placeholder);
      }
    });

    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    const requestBody = {
      q: safeText,
      source: "en",
      target: targetLang,
      format: "html",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(await response.json());
      throw new Error("Translation request failed");
    }

    const data = await response.json();
    let translated = data.data.translations[0].translatedText;

    // Decode HTML entities
    translated = translated
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    // Restore protected terms with proper spacing.
    // Google Translate may strip or add spaces around XML placeholders.
    // We ensure exactly one space on each side unless the term is at
    // the start/end of the string or adjacent to punctuation.
    replacements.forEach(({ placeholder, term }) => {
      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
      const re = new RegExp(`\\s*${escaped}\\s*`, "g");
      translated = translated.replace(re, (match, offset) => {
        const before = translated[offset - 1] || "";
        const afterIdx = offset + match.length;
        const after = translated[afterIdx] || "";
        const needsLeadingSpace = before && !/[\s(]/.test(before);
        const needsTrailingSpace = after && !/[\s.,;:!?)/]/.test(after);
        return (needsLeadingSpace ? " " : "") + term + (needsTrailingSpace ? " " : "");
      });
    });

    return translated;
  } catch (error) {
    console.error(`Translation error for ${targetLang}: ${error.message}`);
    return text;
  }
}

export default translateJSONKeys;
