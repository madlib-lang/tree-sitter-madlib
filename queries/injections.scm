((foreign_fence) @injection.content
  (#set! injection.language "javascript")
  (#offset! @injection.content 0 2 0 -2))

; optional: needs the `comment` parser installed
; ((line_comment) @injection.content (#set! injection.language "comment"))

