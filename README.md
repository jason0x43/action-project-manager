# action-project-manager

This is relativley simple a GitHub Action that can be used to manage issues in a project.

## Usage

This action is meant to be a building block for more complex behaviors. The basic idea is that when some issue-related event happens, this action can be used to move the affcted issue to a particular column in a project.

```yaml
# .github/workflows/issue-created.yaml
name: Issue Created

on:
  issues:
    types: [opened]

jobs:
  move-issue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jason0x43/action-project-manager@v0.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          project: Development
          column: Done
```

```yaml
# .github/workflows/issue-assigned.yaml
name: Issue Assigned

on:
  issues:
    types: [assigned]

jobs:
  move-issue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jason0x43/action-project-manager@v0.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          project: Development
          column: In progress
```

```yaml
# .github/workflows/issue-completed.yaml
name: Issue Completed

on:
  issues:
    types: [closed]

jobs:
  move-issue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jason0x43/action-project-manager@v0.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          project: Development
          column: Done
```
