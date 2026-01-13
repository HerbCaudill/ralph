### To do

- [ ] The output should show each iteration followed by its events. Currently each new iteration replaces the previous one.
- [ ] Remove excessive white space from header

### Done

- [x] Fix terminal scrolling by using Static component for content blocks
- [x] Fix LSP server notification error by setting ENABLE_LSP_TOOL=0 environment variable

- [x] Use a nicer selection UI for the yes/no init question
- [x] Put a box around the header
- [x] For the header text, use ink-gradient from #30A6E4 to #EBC635
- [x] In the header show `@herbcaudill/ralph vxxx` on the same line as the claude code version
- [x] Inline code blocks are being put in separate paragraphs
- [x] we're not picking up the Claude Code version - it's showing `Claude Code vunknown`
