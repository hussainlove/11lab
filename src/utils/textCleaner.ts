/**
 * Utility to automatically remove redundant/extra spaces and normalize punctuation
 * for ultra-clean speech synthesis, text formatting, and audio downloads.
 */
export function removeExtraSpaces(rawText: string): string {
  if (!rawText) return '';

  return (
    rawText
      // Replace non-breaking spaces & special whitespace with standard space
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      // Remove zero-width spaces
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Normalize Windows CR LF to LF
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Collapse multiple horizontal spaces and tabs into a single space
      .replace(/[ \t]{2,}/g, ' ')
      // Clean up whitespace inside audio tags e.g. [  laughs  ] -> [laughs]
      .replace(/\[\s+([^\]]+?)\s+\]/g, '[$1]')
      // Remove spaces before punctuation (comma, period, exclamation, question mark, colon, semicolon)
      .replace(/\s+([,.:;?!])/g, '$1')
      // Ensure single space after punctuation if immediately followed by a letter/word
      .replace(/([,.:;?!])(?=[A-Za-z])/g, '$1 ')
      // Trim leading and trailing spaces per line
      .split('\n')
      .map((line) => line.trim())
      // Collapse more than 2 consecutive empty lines into one
      .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
      .join('\n')
      // Final overall trim
      .trim()
  );
}

/**
 * Clean a string into a file-safe name with all spaces and redundant symbols removed
 * for MP3 download filenames.
 */
export function cleanFileName(name: string, fallback = 'speech'): string {
  if (!name) return fallback;
  const cleaned = removeExtraSpaces(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');
  return cleaned.substring(0, 40) || fallback;
}
