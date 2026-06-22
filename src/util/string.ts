export function truncate(str, maxLength, separator = "...") {
  if (str.length <= maxLength || maxLength === 0) {
    return str;
  }

  const showLength = maxLength - separator.length;

  const front = Math.ceil(showLength / 2);
  const back = Math.floor(showLength / 2);

  return str.substring(0, front) + separator + str.substring(str.length - back);
}

export function truncateProse(text) {
  // extract sentences, delimited by punctuation and whitespace
  const sentences = text.match(/.*?[.!?]\s*/g);

  // truncate down to first two sentences, remove whitespace
  const selectedText = (
    sentences ? sentences.slice(0, 2).join("") : text
  ).trim();

  if (selectedText.length <= 140) return selectedText;

  const truncated = selectedText.slice(0, 140);

  // truncate cleanly at word boundaries
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0
    ? `${truncated.slice(0, lastSpace)}...`
    : `${truncated}...`;
}
