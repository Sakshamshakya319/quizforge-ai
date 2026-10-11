import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────

// Labels A–E supported in both upper and lower case.
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Normalise a raw text string:
 *   - collapse \r\n / \r to \n
 *   - do NOT collapse multiple blank lines (we need paragraph boundaries)
 *   - trim trailing spaces per line
 */
function normaliseText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n');
}

// ─────────────────────────────────────────────────────────────
//  OPTION SPLITTER
//
//  Given a single line that may contain concatenated options
//  such as "A. FooB. BarC. BazD. Qux", this function returns
//  an array of {label, text} objects.
//
//  The algorithm:
//    1. Try to split on clear label boundaries first (newline/space + label).
//    2. If ≥2 known option labels appear in the line, apply
//       sequential-label splitting to recover them.
//    3. Return null when the line is genuinely not an option block.
// ─────────────────────────────────────────────────────────────

// Matches " A. " / " A) " / " (A) " / "\nA. " etc. with optional leading space/newline.
// We do NOT match the very start of the string here — that is handled by isOptionLine().
const BOUNDARY_RE = /(?:^|(?<=\S))(?:\s*)(?:\()?([A-Ea-e])(?:\)|\.)\s+/g;

/**
 * Returns true if the line begins with a recognised option label.
 * Patterns: "A. text", "A) text", "(A) text"
 */
function isOptionLine(line) {
  return /^(?:\()?[A-Ea-e](?:\)|\.)\s+/i.test(line);
}

/**
 * isStrongOptionLabel(line, expectedLabel)
 *
 * Returns true when `line` starts with the literal option label we expect next.
 * Example: isStrongOptionLabel("B. Some text", "B") → true
 */
function isStrongOptionLabel(line, label) {
  const re = new RegExp(`^\\(?${label}(?:\\)|\\.)\\s+`, 'i');
  return re.test(line);
}

/**
 * splitConcatenatedOptions(line, expectedLabels)
 *
 * Attempts to split a single string that may contain multiple
 * consecutive options without newlines between them.
 *
 * Strategy:
 *   Build a regex that looks for each expected label prefix in sequence,
 *   anchoring on the previous match position.
 *
 * Safety rules applied here:
 *   - Only split on A/B/C/D/E followed by "." or ")" and a space.
 *   - Do not split inside HTML tags (<A href ...>).
 *   - Do not split on standalone letters inside prose.
 *
 * Returns an array of {label, text} or null if no valid split found.
 */
function splitConcatenatedOptions(line, expectedLabels) {
  if (!expectedLabels || expectedLabels.length === 0) return null;

  // Build a split pattern that finds the label boundaries
  // Pattern: (?<![<\w])(?:\()?([A-E])(?:\)|\.)\s
  // "not preceded by '<' or word char" avoids matching inside HTML tags.
  const labelPattern = expectedLabels
    .map(l => `(?:^|(?<![<\\w\\d]))\\(?${l}(?:\\)|\\.)([ \\t]+|(?=[^ ]))`)
    .join('|');

  const splitRe = new RegExp(labelPattern, 'gi');
  const parts = [];
  let lastIndex = 0;
  let lastLabel = null;
  let m;

  splitRe.lastIndex = 0;

  while ((m = splitRe.exec(line)) !== null) {
    if (lastLabel !== null) {
      const text = line.slice(lastIndex, m.index).trim();
      if (text) parts.push({ label: lastLabel, text });
    }
    // Determine which label matched
    const raw = m[0].trim();
    lastLabel = raw.replace(/[().]/g, '').trim().toUpperCase();
    lastIndex = m.index + m[0].length;
  }

  if (lastLabel !== null) {
    const text = line.slice(lastIndex).trim();
    if (text) parts.push({ label: lastLabel, text });
  }

  return parts.length >= 2 ? parts : null;
}

// ─────────────────────────────────────────────────────────────
//  REGEXES
// ─────────────────────────────────────────────────────────────

