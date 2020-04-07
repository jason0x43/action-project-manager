/**
 * Actions
 *
 * - New issues will have the "triage" label auto-assigned (if one is configured)
 * - Issues with the "triage" label will be added to the Triage column (if one
 *   is configured)
 * - Issues in the triage column will be moved to todo when the triage label is removed
 * - Newly assigned issues that are in todo or triage go to the working column
 * - todo issues that are assigned go to the working column
 * - When a PR is opened that links to an issue, that issue will be moved to
 *   the working column
 * - working issues that are de-assigned go back to todo
 * - Issues that are on the board and are closed go to done
 * - Closed issues on the board that are re-opened go back to working
 * - When issues are added to a column, they should be added in priority order,
 *   with priority-high at the top and priority-low at the bottom.
 * - Only issues go on the board, not PRs. PRs will be accessible through issue
 *   links.
 */
import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/action';
import * as Webhooks from '@octokit/webhooks';

// let columns: Octokit.ProjectsListColumnsResponseItem[];
// let projects: Octokit.ProjectsListForRepoResponseItem[];
// let octokit: Octokit;

enum Action {
  PrOpened = 1,
  IssueOpened,
  IssueAssignment,
  IssueClosed,
  IssueReopened,
  IssueLabeling
}

// async function getColumn(projectId: number, name: string) {
//   if (!columns) {
//     // Find the column specified by the user
//     columns = await octokit.paginate(
//       octokit.projects.listColumns.endpoint.merge({
//         project_id: projectId
//       })
//     );
//   }

//   return columns.find(
//     col => col.name.toLowerCase() === name.toLowerCase()
//   );
// }

// async function getProject(name: string, owner: string, repo: string) {
//   if (!projects) {
//     // Find the project specified by the user
//     projects = await octokit.paginate(
//       octokit.projects.listForRepo.endpoint.merge({ owner, repo }));
//   }
//   return projects.find(
//     proj => proj.name.toLowerCase() === name.toLowerCase()
//   );
// }

async function main() {
  const event = github.context.eventName;
  let action: Action;

  if (event === 'issues') {
    const payload = github.context.payload as Webhooks.WebhookPayloadIssues;
    switch (payload.action) {
      case 'opened':
        action = Action.IssueOpened;
        break;
      case 'closed':
        action = Action.IssueClosed;
        break;
      case 'reopened':
        action = Action.IssueReopened;
        break;
      case 'assigned':
      case 'unassigned':
        action = Action.IssueAssignment;
        break;
      case 'labeled':
      case 'unlabeled':
        action = Action.IssueLabeling;
        break;
    }
    core.info(`Handling ${payload.action} for issue ${payload.issue.number}`);
  } else if (event === 'pull_request') {
    const payload = github.context.payload as Webhooks.WebhookPayloadPullRequest;
    switch (payload.action) {
      case 'opened':
        action = Action.PrOpened;
        break;
    }
    core.info(`Handling ${payload.action} for issue ${payload.pull_request.number}`);
  }

  const { owner, repo } = github.context.issue;

  if (!action) {
    core.info(`Skipping event ${event}`);
    return;
  }

  const projectName = core.getInput('project');
  // Column for new issues
  const triageColumnName = core.getInput('triage-column');
  // Label that will be applied to triage issues
  const triageLabel = core.getInput('triage-label');
  // Column for "ready" issues
  const todoColumnName = core.getInput('todo-column');
  // Column for "in-progress" issues
  const workingColumnName = core.getInput('working-column');
  // Column for completed issues
  const doneColumnName = core.getInput('done-column');
  const takeAnyReady = core.getInput('take-any-ready');

  // This will automatically authenticate with a GITHUB_TOKEN value provided
  // via `with` or `env`
  const octokit = new Octokit;

  switch (action) {
    case Action.IssueOpened:
      break;
    case Action.IssueClosed:
      break;
    case Action.IssueReopened:
      break;
    case Action.IssueAssignment:
      break;
    case Action.IssueLabeling:
      break;
    case Action.PrOpened:
      break;
  }

  const project = await octokit.graphql(`
    {
      repository(owner: $owner, name: $repo) {
      }
    }
  `, {
    owner,
    repo
  });
  const column = await getColumn(project.id, columnName);

  // Check for an existing card for the issue
  let existing: { id: number };
  const issueTest = new RegExp(`/issues/${issueInfo.number}$`);
  for (const col of columns) {
    const cards = await octokit.paginate(
      octokit.projects.listCards.endpoint.merge({
        column_id: col.id
      })
    );
    const card = cards.find(card => issueTest.test(card.content_url));
    if (card) {
      existing = card;
      break;
    }
  }

  if (existing) {
    // A card already exists -- move it
    await octokit.projects.moveCard({
      card_id: existing.id,
      column_id: column.id,
      position: 'top'
    });
  } else {
    const issue = (
      await octokit.issues.get({
        owner: issueInfo.owner,
        repo: issueInfo.repo,
        issue_number: issueInfo.number
      })
    ).data;

    // A card doesn't exist -- create it
    await octokit.projects.createCard({
      column_id: column.id,
      content_id: issue.id,
      content_type: 'Issue'
    });
  }
}

main().catch(error => console.error(error));
