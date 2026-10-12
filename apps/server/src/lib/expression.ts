export type SymbolType = 'MENTION' | 'HASHTAG' | 'DOLLAR' | 'UNKNOWN';

export interface Symbol {
  type: SymbolType;
  value: string; // without the prefix
  start: number; // start index in the input string
  end: number;   // end index (exclusive)
}

export interface ExpressionToken {
  type: 'SYMBOL' | 'TEXT';
  symbol?: Symbol;
  text?: string;
}

/**
 * Lexes the input string into an array of expression tokens.
 * Currently, we recognize symbols that start with @, #, or $ and are followed by
 * one or more of [a-zA-Z0-9_.-].
 * 
 * This is a simple lexer and does not handle escaping or nested expressions.
 */
export function lexExpression(input: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  let pos = 0;

  while (pos < input.length) {
    const ch = input[pos];

    // Check if we are at the start of a symbol
    if (ch === '@' || ch === '#' || ch === '$') {
      const start = pos;
      let symbolType: SymbolType;
      switch (ch) {
        case '@': symbolType = 'MENTION'; break;
        case '#': symbolType = 'HASHTAG'; break;
        case '$': symbolType = 'DOLLAR'; break;
        default: symbolType = 'UNKNOWN'; // should not happen
      }

      pos++; // move past the prefix
      let value = '';
      while (pos < input.length) {
        const currentChar = input[pos];
        // Allow alphanumeric, underscore, dot, hyphen
        if (/[a-zA-Z0-9_.-]/.test(currentChar)) {
          value += currentChar;
          pos++;
        } else {
          break;
        }
      }

      if (value.length > 0) {
        tokens.push({
          type: 'SYMBOL',
          symbol: {
            type: symbolType,
            value,
            start,
            end: pos
          }
        });
      } else {
        // If there was no valid symbol content, treat the prefix as text
        tokens.push({ type: 'TEXT', text: ch });
      }
    } else {
      // Regular text
      let start = pos;
      while (pos < input.length) {
        const ch = input[pos];
        if (ch === '@' || ch === '#' || ch === '$') {
          break;
        }
        pos++;
      }
      const text = input.slice(start, pos);
      tokens.push({ type: 'TEXT', text });
    }
  }

  return tokens;
}

/**
 * Extracts mention symbols from the input string and returns an array of usernames (without the @).
 * This function is intended to replace the old `extractMentionUsernames`.
 */
export function extractMentionUsernames(input: string): string[] {
  const tokens = lexExpression(input);
  const usernames: string[] = [];
  for (const token of tokens) {
    if (token.type === 'SYMBOL' && token.symbol?.type === 'MENTION') {
      usernames.push(token.symbol.value);
    }
  }
  // Remove duplicates while preserving order (using Set but we want to preserve order of first occurrence)
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const username of usernames) {
    const lower = username.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(username);
    }
  }
  return unique;
}
