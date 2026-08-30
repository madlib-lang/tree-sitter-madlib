#include "tree_sitter/parser.h"

enum TokenType {
  LINE_COMMENT,
  BLOCK_COMMENT,
};

void *tree_sitter_madlib_external_scanner_create(void) { return NULL; }

void tree_sitter_madlib_external_scanner_destroy(void *payload) {}

unsigned tree_sitter_madlib_external_scanner_serialize(void *payload,
                                                        char *buffer) {
  return 0;
}

void tree_sitter_madlib_external_scanner_deserialize(void *payload,
                                                      const char *buffer,
                                                      unsigned length) {}

static bool scan_slash_comment(TSLexer *lexer, const bool *valid_symbols) {
  // Positioned at '/'
  lexer->advance(lexer, false);

  if (lexer->lookahead == '/' && valid_symbols[LINE_COMMENT]) {
    // Line comment: consume until end of line
    lexer->advance(lexer, false);
    while (!lexer->eof(lexer) && lexer->lookahead != '\n') {
      lexer->advance(lexer, false);
    }
    lexer->result_symbol = LINE_COMMENT;
    lexer->mark_end(lexer);
    return true;
  }

  if (lexer->lookahead == '*' && valid_symbols[BLOCK_COMMENT]) {
    // Block comment: consume until */
    lexer->advance(lexer, false);
    while (!lexer->eof(lexer)) {
      if (lexer->lookahead == '*') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '/') {
          lexer->advance(lexer, false);
          lexer->result_symbol = BLOCK_COMMENT;
          lexer->mark_end(lexer);
          return true;
        }
      } else {
        lexer->advance(lexer, false);
      }
    }
    // Unclosed block comment
    lexer->result_symbol = BLOCK_COMMENT;
    lexer->mark_end(lexer);
    return true;
  }

  return false;
}


bool tree_sitter_madlib_external_scanner_scan(void *payload, TSLexer *lexer,
                                               const bool *valid_symbols) {
  // Skip whitespace
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
         lexer->lookahead == '\n' || lexer->lookahead == '\r') {
    lexer->advance(lexer, true);
  }

  // Dispatch '/' to handle both // and /* without backtracking
  if (lexer->lookahead == '/' &&
      (valid_symbols[LINE_COMMENT] || valid_symbols[BLOCK_COMMENT])) {
    lexer->mark_end(lexer);
    return scan_slash_comment(lexer, valid_symbols);
  }

  return false;
}
