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

const HINGLISH_OPENERS = [
  'Dekho yaar,',
  'Matlab,',
  'Sach bataun toh,',
  'Suno yaar,',
  'Arey bhai,',
  'Honestly yaar,',
];

const HINGLISH_MID_FILLERS = [
  'matlab',
  'you know yaar,',
  'sach mein,',
  'bilkul',
];

const HINGLISH_CLOSERS = [
  'hai na?',
  'samjhe na?',
  'bas yahi baat hai.',
];

const ENGLISH_CASUAL_OPENERS = [
  'Honestly,',
  'You know,',
  'I mean,',
  'Listen,',
  'Well, to be honest,',
];

const GENZ_CREATOR_OPENERS = [
  "Let's be real,",
  'Honestly, no cap,',
  'Okay so basically,',
  'Lowkey,',
  'Wait, hear me out,',
];

/**
 * Automatically injects natural human conversational slang & fillers into text
 * so the synthesized voice sounds spontaneous, relatable, and ultra-human.
 */
export function autoInjectHumanSlang(
  rawText: string,
  slangMode = 'auto_human',
  accent = 'default',
  forceAdd = false
): string {
  const cleaned = removeExtraSpaces(rawText);
  if (!cleaned || slangMode === 'none') return cleaned;

  const lower = cleaned.toLowerCase();
  const alreadyHasSlang =
    /\b(yaar|matlab|sach bataun|dekho yaar|hai na|honestly|you know|i mean|let's be real|lowkey|no cap|to be honest)\b/i.test(
      lower
    );

  // During auto-generation, don't duplicate if the script already contains conversational slang
  if (alreadyHasSlang && !forceAdd) {
    return cleaned;
  }

  const isHinglishOrIndian =
    slangMode === 'hinglish_slang' ||
    accent.toLowerCase().includes('hinglish') ||
    accent.toLowerCase().includes('indian') ||
    /\b(kya|hai|nahi|aur|mein|tum|aap|kaise|accha|theek|भाई|यार)\b/i.test(lower);

  const openers = isHinglishOrIndian
    ? HINGLISH_OPENERS
    : slangMode === 'genz_creator'
    ? GENZ_CREATOR_OPENERS
    : ENGLISH_CASUAL_OPENERS;

  const chosenOpener = openers[Math.floor(Math.random() * openers.length)];

  // Split into sentences without destroying paragraph newlines
  const sentences = cleaned.split(/(?<=[.!?।|؟۔])[ \t]+/);
  if (sentences.length === 0) return cleaned;

  // Lowercase the first character of the first sentence if it's not "I " or an acronym or tag
  const firstSentence = sentences[0];
  let modifiedFirst = firstSentence;
  if (!firstSentence.startsWith('[')) {
    const firstWordMatch = firstSentence.match(/^([A-Za-z]+)/);
    const firstWord = firstWordMatch ? firstWordMatch[1] : '';
    const canLower =
      firstWord.length > 1 &&
      firstWord !== 'I' &&
      firstWord !== firstWord.toUpperCase();
    const adjustedStart = canLower
      ? firstSentence.charAt(0).toLowerCase() + firstSentence.slice(1)
      : firstSentence;
    modifiedFirst = `${chosenOpener} ${adjustedStart}`;
  } else {
    modifiedFirst = `${firstSentence} ${chosenOpener}`;
  }

  sentences[0] = modifiedFirst;

  // If there is a second sentence and forceAdd is true (or multi-sentence), weave a subtle mid/closer filler
  if (sentences.length >= 2 && isHinglishOrIndian) {
    const mid = HINGLISH_MID_FILLERS[Math.floor(Math.random() * HINGLISH_MID_FILLERS.length)];
    if (!sentences[1].toLowerCase().includes(mid)) {
      sentences[1] = `${mid.charAt(0).toUpperCase() + mid.slice(1)} ${
        sentences[1].charAt(0).toLowerCase() + sentences[1].slice(1)
      }`;
    }
  } else if (sentences.length === 1 && forceAdd && isHinglishOrIndian && !cleaned.endsWith('?')) {
    const closer = HINGLISH_CLOSERS[Math.floor(Math.random() * HINGLISH_CLOSERS.length)];
    sentences[0] = `${sentences[0].replace(/[.!]$/, '')}, ${closer}`;
  }

  return removeExtraSpaces(sentences.join(' '));
}

/**
 * Splits long scripts (10-minute, 50-minute, or 2+ hour voiceovers) cleanly at
 * paragraph and sentence boundaries (never mid-word or inside [tags]) so no
 * single TTS API call hits Gemini's ~4-5 minute output token ceiling.
 */
export function splitScriptIntoTtsChunks(rawText: string, maxChars = 1650): string[] {
  const cleaned = removeExtraSpaces(rawText);
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const paragraphs = cleaned
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Break paragraphs into sentence-level atomic units without splitting [audio tags]
  const units: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      units.push(para);
      continue;
    }
    const sentences = para
      .split(/(?<=[.!?।|؟۔])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      if (sentence.length <= maxChars) {
        units.push(sentence);
      } else {
        // Fallback: split very long run-on sentence by clauses (commas/semicolons), keeping [tags] intact
        const clauses = sentence
          .split(/(?<=[,;:])\s+/)
          .map((c) => c.trim())
          .filter(Boolean);

        for (const clause of clauses) {
          if (clause.length <= maxChars) {
            units.push(clause);
          } else {
            // Word-level split as last resort (keeps [bracket tags] atomic)
            const tokens = clause.match(/\[[^\]]+\]|\S+/g) || [clause];
            let wordBuf = '';
            for (const tok of tokens) {
              const cand = wordBuf ? `${wordBuf} ${tok}` : tok;
              if (cand.length <= maxChars) {
                wordBuf = cand;
              } else {
                if (wordBuf) units.push(wordBuf);
                wordBuf = tok;
              }
            }
            if (wordBuf) units.push(wordBuf);
          }
        }
      }
    }
  }

  // Greedily pack units into <= maxChars chunks
  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    const candidate = current ? `${current}\n${unit}` : unit;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = unit;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}


