/**
 * @file Madlib grammar for tree-sitter
 * @author Brekk Bockrath <brekk@brekkbockrath.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  ternary: 1,
  or: 2,
  and: 3,
  nullish: 4,
  equality: 5,
  relational: 6,
  concat: 7,
  additive: 8,
  multiplicative: 9,
  unary: 10,
  access: 11,
  call: 12,
};

module.exports = grammar({
  name: "madlib",

  extras: ($) => [/\s/, $.line_comment, $.block_comment],
  word: ($) => $.identifier,

  supertypes: ($) => [$._expression, $._pattern, $._type, $._declaration],

  conflicts: ($) => [
    [$.record, $.block], // `{` is ambiguous: record literal vs. block body
    [$.record_type, $.record],
  ],

  rules: {
    source_file: ($) => repeat($._declaration),

    _declaration: ($) =>
      choice(
        $.import_declaration,
        $.type_declaration,
        $.alias_declaration,
        $.interface_declaration,
        $.instance_declaration,
        $.type_annotation,
        $.assignment,
        $.export_declaration,
        $.target_block,
      ),

    export_declaration: ($) =>
      seq("export", choice($.assignment, $.type_annotation)),

    // ---------- imports ----------
    // import IO from "IO" | import { fn } from "./File" | import type { Maybe } from "Maybe"
    import_declaration: ($) =>
      seq(
        "import",
        optional("type"),
        field("source", choice($.namespace, $.import_list)),
        "from",
        field("path", $.string),
      ),
    namespace: ($) => $.type_identifier,
    import_list: ($) => seq("{", commaSep($.identifier), optional(","), "}"),

    // ---------- ADTs ----------
    // type Color = Hex(String) | RGB(Integer, Integer, Integer)
    type_declaration: ($) =>
      seq(
        "type",
        field("name", $.type_identifier),
        repeat(field("parameter", $.identifier)),
        "=",
        pipeSep($.constructor),
      ),
    constructor: ($) =>
      seq(
        field("name", $.type_identifier),
        optional(seq("(", commaSep($._type), ")")),
      ),

    // ---------- records / aliases ----------
    // alias CoolRec = { j :: Boolean, ...Other }
    alias_declaration: ($) =>
      seq(
        "alias",
        field("name", $.type_identifier),
        repeat(field("parameter", $.identifier)),
        "=",
        field("body", $._type),
      ),
    record_type: ($) =>
      seq(
        "{",
        commaSep(choice($.field_type, $.type_spread)),
        optional(","),
        "}",
      ),
    field_type: ($) =>
      seq(field("name", $.identifier), "::", field("type", $._type)),
    type_spread: ($) => seq("...", $.type_identifier), // only one spread is legal — enforce in a lint, not the grammar

    // ---------- interfaces ----------
    interface_declaration: ($) =>
      seq(
        "interface",
        optional($.type_constraints),
        field("name", $.type_identifier),
        repeat(field("parameter", $.identifier)),
        "{",
        repeat($.type_annotation),
        "}",
      ),
    instance_declaration: ($) =>
      seq(
        "instance",
        optional($.type_constraints),
        field("name", $.type_identifier),
        repeat(field("type", $._type_atom)),
        "{",
        repeat($.assignment),
        "}",
      ),
    type_constraints: ($) =>
      seq(choice($.constraint, seq("(", commaSep($.constraint), ")")), "=>"),
    constraint: ($) => seq($.type_identifier, repeat1($._type_atom)),

    // ---------- signatures ----------
    // modX :: (a -> a) -> Maybe x -> Maybe x
    type_annotation: ($) =>
      seq(
        field("name", $.identifier),
        "::",
        optional($.type_constraints),
        field("type", $._type),
      ),

    _type: ($) => choice($.function_type, $.type_application, $._type_atom),
    function_type: ($) => prec.right(seq($._type, "->", $._type)),
    type_application: ($) =>
      prec.left(seq($.type_identifier, repeat1($._type_atom))),
    _type_atom: ($) =>
      choice(
        $.type_identifier,
        $.identifier,
        $.record_type,
        $.tuple_type,
        $.parenthesized_type,
      ),
    parenthesized_type: ($) => seq("(", $._type, ")"),
    tuple_type: ($) => seq("#[", commaSep($._type), "]"),

    // ---------- bindings ----------
    assignment: ($) =>
      seq(field("name", $.identifier), "=", field("value", $._expression)),

    // ---------- expressions ----------
    _expression: ($) =>
      choice(
        $.abstraction,
        $.application,
        $.if_expression,
        $.ternary_expression,
        $.where_expression,
        $.do_expression,
        $.binary_expression,
        $.unary_expression,
        $.access,
        $.access_shorthand,
        $.record,
        $.list,
        $.tuple,
        $.template_string,
        $.string,
        $.char,
        $.number,
        $.boolean,
        $.unit,
        $.identifier,
        $.type_identifier,
        $.placeholder,
        $.parenthesized_expression,
        $.foreign_fence,
      ),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    // (a, b) => body   |   (Book(_, _, tags)) => body
    abstraction: ($) =>
      prec.right(
        seq(
          field("parameters", $.parameters),
          "=>",
          field("body", choice($.block, $._expression)),
        ),
      ),
    parameters: ($) => seq("(", commaSep($._pattern), ")"),
    block: ($) => seq("{", repeat($._statement), "}"),
    _statement: ($) =>
      choice(
        $.assignment,
        $.return_statement,
        $.type_annotation,
        $._expression,
      ),
    return_statement: ($) => seq("return", $._expression),

    application: ($) =>
      prec(
        PREC.call,
        seq(
          field("function", $._expression),
          "(",
          optional(commaSep(choice($._expression, $.placeholder))),
          ")",
        ),
      ),
    placeholder: (_) => "$", // division($, 5)

    // if/else is an expression and `else` is mandatory
    if_expression: ($) =>
      prec.right(
        seq(
          "if",
          "(",
          field("condition", $._expression),
          ")",
          field("consequence", choice($.block, $._expression)),
          "else",
          field("alternative", choice($.block, $._expression, $.if_expression)),
        ),
      ),
    ternary_expression: ($) =>
      prec.right(
        PREC.ternary,
        seq($._expression, "?", $._expression, ":", $._expression),
      ),

    // where(d) { Mon => Tue \n Sun => Mon }
    where_expression: ($) =>
      seq(
        "where",
        "(",
        field("subject", $._expression),
        ")",
        "{",
        repeat1($.where_arm),
        "}",
      ),
    where_arm: ($) =>
      seq(
        field("pattern", $._pattern),
        "=>",
        field("body", choice($.block, $._expression)),
      ),

    // do { _ <- Test.assertEquals(a, b) \n return {} }
    do_expression: ($) =>
      seq("do", "{", repeat(choice($.bind, $._statement)), "}"),
    bind: ($) =>
      seq(field("name", $._pattern), "<-", field("value", $._expression)),

    binary_expression: ($) =>
      choice(
        ...[
          ["||", PREC.or],
          ["&&", PREC.and],
          ["??", PREC.nullish],
          ["==", PREC.equality],
          ["!=", PREC.equality],
          ["<", PREC.relational],
          ["<=", PREC.relational],
          [">", PREC.relational],
          [">=", PREC.relational],
          ["++", PREC.concat],
          ["+", PREC.additive],
          ["-", PREC.additive],
          ["*", PREC.multiplicative],
          ["/", PREC.multiplicative],
          ["%", PREC.multiplicative],
        ].map(([op, p]) =>
          prec.left(
            p,
            seq(
              field("left", $._expression),
              field("operator", op),
              field("right", $._expression),
            ),
          ),
        ),
      ),
    unary_expression: ($) =>
      prec(PREC.unary, seq(field("operator", choice("!", "-")), $._expression)),

    // person.name   vs.   pipe(.name, String.toLower)
    access: ($) =>
      prec(PREC.access, seq($._expression, ".", field("field", $.identifier))),
    access_shorthand: ($) => seq(".", field("field", $.identifier)),

    record: ($) =>
      seq(
        "{",
        commaSep(choice($.field, $.spread, $.identifier)),
        optional(","),
        "}",
      ),
    field: ($) =>
      seq(field("name", $.identifier), ":", field("value", $._expression)),
    spread: ($) => seq("...", $._expression),
    list: ($) =>
      seq(
        "[",
        optional(seq(commaSep(choice($._expression, $.spread)), optional(","))),
        "]",
      ),
    tuple: ($) => seq("#[", commaSep($._expression), "]"),

    // ---------- patterns ----------
    _pattern: ($) =>
      choice(
        $.wildcard,
        $.identifier,
        $.constructor_pattern,
        $.record_pattern,
        $.list_pattern,
        $.tuple_pattern,
        $.string,
        $.char,
        $.number,
        $.boolean,
        $.type_identifier, // singleton variants: Mon, Nothing, LT
      ),
    wildcard: (_) => "_",
    constructor_pattern: ($) =>
      seq(field("name", $.type_identifier), "(", commaSep($._pattern), ")"),
    record_pattern: ($) =>
      seq(
        "{",
        commaSep(choice($.field_pattern, $.identifier, $.spread_pattern)),
        "}",
      ),
    field_pattern: ($) =>
      seq(field("name", $.identifier), ":", field("pattern", $._pattern)),
    spread_pattern: ($) => seq("...", $._pattern),
    list_pattern: ($) =>
      seq("[", optional(commaSep(choice($._pattern, $.spread_pattern))), "]"),
    tuple_pattern: ($) => seq("#[", commaSep($._pattern), "]"),

    // ---------- FFI ----------
    target_block: ($) =>
      seq(
        "#iftarget",
        field("target", $.identifier),
        repeat($._declaration),
        "#endiftarget", // TODO: verify terminator token
      ),
    foreign_fence: (_) => token(seq("#-", /[^-]*(-[^#][^-]*)*/, "-#")),

    // ---------- lexical ----------
    identifier: (_) => /[a-z_]\w*/,
    type_identifier: (_) => /[A-Z]\w*/,
    number: (_) => /-?\d+(\.\d+)?([eE][+-]?\d+)?/,
    boolean: (_) => choice("true", "false"),
    unit: (_) => "{}",
    char: (_) => /'([^'\\]|\\.)'/,
    string: (_) => /"([^"\\]|\\.)*"/,

    template_string: ($) =>
      seq(
        "`",
        repeat(choice($.template_chars, $.escape_sequence, $.interpolation)),
        "`",
      ),
    template_chars: (_) => token.immediate(/[^`$\\]+/),
    escape_sequence: (_) => token.immediate(/\\./),
    interpolation: ($) => seq("${", $._expression, "}"),

    line_comment: (_) => token(seq("//", /.*/)),
    block_comment: (_) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});

function commaSep(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
function pipeSep(rule) {
  return seq(rule, repeat(seq("|", rule)));
}
