/**
 * @file Madlib grammar for tree-sitter
 * @author Brekk Bockrath <brekk@brekkbockrath.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "madlib",

  externals: ($) => [
    $._template_chars,
    $._ternary_qmark,
    $.html_comment,
    "||",
    // We use escape sequence and regex pattern to tell the scanner if we're currently inside a string or template string, in which case
    // it should NOT parse html comments.
    $.escape_sequence,
    $.regex_pattern,
  ],

  extras: ($) => [
    $.comment,
    $.html_comment,
    /[\s\p{Zs}\uFEFF\u2028\u2029\u2060\u200B]/,
  ],

  supertypes: ($) => [
    $.statement,
    $.declaration,
    $.expression,
    $.primary_expression,
    $.pattern,
  ],

  inline: ($) => [
    $._call_signature,
    $._formal_parameter,
    $._expressions,
    $._reserved_identifier,
    $._jsx_attribute,
    $._jsx_element_name,
    $._jsx_child,
    $._jsx_element,
    $._jsx_attribute_name,
    $._jsx_attribute_value,
    $._jsx_identifier,
    $._lhs_expression,
  ],

  precedences: ($) => [
    [
      "member",
      "call",
      "unary_void",
      "binary_exp",
      "binary_times",
      "binary_plus",
      "binary_shift",
      "binary_compare",
      "binary_relation",
      "binary_equality",
      "bitwise_and",
      "bitwise_xor",
      "bitwise_or",
      "logical_and",
      "logical_or",
      "ternary",
      $.sequence_expression,
      $.arrow_function,
    ],
    ["assign", $.primary_expression],
    ["member", "new", "call", $.expression],
    ["declaration", "literal"],
    [$.primary_expression, $.statement_block, "record"],
    [$.export_statement, $.primary_expression],
    [$.import_statement, $.primary_expression],
  ],

  conflicts: ($) => [
    [$.primary_expression, $._property_name],
    [$.primary_expression, $._property_name, $.arrow_function],
    [$.primary_expression, $.arrow_function],
    [$.primary_expression, $.method_definition],
    [$.primary_expression, $.rest_pattern],
    [$.primary_expression, $.pattern],
    [$.primary_expression, $.function_expression],
    [$.primary_expression, $.variable_declarator],
    [$.statement, $.sequence_expression],
    [$.primary_expression, $.variable_declarator, $.function_expression],
    [$.list, $.list_pattern],
    [$.record, $.record_pattern],
    [$.assignment_expression, $.pattern],
    [$.assignment_expression, $.record_assignment_pattern],
    [$.binary_expression, $._initializer],
    [$.return_statement],
  ],

  word: ($) => $.identifier,

  rules: {
    program: ($) => seq(repeat($.statement)),

    //
    // Export declarations
    //

    export_statement: ($) =>
      choice(
        seq(
          "export",
          choice(
            seq("*", $._from_clause),
            seq($.export_clause, $._from_clause),
            $.export_clause,
          ),
        ),
        seq(
          "export",
          choice(
            field("declaration", $.declaration),
            seq(
              "default",
              choice(
                field("declaration", $.declaration),
                field("value", $.expression),
              ),
            ),
          ),
        ),
      ),

    export_clause: ($) =>
      seq("{", commaSep($.export_specifier), optional(","), "}"),

    export_specifier: ($) =>
      seq(
        field("name", $._module_export_name),
        optional(seq("as", field("alias", $._module_export_name))),
      ),

    _module_export_name: ($) => choice($.identifier, $.string),

    declaration: ($) => $.variable_declarator,

    //
    // Import declarations
    //

    //import: (_) => token("import"),

    import_statement: ($) => seq("import", $.import_clause, $._from_clause),

    import_clause: ($) =>
      choice(
        $.named_imports,
        seq($.identifier, optional(seq(",", $.named_imports))),
      ),

    _from_clause: ($) => seq("from", field("source", $.string)),

    named_imports: ($) =>
      seq("{", commaSep($.import_specifier), optional(","), "}"),

    import_specifier: ($) => field("name", $.identifier),

    //
    // Statements
    //

    statement: ($) =>
      choice(
        $.export_statement,
        $.import_statement,
        $._expressions,
        $.declaration,
        $.statement_block,

        $.if_statement,
        $.while_statement,
        //$.do_statement,

        $.return_statement,
      ),

    //variable_declaration: ($) => seq("var", commaSep1($.variable_declarator)),

    variable_declarator: ($) =>
      seq(field("name", $.identifier), optional($._initializer)),

    statement_block: ($) => prec.right(seq("{", repeat($.statement), "}")),

    else_clause: ($) => seq("else", $.statement),

    if_statement: ($) =>
      prec.right(
        seq(
          "if",
          field("condition", $.parenthesized_expression),
          field("consequence", $.statement),
          optional(field("alternative", $.else_clause)),
        ),
      ),

    while_statement: ($) =>
      seq(
        "while",
        field("condition", $.parenthesized_expression),
        field("body", $.statement),
      ),

    //do_statement: ($) =>
    //  prec.right(
    //    seq(
    //      "do",
    //      field("body", $.statement),
    //      "while",
    //      field("condition", $.parenthesized_expression),
    //    ),
    //  ),

    return_statement: ($) => seq("return", optional($._expressions)),

    //
    // Statement components
    //

    parenthesized_expression: ($) => seq("(", $._expressions, ")"),

    //
    // Expressions
    //
    _expressions: ($) => choice($.expression, $.sequence_expression),

    expression: ($) =>
      choice(
        $.primary_expression,
        $._jsx_element,
        $.assignment_expression,
        $.explicit_mutation_operator,
        $.unary_expression,
        $.binary_expression,
        $.ternary_expression,
      ),

    primary_expression: ($) =>
      choice(
        $.subscript_expression,
        $.member_expression,
        $.parenthesized_expression,
        $.identifier,
        alias($._reserved_identifier, $.identifier),
        $.number,
        $.string,
        $.template_string,
        $.regex,
        $.true,
        $.false,
        $.record,
        $.list,
        $.function_expression,
        $.arrow_function,
        $.call_expression,
      ),

    record: ($) =>
      prec(
        "record",
        seq(
          "{",
          commaSep(
            optional(
              choice(
                $.pair,
                $.spread_element,
                $.method_definition,
                alias(
                  choice($.identifier, $._reserved_identifier),
                  $.shorthand_property_identifier,
                ),
              ),
            ),
          ),
          "}",
        ),
      ),

    record_pattern: ($) =>
      prec(
        "record",
        seq(
          "{",
          commaSep(
            optional(
              choice(
                $.pair_pattern,
                $.rest_pattern,
                $.record_assignment_pattern,
                alias(
                  choice($.identifier, $._reserved_identifier),
                  $.shorthand_property_identifier_pattern,
                ),
              ),
            ),
          ),
          "}",
        ),
      ),

    assignment_pattern: ($) =>
      seq(field("left", $.pattern), "=", field("right", $.expression)),

    record_assignment_pattern: ($) =>
      seq(
        field(
          "left",
          choice(
            alias(
              choice($._reserved_identifier, $.identifier),
              $.shorthand_property_identifier_pattern,
            ),
            $._destructuring_pattern,
          ),
        ),
        "=",
        field("right", $.expression),
      ),

    list: ($) =>
      seq("[", commaSep(optional(choice($.expression, $.spread_element))), "]"),

    list_pattern: ($) =>
      seq(
        "[",
        commaSep(optional(choice($.pattern, $.assignment_pattern))),
        "]",
      ),

    _jsx_element: ($) => choice($.jsx_element, $.jsx_self_closing_element),

    jsx_element: ($) =>
      seq(
        field("open_tag", $.jsx_opening_element),
        repeat($._jsx_child),
        field("close_tag", $.jsx_closing_element),
      ),

    // Should not contain new lines and should not start or end with a space
    jsx_text: (_) =>
      choice(/[^{}<>\n& ]([^{}<>\n&]*[^{}<>\n& ])?/, /\/\/[^\n]*/),

    // An entity can be named, numeric (decimal), or numeric (hexadecimal). The
    // longest entity name is 29 characters long, and the HTML spec says that
    // no more will ever be added.
    html_character_reference: (_) =>
      /&(#([xX][0-9a-fA-F]{1,6}|[0-9]{1,5})|[A-Za-z]{1,30});/,

    jsx_expression: ($) =>
      seq(
        "{",
        optional(choice($.expression, $.sequence_expression, $.spread_element)),
        "}",
      ),

    _jsx_child: ($) =>
      choice(
        $.jsx_text,
        $.html_character_reference,
        $._jsx_element,
        $.jsx_expression,
      ),

    jsx_opening_element: ($) =>
      prec.dynamic(
        -1,
        seq(
          "<",
          optional(
            seq(
              field("name", $._jsx_element_name),
              repeat(field("attribute", $._jsx_attribute)),
            ),
          ),
          ">",
        ),
      ),

    jsx_identifier: (_) => /[a-zA-Z_$][a-zA-Z\d_$]*-[a-zA-Z\d_$\-]*/,

    _jsx_identifier: ($) =>
      choice(alias($.jsx_identifier, $.identifier), $.identifier),

    nested_identifier: ($) =>
      prec(
        "member",
        seq(
          field(
            "record",
            choice(
              $.identifier,
              alias($.nested_identifier, $.member_expression),
            ),
          ),
          ".",
          field("property", alias($.identifier, $.property_identifier)),
        ),
      ),

    jsx_namespace_name: ($) => seq($._jsx_identifier, ":", $._jsx_identifier),

    _jsx_element_name: ($) =>
      choice(
        $._jsx_identifier,
        alias($.nested_identifier, $.member_expression),
        $.jsx_namespace_name,
      ),

    jsx_closing_element: ($) =>
      seq("</", optional(field("name", $._jsx_element_name)), ">"),

    jsx_self_closing_element: ($) =>
      seq(
        "<",
        field("name", $._jsx_element_name),
        repeat(field("attribute", $._jsx_attribute)),
        "/>",
      ),

    _jsx_attribute: ($) => choice($.jsx_attribute, $.jsx_expression),

    _jsx_attribute_name: ($) =>
      choice(
        alias($._jsx_identifier, $.property_identifier),
        $.jsx_namespace_name,
      ),

    jsx_attribute: ($) =>
      seq($._jsx_attribute_name, optional(seq("=", $._jsx_attribute_value))),

    _jsx_string: ($) =>
      choice(
        seq(
          '"',
          repeat(
            choice(
              alias($.unescaped_double_jsx_string_fragment, $.string_fragment),
              $.html_character_reference,
            ),
          ),
          '"',
        ),
        seq(
          "'",
          repeat(
            choice(
              alias($.unescaped_single_jsx_string_fragment, $.string_fragment),
              $.html_character_reference,
            ),
          ),
          "'",
        ),
      ),

    // Workaround to https://github.com/tree-sitter/tree-sitter/issues/1156
    // We give names to the token() constructs containing a regexp
    // so as to obtain a node in the CST.
    //
    unescaped_double_jsx_string_fragment: (_) =>
      token.immediate(prec(1, /([^"&]|&[^#A-Za-z])+/)),

    // same here
    unescaped_single_jsx_string_fragment: (_) =>
      token.immediate(prec(1, /([^'&]|&[^#A-Za-z])+/)),

    _jsx_attribute_value: ($) =>
      choice(alias($._jsx_string, $.string), $.jsx_expression, $._jsx_element),

    function_expression: ($) =>
      prec(
        "literal",
        seq(
          field("name", optional($.identifier)),
          $._call_signature,
          field("body", $.statement_block),
        ),
      ),

    arrow_function: ($) =>
      seq(
        choice(
          field(
            "parameter",
            choice(alias($._reserved_identifier, $.identifier), $.identifier),
          ),
          $._call_signature,
        ),
        "=>",
        field("body", choice($.expression, $.statement_block)),
      ),

    // Override
    _call_signature: ($) => field("parameters", $.formal_parameters),
    _formal_parameter: ($) => choice($.pattern, $.assignment_pattern),

    call_expression: ($) =>
      choice(
        prec(
          "call",
          seq(
            field("function", $.expression),
            field("arguments", choice($.arguments, $.template_string)),
          ),
        ),
        prec(
          "member",
          seq(
            field("function", $.primary_expression),
            field("arguments", $.arguments),
          ),
        ),
      ),

    member_expression: ($) =>
      prec(
        "member",
        seq(
          field("record", choice($.expression, $.primary_expression)),
          ".",
          field("property", alias($.identifier, $.property_identifier)),
        ),
      ),

    subscript_expression: ($) =>
      prec.right(
        "member",
        seq(
          field("record", choice($.expression, $.primary_expression)),
          "[",
          field("index", $._expressions),
          "]",
        ),
      ),

    _lhs_expression: ($) =>
      choice(
        $.member_expression,
        $.subscript_expression,
        alias($._reserved_identifier, $.identifier),
        $._destructuring_pattern,
      ),

    assignment_expression: ($) =>
      prec.right(
        "assign",
        seq(
          field("left", choice($.parenthesized_expression, $._lhs_expression)),
          "=",
          field("right", $.expression),
        ),
      ),

    _augmented_assignment_lhs: ($) =>
      choice(
        $.member_expression,
        $.subscript_expression,
        alias($._reserved_identifier, $.identifier),
        $.identifier,
        $.parenthesized_expression,
      ),

    explicit_mutation_operator: ($) =>
      prec.right(
        "assign",
        seq(
          field("left", $._augmented_assignment_lhs),
          field("operator", ":="),
          field("right", $.expression),
        ),
      ),

    _initializer: ($) => seq("=", field("value", $.expression)),

    _destructuring_pattern: ($) => choice($.record_pattern, $.list_pattern),

    spread_element: ($) => seq("...", $.expression),

    ternary_expression: ($) =>
      prec.right(
        "ternary",
        seq(
          field("condition", $.expression),
          alias($._ternary_qmark, "?"),
          field("consequence", $.expression),
          ":",
          field("alternative", $.expression),
        ),
      ),

    binary_expression: ($) =>
      choice(
        ...[
          ["&&", "logical_and"],
          ["||", "logical_or"],
          [">>", "binary_shift"],
          [">>>", "binary_shift"],
          ["<<", "binary_shift"],
          ["&", "bitwise_and"],
          ["^", "bitwise_xor"],
          ["|", "bitwise_or"],
          ["+", "binary_plus"],
          ["-", "binary_plus"],
          ["*", "binary_times"],
          ["/", "binary_times"],
          ["%", "binary_times"],
          ["**", "binary_exp", "right"],
          ["<", "binary_relation"],
          ["<=", "binary_relation"],
          ["==", "binary_equality"],
          ["!=", "binary_equality"],
          [">=", "binary_relation"],
          [">", "binary_relation"],
        ].map(([operator, precedence, associativity]) =>
          (associativity === "right" ? prec.right : prec.left)(
            precedence,
            seq(
              field("left", $.expression),
              field("operator", operator),
              field("right", $.expression),
            ),
          ),
        ),
      ),

    unary_expression: ($) =>
      prec.left(
        "unary_void",
        seq(
          field("operator", choice("!", "-")),
          field("argument", $.expression),
        ),
      ),

    sequence_expression: ($) => prec.right(commaSep1($.expression)),

    //
    // Primitives
    //

    string: ($) =>
      choice(
        seq(
          '"',
          repeat(
            choice(
              alias($.unescaped_double_string_fragment, $.string_fragment),
              $.escape_sequence,
            ),
          ),
          '"',
        ),
        seq(
          "'",
          repeat(
            choice(
              alias($.unescaped_single_string_fragment, $.string_fragment),
              $.escape_sequence,
            ),
          ),
          "'",
        ),
      ),

    // Workaround to https://github.com/tree-sitter/tree-sitter/issues/1156
    // We give names to the token() constructs containing a regexp
    // so as to obtain a node in the CST.
    //
    unescaped_double_string_fragment: (_) =>
      token.immediate(prec(1, /[^"\\\r\n]+/)),

    // same here
    unescaped_single_string_fragment: (_) =>
      token.immediate(prec(1, /[^'\\\r\n]+/)),

    escape_sequence: (_) =>
      token.immediate(
        seq(
          "\\",
          choice(
            /[^xu0-7]/,
            /[0-7]{1,3}/,
            /x[0-9a-fA-F]{2}/,
            /u[0-9a-fA-F]{4}/,
            /u\{[0-9a-fA-F]+\}/,
            /[\r?][\n\u2028\u2029]/,
          ),
        ),
      ),

    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    comment: (_) =>
      choice(
        token(
          choice(
            seq("//", /[^\r\n\u2028\u2029]*/),
            seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
          ),
        ),
      ),

    template_string: ($) =>
      seq(
        "`",
        repeat(
          choice(
            alias($._template_chars, $.string_fragment),
            $.escape_sequence,
            $.template_substitution,
          ),
        ),
        "`",
      ),

    template_substitution: ($) => seq("${", $._expressions, "}"),

    regex: ($) =>
      seq(
        "/",
        field("pattern", $.regex_pattern),
        token.immediate(prec(1, "/")),
        optional(field("flags", $.regex_flags)),
      ),

    regex_pattern: (_) =>
      token.immediate(
        prec(
          -1,
          repeat1(
            choice(
              seq(
                "[",
                repeat(
                  choice(
                    seq("\\", /./), // escaped character
                    /[^\]\n\\]/, // any character besides ']' or '\n'
                  ),
                ),
                "]",
              ), // square-bracket-delimited character class
              seq("\\", /./), // escaped character
              /[^/\\\[\n]/, // any character besides '[', '\', '/', '\n'
            ),
          ),
        ),
      ),

    regex_flags: (_) => token.immediate(/[a-z]+/),

    number: (_) => {
      const hexLiteral = seq(choice("0x", "0X"), /[\da-fA-F](_?[\da-fA-F])*/);

      const decimalDigits = /\d(_?\d)*/;
      const signedInteger = seq(optional("-"), decimalDigits);
      const exponentPart = seq(choice("e", "E"), signedInteger);

      const binaryLiteral = seq(choice("0b", "0B"), /[0-1](_?[0-1])*/);

      const octalLiteral = seq(choice("0o", "0O"), /[0-7](_?[0-7])*/);

      const bigintLiteral = seq(
        choice(hexLiteral, binaryLiteral, octalLiteral, decimalDigits),
        "n",
      );

      const decimalIntegerLiteral = choice(
        "0",
        seq(
          optional("0"),
          /[1-9]/,
          optional(seq(optional("_"), decimalDigits)),
        ),
      );

      const decimalLiteral = choice(
        seq(
          decimalIntegerLiteral,
          ".",
          optional(decimalDigits),
          optional(exponentPart),
        ),
        seq(".", decimalDigits, optional(exponentPart)),
        seq(decimalIntegerLiteral, exponentPart),
        seq(decimalDigits),
      );

      return token(
        choice(
          hexLiteral,
          decimalLiteral,
          binaryLiteral,
          octalLiteral,
          bigintLiteral,
        ),
      );
    },

    identifier: (_) => {
      // eslint-disable-next-line max-len
      const alpha =
        /[^\x00-\x1F\s\p{Zs}0-9:;`"'@#.,|^&<=>+\-*/\\%?!~()\[\]{}\uFEFF\u2060\u200B\u2028\u2029]|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}/;
      // eslint-disable-next-line max-len
      const alphanumeric =
        /[^\x00-\x1F\s\p{Zs}:;`"'@#.,|^&<=>+\-*/\\%?!~()\[\]{}\uFEFF\u2060\u200B\u2028\u2029]|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}/;
      return token(seq(alpha, repeat(alphanumeric)));
    },

    true: (_) => "true",
    false: (_) => "false",
    unit: (_) => "{}",

    //
    // Expression components
    //

    arguments: ($) =>
      seq("(", commaSep(optional(choice($.expression, $.spread_element))), ")"),

    field_definition: ($) =>
      seq(field("property", $._property_name), optional($._initializer)),

    formal_parameters: ($) =>
      seq(
        "(",
        optional(seq(commaSep1($._formal_parameter), optional(","))),
        ")",
      ),

    // This negative dynamic precedence ensures that during error recovery,
    // unfinished constructs are generally treated as literal expressions,
    // not patterns.
    pattern: ($) => prec.dynamic(-1, choice($._lhs_expression, $.rest_pattern)),

    rest_pattern: ($) => prec.right(seq("...", $._lhs_expression)),

    method_definition: ($) =>
      seq(
        field("name", $._property_name),
        field("parameters", $.formal_parameters),
        field("body", $.statement_block),
      ),

    pair: ($) =>
      seq(field("key", $._property_name), ":", field("value", $.expression)),

    pair_pattern: ($) =>
      seq(
        field("key", $._property_name),
        ":",
        field("value", choice($.pattern, $.assignment_pattern)),
      ),

    _property_name: ($) =>
      choice(
        alias(
          choice($.identifier, $._reserved_identifier),
          $.property_identifier,
        ),
        $.string,
        $.number,
      ),

    _reserved_identifier: (_) => choice("export", "import", "where"),
  },
});

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @return {SeqRule}
 *
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @return {ChoiceRule}
 *
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}
