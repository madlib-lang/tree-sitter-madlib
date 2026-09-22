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

function braced($, rule) {
  return seq(
    "{",
    optional($._newlines),
    repeat(seq(rule, optional($._newlines))),
    "}",
  );
}
function commaSep(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
// empty-allowed, trailing-comma-allowed comma list
function commaList(rule) {
  return optional(seq(commaSep(rule), optional(",")));
}

function pipeSep(rule) {
  return seq(rule, repeat(seq("|", rule)));
}

module.exports = grammar({
  name: "madlib",

  extras: ($) => [/[ \t\r\f\v\n]/, $.line_comment, $.block_comment],

  externals: ($) => [$._newline],

  word: ($) => $.identifier,

  supertypes: ($) => [$._expression, $._pattern, $._type, $._declaration],

  conflicts: ($) => [
    [$.record, $.block],
    [$.type_parameters, $._type_atom],
    [$.type_application, $._type_atom],
    [$._expression, $._pattern],
    [$._expression, $.constructor_pattern],
    [$.type_constraints, $._type],
    [$.record, $.record_pattern],
    [$.list, $.list_pattern],
    [$.tuple, $.tuple_pattern],
    [$.interface_body, $.record_type],
    [$.instance_body, $.record_type],
    [$._expression, $.record],
    [$.export_type_reference, $.type_declaration],
    [$.derive_declaration],
    [$.constructor],
    [$._type, $.function_type],
  ],

  rules: {
    source_file: ($) =>
      seq(
        optional($._newlines),
        repeat(seq($._declaration, optional($._newlines))),
      ),
    _newlines: ($) => repeat1($._newline),
    block: ($) => braced($, $._statement),
    interface_body: ($) => braced($, $.type_annotation),
    instance_body: ($) => braced($, $.assignment),
    do_expression: ($) => seq("do", braced($, choice($.bind, $._statement))),
    where_expression: ($) =>
      seq(
        "where",
        "(",
        field("subject", $._expression),
        ")",
        braced($, $.where_arm),
      ),
    // export init = extern "madlib__array__initWithCapacity"
    extern_expression: ($) => seq("extern", field("symbol", $.string)),

    // derive Comparable DateTime
    derive_declaration: ($) =>
      seq(
        "derive",
        field("interface", $.type_identifier),
        repeat1(field("argument", $._type_atom)),
      ),

    // test("…", () => …)  at top level, pervasive in .spec.mad
    expression_statement: ($) => $._expression,

    _declaration: ($) =>
      choice(
        $.import_declaration,
        $.type_declaration,
        $.alias_declaration,
        $.interface_declaration,
        $.instance_declaration,
        $.derive_declaration,
        $.type_annotation,
        $.assignment,
        $.export_declaration,
        $.target_block,
        $.expression_statement,
      ),
    export_declaration: ($) =>
      seq(
        "export",
        choice(
          $.assignment,
          $.type_annotation,
          $.type_declaration,
          $.alias_declaration,
          $.interface_declaration,
          $.instance_declaration,
          $.export_type_reference, // export type Comparison
          $.identifier, // export eq / export gt / export le
          $.type_identifier, // export LT / export EQ / export GT
        ),
      ),
    export_type_reference: ($) => seq("type", field("name", $.type_identifier)),

    // ---------- imports ----------
    // import IO from "IO"
    // import { fn } from "./File"
    // import type { Maybe } from "Maybe"

    import_declaration: ($) =>
      seq(
        "import",
        optional("type"),
        field("source", choice($.namespace, $.import_list)),
        "from",
        field("path", $.string),
      ),
    namespace: ($) => $.type_identifier,

    import_list: ($) =>
      seq("{", commaList(choice($.identifier, $.type_identifier)), "}"),

    // ---------- shared pieces ----------
    type_parameters: ($) => repeat1(field("parameter", $.identifier)),

    // Constraints reuse `type_application` -- byte-identical productions, so
    // keeping a separate `constraint` rule would only cost GLR splits.
    // The `constraints` field on the parent preserves the distinction.
    type_constraints: ($) =>
      seq(
        choice(
          $.type_application,
          seq("(", commaSep($.type_application), optional(","), ")"),
        ),
        "=>",
      ),

    // ---------- ADTs ----------
    // type Color = Hex(String) | RGB(Integer, Integer, Integer)
    type_declaration: ($) =>
      seq(
        "type",
        field("name", $.type_identifier),
        optional(field("parameters", $.type_parameters)),
        "=",
        pipeSep($.constructor),
      ),
    constructor: ($) =>
      seq(
        field("name", $.type_identifier),
        optional(seq("(", commaList($._type), ")")),
      ),

    // ---------- records / aliases ----------
    // alias CoolRec = { j :: Boolean, ...Other }
    alias_declaration: ($) =>
      seq(
        "alias",
        field("name", $.type_identifier),
        optional(field("parameters", $.type_parameters)),
        "=",
        field("body", $._type),
      ),

    // Only one spread is legal -- enforce in a lint, not the grammar.
    type_spread: ($) => seq("...", $.type_identifier),

    // ---------- interfaces ----------
    interface_declaration: ($) =>
      seq(
        "interface",
        optional(field("constraints", $.type_constraints)),
        field("name", $.type_identifier),
        optional(field("parameters", $.type_parameters)),
        field("body", $.interface_body),
      ),

    instance_declaration: ($) =>
      seq(
        "instance",
        optional(field("constraints", $.type_constraints)),
        field("name", $.type_identifier),
        repeat(field("argument", $._type_atom)),
        field("body", $.instance_body),
      ),

    // ---------- signatures ----------
    // modX :: (a -> a) -> Maybe x -> Maybe x

    type_annotation: ($) =>
      seq(
        field("name", choice($.identifier, $.type_identifier)),
        "::",
        optional(field("constraints", $.type_constraints)),
        field("type", $._type),
      ),

    _type: ($) => choice($.function_type, $.type_application, $._type_atom),
    function_type: ($) =>
      seq(
        field("from", choice($.type_application, $._type_atom)),
        optional($._newlines),
        "->",
        field("to", $._type),
      ),

    type_application: ($) =>
      prec.left(
        seq(
          field("name", choice($.type_identifier, $.identifier)),
          repeat1(field("argument", $._type_atom)),
        ),
      ),

    qualified_type: ($) =>
      seq(
        field("module", $.type_identifier),
        token.immediate("."),
        field("name", $.type_identifier),
      ),

    _type_atom: ($) =>
      choice(
        $.type_identifier,
        $.qualified_type, // <-- add
        $.identifier,
        $.record_type,
        $.tuple_type,
        $.parenthesized_type,
      ),
    parenthesized_type: ($) => seq("(", $._type, ")"),

    // ---------- bindings ----------

    assignment: ($) =>
      seq(
        field("name", choice($.identifier, $.type_identifier)),
        "=",
        field("value", $._expression),
      ),

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
        $.identifier,
        $.type_identifier,
        $.placeholder,
        $.parenthesized_expression,
        $.extern_expression,
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
    parameters: ($) => seq("(", commaList($._pattern), ")"),

    _statement: ($) =>
      choice(
        $.assignment,
        $.mutation,
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
          commaList($._expression),
          ")",
        ),
      ),
    placeholder: (_) => "$", // division($, 5)

    if_expression: ($) =>
      prec.right(
        seq(
          "if",
          "(",
          field("condition", $._expression),
          ")",
          field("consequence", choice($.block, $._expression)),
          optional(
            seq("else", field("alternative", choice($.block, $._expression))),
          ),
        ),
      ),
    ternary_expression: ($) =>
      prec.right(
        PREC.ternary,
        seq(
          field("condition", $._expression),
          "?",
          field("consequence", $._expression),
          ":",
          field("alternative", $._expression),
        ),
      ),

    where_arm: ($) =>
      seq(
        field("pattern", $._pattern),
        "=>",
        field("body", choice($.block, $._expression)),
      ),

    // do { _ <- Test.assertEquals(a, b) \n return {} }
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
      prec(
        PREC.unary,
        seq(
          field("operator", choice("!", "-")),
          field("argument", $._expression),
        ),
      ),
    mutation: ($) =>
      seq(
        field("name", choice($.identifier, $.type_identifier)),
        ":=",
        field("value", $._expression),
      ),

    // person.name   vs.   pipe(.name, String.toLower)
    // The access dot is `token.immediate` so it cannot follow whitespace;
    // that is what keeps it distinct from the shorthand.

    access: ($) =>
      prec(
        PREC.access,
        seq(
          $._expression,
          token.immediate("."),
          field("field", choice($.identifier, $.type_identifier)),
        ),
      ),
    access_shorthand: ($) =>
      seq(".", field("field", choice($.identifier, $.type_identifier))),

    // `{}` is covered here rather than by a separate `unit` rule -- a dedicated
    // token would win the longest-match race and break every empty record/block.

    record: ($) =>
      prec.dynamic(
        -1,
        seq("{", commaList(choice($.field, $.spread, $.identifier)), "}"),
      ),
    record_type: ($) =>
      seq("{", commaList(choice($.type_annotation, $.type_spread)), "}"),
    record_pattern: ($) =>
      seq(
        "{",
        commaList(choice($.field_pattern, $.identifier, $.spread_pattern)),
        "}",
      ),

    field: ($) =>
      seq(field("name", $.identifier), ":", field("value", $._expression)),
    spread: ($) => seq("...", $._expression),

    tuple: ($) => seq("#[", commaList($._expression), "]"),
    tuple_type: ($) => seq("#[", commaList($._type), "]"),
    tuple_pattern: ($) => seq("#[", commaList($._pattern), "]"),

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
      seq(field("name", $.type_identifier), "(", commaList($._pattern), ")"),

    field_pattern: ($) =>
      seq(field("name", $.identifier), ":", field("pattern", $._pattern)),
    spread_pattern: ($) => seq("...", $._pattern),
    list: ($) => seq("[", commaList(choice($._expression, $.spread)), "]"),
    list_pattern: ($) =>
      seq("[", commaList(choice($._pattern, $.spread_pattern)), "]"),

    // ---------- FFI ----------

    target_block: ($) =>
      seq(
        "#iftarget",
        field("target", $.identifier),
        optional($._newlines),
        repeat(seq($._declaration, optional($._newlines))),
        repeat($.target_alternative),
        optional($.target_else),
        "#endif",
      ),

    target_alternative: ($) =>
      seq(
        "#elseif",
        field("target", $.identifier),
        optional($._newlines),
        repeat(seq($._declaration, optional($._newlines))),
      ),

    target_else: ($) =>
      seq(
        "#else",
        optional($._newlines),
        repeat(seq($._declaration, optional($._newlines))),
      ),
    foreign_fence: (_) => token(seq("#-", /[^-]*(-[^#][^-]*)*/, "-#")),

    // ---------- lexical ----------
    identifier: (_) => /[a-z_]\w*/,
    type_identifier: (_) => /[A-Z]\w*/,
    number: (_) => /-?\d+(\.\d+)?([eE][+-]?\d+)?/,
    boolean: (_) => choice("true", "false"),
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
