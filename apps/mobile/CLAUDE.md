@AGENTS.md

## Sheets: alignment

A sheet that only presents information (no inputs, rows, chips or lists)
centres its text and content: title, body, any figure, and full-width
buttons. Examples: the plate sheet, the estimated max and strength level
info sheets, the custom exercise limit sheet, the streak share sheet, and
the progression sheet's first-session heading.

A sheet with inputs, pickers, menus, rows or a list keeps the left edge.
Examples: the custom exercise form, the pickers, the streak sheet (day
row, medal row, panel headers), and the progression sheet's set table.
A sheet that mixes the two keeps the left edge for the rows and may
centre only the heading above them.

Centre with `textAlign: 'center'` on each `Text` (a style named
`centered`) and `alignItems: 'center'` on a body that holds a figure;
give a full-width button `alignSelf: 'stretch'` inside a centred body.
