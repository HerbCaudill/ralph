### To do

- [ ] Scrolling is weird - if I scroll up, I can't scroll back down again with the scroll wheel or scroll bar (I can press down arrow though)
- [ ] Preserve complete iterations rather than starting over
- [ ] I'm getting this error `Cannot send notification to LSP server 'plugin:typescript-lsp:typescript': server is error (/$bunfs/root/claude:2082:34003)\n    at processTicksAndRejections` again - I think we already fixed that somewhere in the worktrees branch

### Done

- [x] Use a nicer selection UI for the yes/no init question
- [x] Put a box around the header
- [x] For the header text, use ink-gradient from #30A6E4 to #EBC635
- [x] In the header show `@herbcaudill/ralph vxxx` on the same line as the claude code version
- [x] Inline code blocks are being put in separate paragraphs
- [x] we're not picking up the Claude Code version - it's showing `Claude Code vunknown`