// Matches numbered question starts: "1.", "1)", "Q1.", "Q.1", "Question 1:"
// Must be at line start and have at least some question text (or be a bare header).
// Group 1 = question number (digits), Group 2 = optional inline question text.
const Q_INLINE_RE  = /^(?:Question\s+|Q\.?\s*)?(\d+)[.):\s]\s*(.+)$/i;
const Q_HEADER_RE  = /^(?:Question\s+|Q\.?\s*)?(\d+)[.):]\s*$/i;

// Option lines: "A. text", "A) text", "(A) text"
const OPT_LINE_RE  = /^(?:\()?([A-Ea-e])(?:\)|\.)[ \t]+(.+)$/i;

// Answer key: "Answer: A", "Correct Answer: B", "Ans: C", "Ans. (D)"
// Group 1 = letter
const ANS_LETTER_RE = /^(?:Correct\s+)?(?:Answer|Ans(?:wer)?|Option)[\s.:]*\(?([A-Ea-e])\)?[\s.]*$/i;
// Fallback for "Answer: full text option" (less common)
const ANS_TEXT_RE   = /^(?:Correct\s+)?(?:Answer|Ans(?:wer)?|Option)[\s.:]+(.+)$/i;

const EXPLANATION_RE = /^Explanation[\s.:]+(.+)$/i;

// Lines that look like section headings / non-question content and should be skipped
const SKIP_RE = /^(?:Section|Part|Unit|Chapter|Topic)\s*\d/i;

// ─────────────────────────────────────────────────────────────
//  STATE MACHINE QUESTION EXTRACTOR
// ─────────────────────────────────────────────────────────────

/**
 * extractQuestions(text)
 *
 * Main entry point.
 * text: the output of parseDocument() — paragraphs separated by \n,
 *       soft line breaks within a paragraph also as \n.
 *
 * Returns an array of question objects compatible with the existing app schema.
 */
