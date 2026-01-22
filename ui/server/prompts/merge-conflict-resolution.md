# Merge Conflict Resolution Instructions

When a merge conflict occurs between your worktree branch and the main branch, you need to resolve it before your work can be integrated. This document provides instructions for resolving merge conflicts.

## Understanding the Conflict

A merge conflict happens when both the main branch and your worktree branch have made changes to the same lines in the same file. Git cannot automatically determine which version to keep.

The conflicted files will contain conflict markers like:

```
<<<<<<< HEAD
Content from the main branch
=======
Content from your worktree branch
>>>>>>> ralph/instance-name
```

## Resolution Strategies

### Strategy 1: Keep Your Version ("theirs")

If your changes should take precedence:

1. Examine the conflicted file to understand the differences
2. Your version (after `=======` and before `>>>>>>>`) represents your work
3. If your version is correct, the conflict can be resolved by keeping "theirs"

### Strategy 2: Keep Main's Version ("ours")

If the main branch changes should take precedence:

1. Examine the conflicted file to understand the differences
2. Main's version (after `<<<<<<<` and before `=======`) represents the existing code
3. If main's version is correct, the conflict can be resolved by keeping "ours"

### Strategy 3: Manual Merge (Recommended for Complex Conflicts)

When both versions contain important changes:

1. Examine the conflicted file carefully
2. Remove the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Edit the file to combine both sets of changes appropriately
4. Ensure the merged code is syntactically correct and logically sound
5. Test the merged changes if possible

## Step-by-Step Resolution Process

1. **Identify conflicted files**: Check which files have conflicts
2. **Review each conflict**: Read both versions to understand what changed
3. **Decide on resolution strategy**:
   - Simple conflicts (one version is clearly better): Use "ours" or "theirs"
   - Complex conflicts (both have important changes): Manual merge
4. **Apply the resolution**: Edit the file or use resolution commands
5. **Mark as resolved**: Stage the resolved file
6. **Complete the merge**: Commit the resolution

## Best Practices

- **Read before resolving**: Always understand both versions before resolving
- **Test after resolving**: If possible, verify the merged code works correctly
- **Preserve intent**: When manually merging, ensure both sets of changes achieve their intended purpose
- **Document changes**: If making significant changes during resolution, note what was done
- **When in doubt, ask**: If unsure about the correct resolution, seek clarification

## Common Scenarios

### Test File Conflicts

If conflicts occur in test files, ensure:

- All relevant tests from both versions are preserved
- Test descriptions don't conflict
- No duplicate test cases exist

### Configuration File Conflicts

For config files (package.json, tsconfig.json, etc.):

- Merge all configuration options from both versions
- Watch for version number conflicts
- Ensure JSON/YAML syntax remains valid

### Documentation Conflicts

For markdown or documentation files:

- Preserve information from both versions
- Ensure the final document flows logically
- Remove redundant sections

## After Resolution

Once all conflicts are resolved:

1. Verify no conflict markers remain in any file
2. The merge can be completed
3. The worktree can be rebased on the updated main branch
