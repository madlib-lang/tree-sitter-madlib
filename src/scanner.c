#include "tree_sitter/parser.h"

enum TokenType { NEWLINE };

void *tree_sitter_madlib_external_scanner_create(void) { return NULL; }
void tree_sitter_madlib_external_scanner_destroy(void *payload) {}
unsigned tree_sitter_madlib_external_scanner_serialize(void *payload, char *buffer) { return 0; }
void tree_sitter_madlib_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

static bool is_space(int32_t c) {
  return c == ' ' || c == '\t' || c == '\r' || c == '\f' || c == '\v';
}

// Can only continue an expression, never begin a declaration or statement.
// NOTE: '/' is deliberately absent (comment start); '-' and '!' are absent
// because they can legitimately begin a statement.
static bool starts_continuation(int32_t c) {
  switch (c) {
    case '.': case ',': case ')': case ']': case '}':
    case '=': case '<': case '>': case '?': case ':':
    case '|': case '&': case '+': case '*': case '%': case '$':
      return true;
    default:
      return false;
  }
}

bool tree_sitter_madlib_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  if (!valid_symbols[NEWLINE]) return false;

  bool saw_newline = false;
  for (;;) {
    if (lexer->lookahead == '\n') {
      saw_newline = true;
      lexer->advance(lexer, true);
    } else if (is_space(lexer->lookahead)) {
      lexer->advance(lexer, true);
    } else {
      break;
    }
  }

  if (!saw_newline) return false;
  if (starts_continuation(lexer->lookahead)) return false;  // `\n` handled by extras

  lexer->mark_end(lexer);
  lexer->result_symbol = NEWLINE;
  return true;
}

