; comments
[(line_comment) (block_comment)] @comment

; literals
(string) @string
(template_string) @string
(template_chars) @string
(escape_sequence) @string.escape
(char) @character
(number) @number
(boolean) @boolean
; ["String", "Char", "Number", "Integer", "Float", "Short", "Byte", "Boolean"] @keyword.builtin
(foreign_fence) @string.special
(extern_expression symbol: (string) @string.special)
(interpolation "${" @punctuation.special "}" @punctuation.special)

; keywords
["where" "do" "alias" "interface" "instance" "derive" "extern" "export" "type"] @keyword
["if" "else"] @keyword.conditional
"return" @keyword.return
["import" "from"] @keyword.import
["#iftarget" "#elseif" "#endif"] @keyword.directive

; operators and punctuation
["||" "&&" "??" "==" "!=" "<" "<=" ">" ">=" "++" "+" "-" "*" "/" "%" "!"
 "=" ":=" "::" "=>" "->" "<-" "?" ":" "|" "..."] @operator
["(" ")" "{" "}" "[" "]" "#["] @punctuation.bracket
["," "."] @punctuation.delimiter
(placeholder) @variable.builtin
(wildcard) @variable.builtin

; types (general rule first, specific rules below)
(type_identifier) @type
(type_parameters parameter: (identifier) @type)
(type_application name: (identifier) @type)
(type_application argument: (identifier) @type)
(function_type from: (identifier) @type)
(function_type to: (identifier) @type)
(type_annotation type: (identifier) @type)
(parenthesized_type (identifier) @type)
(tuple_type (identifier) @type)
(alias_declaration body: (identifier) @type)
(qualified_type module: (type_identifier) @module name: (type_identifier) @type)
(namespace (type_identifier) @module)
(namespace (identifier) @module)

; constructors
(constructor name: (type_identifier) @constructor)
(constructor_pattern name: (type_identifier) @constructor)
(where_arm pattern: (type_identifier) @constructor)
(application function: (type_identifier) @constructor)

; modules in expressions: Maybe.fromMaybe, Dict.get
(access . (type_identifier) @module)

; functions
(assignment name: (identifier) @function value: (abstraction))
(type_annotation name: (identifier) @function)
(application function: (identifier) @function.call)
(application function: (access field: (identifier) @function.call))
((application function: (identifier) @function.builtin)
 (#eq? @function.builtin "pipe"))

; names, parameters and fields
(parameters (identifier) @variable.parameter)
(field name: (identifier) @property)
(field_pattern name: (identifier) @property)
(access field: (identifier) @property)
(access_shorthand field: (identifier) @property)
(record_type (type_annotation name: (identifier) @property))
(assignment name: (type_identifier) @constant)

