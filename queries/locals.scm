; scopes
[
  (source_file)
  (abstraction)
  (block)
  (where_arm)
  (do_expression)
] @local.scope

; definitions
(assignment name: (identifier) @local.definition.var)
(bind name: (identifier) @local.definition.var)
(parameters (identifier) @local.definition.parameter)
(parameters (record_pattern (identifier) @local.definition.parameter))
(parameters (tuple_pattern (identifier) @local.definition.parameter))
(field_pattern pattern: (identifier) @local.definition.parameter)
(record_pattern (identifier) @local.definition.var)
(tuple_pattern (identifier) @local.definition.var)
(where_arm pattern: (identifier) @local.definition.var)
(constructor_pattern (identifier) @local.definition.var)

; references
(identifier) @local.reference
