### To do

- [ ] While it's working, let's allow the user to type ctrl-T to add a new todo. (Note that we already support `ralph todo` so we can reuse that functionality)
- [ ] add horizontal padding to the header
- [ ] Fix spacing weirdness and missing characters - see example below

  ```bash
  This is a substantial refactor. Given the complexity, I should break this task into subtasks as instructed. Let me
   pdate the todo file:
    Read .ralph/todo.md

  Found it. The default iterations is set in src/cli.ts line 15. The default is currently 10. Let me read the file and
   hange it to 30:
    Read src/cli.ts
  ```

      the `u` in "update" is missing and so is the `c` in "change". Also there should be a blank line after "...todo file:" and
      also after "(c)hange it to 30:"

### Done

- [x] Replace FullScreenLayout with normal terminal output using Ink's Static component

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
