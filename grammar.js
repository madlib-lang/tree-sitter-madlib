/**
 * @file Madlib grammar for tree-sitter
 * @author Brekk Bockrath <brekk@brekkbockrath.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Boop matches its keyword/attribute lists case-insensitively — the regexes are
// `\b(var|let|...)\b` compiled with `.caseInsensitive`. So "Let", "SELECT",
// "FROM", "String" highlight just like their lowercase forms. Mirror that here.
const KEYWORDS = [
  "import",
  "type",
  "from",
  "if",
  "else",
  "export",
  "return",
  "do",
  "where",
];

const LITERALS = ["true", "false"];

// Turn "let" into "[lL][eE][tT]" — tree-sitter's regex engine has no
// case-insensitive flag, so spell the case-folding out per letter.
function caseInsensitive(word) {
  return word.replace(
    /[a-zA-Z]/g,
    (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`,
  );
}

// A case-insensitive alternation over a keyword list. The `word` directive
// (word: $._word) is what enforces Boop's `\b...\b` boundaries: tree-sitter only
// accepts one of these tokens when it spans a whole `_word`, so "insert" never
// matches inside "inserted" and "as" never matches inside "was". prec(1) then
// wins the exact-length tie against `_word` itself so real keywords highlight.
function keywordChoice(words) {
  const alternation = words.map(caseInsensitive).join("|");
  return token(prec(1, new RegExp(`(?:${alternation})`)));
}

module.exports = grammar({
  name: "madlib",

  extras: ($) => [/\s/],

  word: ($) => $._word,

  externals: ($) => [
    $.line_comment,
    $.block_comment,
    // $.html_comment,
    // $.triple_quoted_string,
  ],

  rules: {
    source_file: ($) =>
      repeat(
        choice(
          $.line_comment,
          $.block_comment,
          $.quoted_string,
          $.number,
          $.attribute,
          $.keyword,
          $._word,
          $._other,
        ),
      ),

    // Atomic identifier run. Consuming a whole word here is what gives keywords
    // their word boundaries: "was" is lexed as one `_word`, so "as" can never
    // start a token mid-word, and "inserted" out-matches the "insert" keyword.
    _word: (_) => token(/[a-zA-Z_]\w*/),

    // Comments — line_comment is handled by the external scanner alongside
    // block_comment so that `/` is dispatched without backtracking.

    quoted_string: (_) =>
      token(
        choice(
          seq('"', repeat(choice(/[^"\\\r\n]/, seq("\\", /[^\r\n]/))), '"'),
          seq("'", repeat(choice(/[^'\\\r\n]/, seq("\\", /[^\r\n]/))), "'"),
          seq("`", repeat(choice(/[^`\\\r\n]/, seq("\\", /[^\r\n]/))), "`"),
        ),
      ),

    // Numbers: hex, decimal with underscores, scientific notation, leading dot
    number: (_) =>
      token(
        choice(
          /0[xX][0-9a-fA-F][0-9a-fA-F_]*/,
          /[0-9][0-9_]*(\.[0-9][0-9_]*)?([eE][+-]?[0-9]+)?/,
          /\.[0-9][0-9_]*([eE][+-]?[0-9]+)?/,
        ),
      ),

    // Attributes — common keywords across languages (case-insensitive, like Boop)
    attribute: (_) => keywordChoice(KEYWORDS),

    // Keywords — types and booleans (case-insensitive, like Boop)
    keyword: (_) => keywordChoice(LITERALS),

    // Catch-all for unrecognized characters
    _other: (_) => token(/[^\s]/),
  },
});
