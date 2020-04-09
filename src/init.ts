import { getInput } from '@actions/core';
import { WebhookPayloadIssues, WebhookPayloadPullRequest } from '@octokit/webhooks';
import { Action, ActionType, Context } from './types';

export function getAction(context: Context): { action?: Action, actionType?: ActionType } {
  const event = context.eventName;
  let action: Action | undefined = undefined;
  let actionType: ActionType | undefined = undefined;

  if (event === 'issues') {
    actionType = ActionType.Issue;
    const payload = context.payload as WebhookPayloadIssues;
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
  } else if (event === 'pull_request') {
    actionType = ActionType.PullRequest;
    const payload = context.payload as WebhookPayloadPullRequest;
    switch (payload.action) {
      // Treat opened and reopened PRs the same
      case 'opened':
      case 'reopened':
        action = Action.PrOpened;
        break;
      case 'closed':
        action = Action.PrClosed;
        break;
    }
  }

  return { action , actionType };
}

export function getConfig() {
  const triagedLabels = getInput('triaged-labels');

  const config = {
    token: getInput('github-token'),
    projectName: getInput('project'),
    // Column for new issues
    triageColumnName: getInput('triage-column'),
    // Label that will be applied to triage issues
    triageLabel: getInput('triage-label'),
    // Labels that indicate an issue has been triaged
    triagedLabels: triagedLabels ? triagedLabels.split(/\s*,\s*/) : null,
    // Column for "ready" issues
    todoColumnName: getInput('todo-column'),
    // Column for "in-progress" issues
    workingColumnName: getInput('working-column'),
    // Column for completed issues
    doneColumnName: getInput('done-column'),
  } as const;

  if (!config.token) {
    throw new Error('A "github-token" property is required');
  }

  if (!config.projectName) {
    throw new Error('A "project" property is required');
  }

  return config;
}