export const extractQuestions = (text) => {
  const normText = normaliseText(text);

  // Split into logical lines; we keep blank lines to detect paragraph gaps
  const rawLines = normText.split('\n');

  // Expand each line: if a line contains multiple concatenated options
  // that could not be separated by the document parser, split them here.
  const lines = expandLines(rawLines);

  const questions = [];
  let current = null; // the question being built
  let phase = 'idle'; // 'idle' | 'question' | 'options' | 'answer' | 'explanation'
  let lastQuestionNumber = 0; // to detect out-of-sequence "question" matches

  const finalizeQuestion = () => {
    if (!current) return;

    if (!current.questionText.trim()) {
      current = null;
      return;
    }

    // Post-process options: if we only have 1 option but it looks like
    // concatenated text, attempt to split it.
    if (current.rawOptions.length === 1 && current.rawOptions[0].text.length > 20) {
      const expanded = splitConcatenatedOptions(
        current.rawOptions[0].label + '. ' + current.rawOptions[0].text,
        OPTION_LABELS.slice(0, 4)
      );
      if (expanded && expanded.length >= 2) {
        current.rawOptions = expanded;
      }
    }

    // Build stable option objects with UUIDs
    const options = current.rawOptions.map(o => ({
      id: uuidv4(),
      label: o.label.toUpperCase(),
      text: o.text.trim(),
    }));

    // Resolve answer
    let correctOptionId = null;
    let verificationStatus = 'unverified';

    if (options.length < 2) {
      verificationStatus = 'error';
      current.explanation =
        'Diagnostic: fewer than 2 recognisable options found. Please edit manually.\n' +
        (current.explanation || '');
    } else if (current.answerLabel) {
      const ansLabel = current.answerLabel.toUpperCase().trim();
      const matched = options.find(o => o.label === ansLabel);
      if (matched) {
        correctOptionId = matched.id;
        verificationStatus = 'verified';
      } else {
        // Try matching by text
        const textMatched = options.find(o =>
          o.text.toLowerCase().includes(current.answerLabel.toLowerCase()) ||
          current.answerLabel.toLowerCase().includes(o.text.toLowerCase())
        );
        if (textMatched) {
          correctOptionId = textMatched.id;
          verificationStatus = 'verified';
        } else {
          verificationStatus = 'invalid_answer_key';
          current.explanation =
            `Diagnostic: answer key "${current.answerLabel}" does not match any option label.\n` +
            (current.explanation || '');
        }
      }
    }

    questions.push({
      id: uuidv4(),
      originalIdentifier: current.questionNumber ? `${current.questionNumber}.` : null,
      questionText: current.questionText.trim(),
      options,
      correctOptionId,
      originalAnswerText: current.answerLabel || null,
      explanation: (current.explanation || '').trim(),
      source: { filename: 'Uploaded Document', pageOrSlide: null },
      verificationStatus,
      extractionConfidence: correctOptionId ? 0.9 : (options.length >= 4 ? 0.6 : 0.3),
    });

    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Skip blank lines; they delimit paragraphs but don't change phase ──
    if (!line.trim()) continue;

    // ── Skip known section headers ──
    if (SKIP_RE.test(line.trim())) continue;

    // ── Check for answer line ──
    const ansLetterMatch = line.trim().match(ANS_LETTER_RE);
    if (ansLetterMatch && current) {
      current.answerLabel = ansLetterMatch[1].toUpperCase();
      phase = 'answer';
      continue;
    }

    // Fallback answer text (only when no letter was captured)
    const ansTextMatch = line.trim().match(ANS_TEXT_RE);
    if (ansTextMatch && current && !ansLetterMatch) {
      // Only use if it looks like a single capital letter or short label
      const candidate = ansTextMatch[1].trim();
      if (/^[A-Ea-e]$/.test(candidate)) {
        current.answerLabel = candidate.toUpperCase();
        phase = 'answer';
        continue;
      }
      // Longer text: treat as answer by text (handled in finalise)
      current.answerLabel = candidate;
      phase = 'answer';
      continue;
    }

    // ── Check for explanation line ──
    const expMatch = line.trim().match(EXPLANATION_RE);
    if (expMatch && current) {
      current.explanation += (current.explanation ? '\n' : '') + expMatch[1];
      phase = 'explanation';
      continue;
    }
    if (phase === 'explanation' && current) {
      current.explanation += '\n' + line.trim();
      continue;
    }

    // ── Check for option line ──
    const optMatch = line.trim().match(OPT_LINE_RE);
    if (optMatch && current) {
      const label = optMatch[1].toUpperCase();
      const text  = optMatch[2].trim();
      // Avoid duplication
      if (!current.rawOptions.find(o => o.label === label)) {
        current.rawOptions.push({ label, text });
      }
      phase = 'options';
      continue;
    }

    // ── Check for question start ──
    const qInlineMatch = line.trim().match(Q_INLINE_RE);
    const qHeaderMatch = line.trim().match(Q_HEADER_RE);

    if (qInlineMatch || qHeaderMatch) {
      const qNum = parseInt(
        qInlineMatch ? qInlineMatch[1] : qHeaderMatch[1],
        10
      );

      // Safety: question numbers should be roughly sequential.
      // If a number is far out of range (e.g. a code snippet "100px"),
      // it might be a false positive — skip it unless it's the very first.
      const isSequential =
        questions.length === 0 ||
        qNum === lastQuestionNumber + 1 ||
        (qNum > lastQuestionNumber && qNum <= lastQuestionNumber + 5);

      if (!isSequential && questions.length > 0) {
        // Treat as continuation of current question text instead
        if (current && phase === 'question') {
          current.questionText += '\n' + line.trim();
        }
        continue;
      }

      finalizeQuestion();
      lastQuestionNumber = qNum;

      current = {
        questionNumber: qNum,
        questionText: qInlineMatch ? qInlineMatch[2].trim() : '',
        rawOptions: [],
        answerLabel: null,
        explanation: '',
      };
      phase = 'question';
      continue;
    }

    // ── Default: accumulate into current phase ──
    if (!current) continue;

    if (phase === 'question') {
      current.questionText += (current.questionText ? '\n' : '') + line.trim();
    } else if (phase === 'options') {
      // Append to last option as continuation
      if (current.rawOptions.length > 0) {
        current.rawOptions[current.rawOptions.length - 1].text += ' ' + line.trim();
      }
    } else if (phase === 'answer') {
      // Additional text after the answer line — probably belongs to explanation
      current.explanation += (current.explanation ? '\n' : '') + line.trim();
    }
  }

  finalizeQuestion();

  return questions;
};

