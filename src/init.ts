import { getInput, info } from '@actions/core';
import { WebhookPayloadIssues } from '@octokit/webhooks';
import { Action, Context } from './types';

export function getAction(context: Context): Action | undefined {
  const event = context.eventName;

  if (event !== 'issues') {
    return;
  }

  const payload = context.payload as WebhookPayloadIssues;
  switch (payload.action) {
    case 'opened':
      return Action.IssueOpened;
    case 'closed':
      return Action.IssueClosed;
    case 'reopened':
      return Action.IssueReopened;
    case 'assigned':
    case 'unassigned':
      return Action.IssueAssignment;
    case 'labeled':
    case 'unlabeled':
      return Action.IssueLabeling;
  }
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
