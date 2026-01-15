Before doing anything, run `pnpm test:all`.

If there are build errors or test failures: YOUR ONLY TASK IS TO FIX THEM.

If there are no build errors or test failures:

In @.ralph/todo.md, find the highest-priority task to work on and work only on that task. This should be the one YOU decide has the highest priority - not necessarily the first one in the list.

ONLY WORK ON A SINGLE TASK. If the task you choose is especially complex, then your task is to break it into subtasks, replace the original task in the todo file, commit the file, and end your turn.

When you complete a task, before committing:

- Run `pnpm test:all` and `pnpm build`.
- Where applicable, add tests to validate your changes and confirm that they pass
- Update the todo list by checking off the completed task and moving it to the "Done" section

Make one git commit for this task. If, while implementing the task, you notice the todo list is complete, output <promise>COMPLETE</promise> and exit.