// ─────────────────────────────────────────────────────────────
//  LINE EXPANDER
//
//  Given the raw lines from the document, this function
//  attempts to split any line that contains multiple
//  concatenated option labels into separate lines.
//
//  Input : ["A. FooB. BarC. BazD. Qux", "Answer: A"]
//  Output: ["A. Foo", "B. Bar", "C. Baz", "D. Qux", "Answer: A"]
// ─────────────────────────────────────────────────────────────

function expandLines(rawLines) {
  const result = [];

  for (const raw of rawLines) {
    const line = raw.trimEnd();

    // Only attempt splitting if the line starts with or contains an option label
    // and is long enough to plausibly contain multiple options.
    if (line.length < 4) {
      result.push(line);
      continue;
    }

    // Count how many potential option labels appear in the line
    const labelMatches = line.match(/(?<![<\w\d])(?:\(?)[A-Ea-e](?:[.)]) /g) || [];
    
    if (labelMatches.length >= 2) {
      // Attempt to split into individual option lines
      const parts = trySplitOptionLine(line);
      if (parts && parts.length >= 2) {
        result.push(...parts);
        continue;
      }
    }

    result.push(line);
  }

  return result;
}

/**
 * trySplitOptionLine(line)
 *
 * Attempts to split a line containing concatenated options.
 * Returns an array of individual lines, or null if no valid split.
 *
 * Example:
 *   "A. Hyper Text Markup LanguageB. High Text Machine LanguageC. ..."
 *   → ["A. Hyper Text Markup Language", "B. High Text Machine Language", "C. ..."]
 *
 * Safety rules:
 *   - The split point must be immediately after non-space text followed
 *     by an uppercase letter + "." or ")" 
 *   - We do not split inside HTML tags (no "<" immediately before the label)
 *   - We require the letter to be one of A–E
 *   - The letter must be followed by "." or ")" and a space (or end of string)
 */
function trySplitOptionLine(line) {
  // Find positions of all option boundary markers
  // Pattern: a letter A-E preceded by non-whitespace (the end of prev option text)
  // followed by "." or ")" and a space or end.
  // We use a look-around to find the boundary without consuming characters.
  const boundaries = [];
  const re = /(?<=\S)(?=\(?[A-Ea-e][.)]\s)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    // Extra safety: don't split inside <...> (HTML tag context)
    const before = line.slice(0, m.index);
    const openAngles = (before.match(/</g) || []).length;
    const closeAngles = (before.match(/>/g) || []).length;
    if (openAngles > closeAngles) continue; // inside HTML tag

    boundaries.push(m.index);
  }

  if (boundaries.length === 0) return null;

  const parts = [];
  let prev = 0;
  for (const pos of boundaries) {
    const part = line.slice(prev, pos).trim();
    if (part) parts.push(part);
    prev = pos;
  }
  const last = line.slice(prev).trim();
  if (last) parts.push(last);

  // Validate: each part should start with an option label
  const valid = parts.every(p => /^(?:\(?)[A-Ea-e](?:[.)]) /i.test(p));
  return valid ? parts : null;
}
