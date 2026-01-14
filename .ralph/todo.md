### To do

- [ ] Let's get rid of the static frame and go back to just working normally in the terminal. Put the header in a box, along with the version numbers, and just append events to the bottom. Keep the spinner with "Running iteration N (max X)" at the bottom
- [ ] While it's working, let's allow the user to type ctrl-T to add a new todo

### Done

- [x] Change the default iterations to 30

- [x] In the footer put `@herbcaudill/ralph` before the version
- [x] In the footer say `Running iteration X (max Y)`

- [x] when adding a todo, don't echo the todo text back - just respond "✅ added"
- [x] Support just typing `ralph todo` and then being prompted for the todo
- [x] Remove padding from header
- [x] Preserve iteration event history across multiple iterations
- [x] Fix terminal scrolling by using Static component for content blocks
- [x] Fix LSP server notification error by setting ENABLE_LSP_TOOL=0 environment variable
- [x] Use a nicer selection UI for the yes/no init question
- [x] Put a box around the header
- [x] For the header text, use ink-gradient from #30A6E4 to #EBC635
- [x] In the header show `@herbcaudill/ralph vxxx` on the same line as the claude code version
- [x] Inline code blocks are being put in separate paragraphs
- [x] we're not picking up the Claude Code version - it's showing `Claude Code vunknown`
