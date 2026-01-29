# Unit Test Suite Review

## Goal

Assess the unit test suite for necessity and usefulness, and produce a prioritized set of recommendations for keeping, refactoring, consolidating, or removing tests.

## Approach

Inventory tests across packages, classify by target and value (behavioral coverage vs. implementation detail), measure redundancy (overlapping assertions/fixtures), and identify gaps vs. critical workflows. Use lightweight metrics (test count by area, runtime hot spots, flaky/slow tests) to guide which tests to review deeply. Deliver a report with concrete candidates and rationale before changing tests.

## Tasks

1. Inventory unit tests by package, folder, and subject under test.
2. Gather suite metadata (runtime, slow tests, most common fixtures, duplicate helpers).
3. Sample and classify tests by value: core behavior, regression guard, implementation detail, or redundant.
4. Map tests to critical workflows/features and identify gaps or over-coverage.
5. Produce a recommendation report with keep/refactor/remove buckets and quick wins.

## Unresolved Questions

None.
