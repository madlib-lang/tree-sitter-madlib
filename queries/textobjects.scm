; functions
(assignment
  value: (abstraction body: (_) @function.inner)) @function.outer
(abstraction body: (_) @function.inner) @function.outer

; parameters and call arguments
(parameters (_) @parameter.inner)
(application "(" (_) @parameter.inner)

; calls
(application) @call.outer

; conditionals
(if_expression consequence: (_) @conditional.inner) @conditional.outer
(ternary_expression) @conditional.outer
(where_expression) @conditional.outer
(where_arm body: (_) @conditional.inner)

; blocks and statements
(block) @block.outer
(do_expression) @block.outer
(block (_) @statement.outer)
(return_statement) @return.outer

; type-level definitions
(type_declaration) @class.outer
(alias_declaration) @class.outer
(interface_declaration body: (interface_body) @class.inner) @class.outer
(instance_declaration body: (instance_body) @class.inner) @class.outer

; assignments
(assignment
  name: (_) @assignment.lhs
  value: (_) @assignment.rhs) @assignment.outer
(mutation
  name: (_) @assignment.lhs
  value: (_) @assignment.rhs) @assignment.outer

; comments and literals
(line_comment) @comment.outer
(block_comment) @comment.outer
(number) @number.inner

