# action-project-manager

This is a GitHub Action that can be used to manage issues in a project.

## Config properties

- `github-token` - an API token
- `project` - the name of the project to manage
- `ready-labels` - a list of labels that, if at least one of which is added to
  an issue, will cause the issue to move to the todo column
- `take-any-ready` - if true, "ready" issues will be taken from the complete
  pool of issues; by default they will only be pulled from a triage column
- `triage-column` - the name of the column to put non-ready issues into
- `todo-column` - the name of the column to put triaged issues into
- `working-column` - the name of the column to put in-progress (assigned)
  issues into
- `done-column` - the name of the column to put completed issues into

## Management rules

- If a `triage-column` property is provided, new, unassigned issues will be
  added there
- Unassigned issues with at least one of the labels in a `ready-labels`
  property will be moved to `todo-column`
- Newly assigned issues that are in `todo-column` or `triage-column` go to
  `working-column`
- `todo-column` issues that are assigned go to `working-column`
- `working-column` issues that are de-assigned go back to `todo-column`
- Issues that are on the board and are closed go to `done-column`
- Closed issues on the board that are re-opened go back to `working-column`
- Issues in `todo-column` that have all of their ready labels removed will be
  moved back to `triage-column`
- When issues are added to a column, they should be added in priority order,
  with priority-high at the top and priority-low at the bottom.
- Only issues go on the board, not PRs. PRs will be accessible through issue
  links.

## Usage

Feed key issue-related events to the action and it will manage issue placement.

```yaml
# .github/workflows/issue-created.yaml
name: Issue Created

on:
  issues:
    types:
      - assigned
      - unassigned
      - opened
      - closed
      - labeled
      - unlabeled

jobs:
  move-issue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jason0x43/action-project-manager@v0.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          project: Development
          triage-column: Triage
          todo-column: To do
          working-column: In progress
          done-column: Done
```
