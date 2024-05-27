const commaSep1 = (rule) => seq(rule, repeat(seq(",", rule)));

const commaSep = (rule) => optional(commaSep1(rule));

module.exports = grammar({
  name: "madlib",

  externals: ($) => [
    $._template_chars,
    $._ternary_qmark,
    "||",
    // We use escape sequence and regex pattern to tell the scanner if we're currently inside a string or template string, in which case
    // it should NOT parse html comments.
    $.escape_sequence,
  ],

  extras: ($) => [
    $.comment,
    // ???
    ///[\s\p{Zs}\uFEFF\u2028\u2029\u2060\u200B]/,
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
    //$._identifier,
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
      "type_union",
      "unary_void",
      "binary_exp",
      "binary_times",
      "binary_concat",
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
    ["member", "call", $.expression],
    ["declaration", "literal"],
    [$.primary_expression, $.statement_block, "record"],
    [$.import_statement, $.import],
    [$.export_statement, $.primary_expression],
    [$.lexical_declaration, $.primary_expression],
  ],

  conflicts: ($) => [
    [$.primary_expression, $._property_name],
    [$.primary_expression, $._property_name, $.arrow_function],
    [$.primary_expression, $.arrow_function],
    [$.primary_expression, $.rest_pattern],
    [$.primary_expression, $.pattern],
    [$.list, $.list_pattern],
    [$.record, $.record_pattern],
    [$.assignment_expression, $.pattern],
    [$.assignment_expression, $.record_assignment_pattern],
    [$.binary_expression, $._initializer],
  ],

  word: ($) => $.identifier,

  rules: {
    program: ($) => repeat($.statement),

    //
    // Export declarations
    //

    export_statement: ($) =>
      choice(
        seq("export", choice($.export_clause)),
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

    export_specifier: ($) => field("name", $._module_export_name),

    _module_export_name: ($) => choice($.identifier, $.string),

    declaration: ($) => choice($.function_declaration, $.lexical_declaration),

    //
    // Import declarations
    //

    import: (_) => token("import"),

    import_statement: ($) =>
      seq(
        "import",
        choice(seq($.import_clause, $._from_clause), field("source", $.string)),
      ),

    import_clause: ($) =>
      choice(
        $.named_imports,
        seq($.identifier, optional(seq(",", $.named_imports))),
      ),

    _from_clause: ($) => seq("from", field("source", $.string)),

    named_imports: ($) =>
      seq("{", commaSep($.import_specifier), optional(","), "}"),

    import_specifier: ($) =>
      choice(field("name", $.identifier), field("name", $._module_export_name)),

    //
    // Statements
    //

    statement: ($) =>
      choice(
        $.export_statement,
        $.import_statement,
        $.expression_statement,
        $.declaration,
        $.statement_block,

        $.if_statement,
        $.while_statement,
        // $.do_statement,

        $.return_statement,
      ),

    expression_statement: ($) => seq($._expressions),

    lexical_declaration: ($) => $.variable_declarator,

    variable_declarator: ($) =>
      seq(
        field("name", choice($.identifier, $._destructuring_pattern)),
        optional($._initializer),
      ),

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
        $.augmented_assignment_expression,
        $.unary_expression,
        $.binary_expression,
        $.ternary_expression,
      ),

    primary_expression: ($) =>
      choice(
        $.member_expression,
        $.parenthesized_expression,
        //$._identifier,
        alias($._reserved_identifier, $.identifier),
        $.number,
        $.string,
        $.template_string,
        //$.regex,
        $.true,
        $.false,
        $.record,
        $.list,
        $.function_expression,
        $.arrow_function,
        $.meta_property,
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

    function_declaration: ($) =>
      prec.right(
        "declaration",
        seq(
          field("name", $.identifier),
          $._call_signature,
          field("body", $.statement_block),
        ),
      ),

    arrow_function: ($) =>
      seq(
        optional("async"),
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
            field("function", choice($.expression, $.import)),
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
          field("record", choice($.expression, $.primary_expression, $.import)),
          field(
            "property",

            alias($.identifier, $.property_identifier),
          ),
        ),
      ),

    _lhs_expression: ($) =>
      choice(
        $.member_expression,
        //$._identifier,
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
        alias($._reserved_identifier, $.identifier),
        $.identifier,
        $.parenthesized_expression,
      ),

    augmented_assignment_expression: ($) =>
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
          //["&", "bitwise_and"],
          //["^", "bitwise_xor"],
          ["|", "type_union"],
          ["+", "binary_plus"],
          ["-", "binary_plus"],
          ["*", "binary_times"],
          ["/", "binary_times"],
          ["%", "binary_times"],
          ["++", "binary_concat"],
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

    number: (_) => {
      const hexLiteral = seq(choice("0x", "0X"), /[\da-fA-F](_?[\da-fA-F])*/);

      const decimalDigits = /\d(_?\d)*/;
      const signedInteger = seq(optional(choice("-", "+")), decimalDigits);
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
          optional(decimalDigits),
          optional("_s"),
          optional("_i"),
          optional("_b"),
          optional("_f"),
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

    meta_property: (_) => seq("new", ".", "target"),

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

    _reserved_identifier: (_) =>
      choice("type", "alias", "where", "return", "export", "import", "do"),
  },
});
