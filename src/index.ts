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
import { info } from '@actions/core';
import { GitHub, context } from '@actions/github';
import { loadIssue } from './issue';
import { loadPr } from './pr';
import { Action, ActionType } from './types';
import { getAction, getConfig } from './init';

async function main() {
  const actionInfo = getAction(context);
  if (!actionInfo.action) {
    info(`Skipping event ${event}`);
    return;
  }

  const config = getConfig();
  const octokit = new GitHub(config.token);
  const { projectName } = config;

  if (actionInfo.actionType === ActionType.Issue) {
    const issue = await loadIssue(
      octokit,
      context.payload.issue!.html_url!,
      projectName
    );

    switch (actionInfo.action) {
      case Action.IssueOpened:
        if (issue.isAssigned() && config.workingColumnName) {
          // If the issue is already assigned, move it to the working column
          await issue.moveToColumn(config.workingColumnName);
        } else if (
          !(
            config.triagedLabels &&
            config.triagedLabels.some((label) => issue.hasLabel(label))
          )
        ) {
          // If we have a triage label, apply it to new issues
          if (config.triageLabel) {
            await issue.addLabel(config.triageLabel);
          }

          // If we have a triage column, put new issues in it
          if (config.triageColumnName) {
            await issue.moveToColumn(config.triageColumnName);
          }
        }
        break;

      case Action.IssueClosed:
        // If an issue is closed, it's done
        if (config.doneColumnName) {
          await issue.moveToColumn(config.doneColumnName);
        }
        break;

      case Action.IssueReopened:
        // If an issue is reopened and is assigned, it's in progress, otherwise
        // it's todo
        if (issue.isAssigned() && config.workingColumnName) {
          await issue.moveToColumn(config.workingColumnName);
        } else if (!issue.isAssigned() && config.todoColumnName) {
          await issue.moveToColumn(config.todoColumnName);
        }
        break;

      case Action.IssueAssignment:
        // If a triaged or todo issue is assigned, it's in progress
        if (issue.isAssigned() && config.workingColumnName) {
          if (
            (config.todoColumnName &&
              issue.isInColumn(config.todoColumnName)) ||
            (config.triageColumnName &&
              issue.isInColumn(config.triageColumnName))
          ) {
            await issue.moveToColumn(config.workingColumnName);

            if (config.triageLabel && issue.hasLabel(config.triageLabel)) {
              await issue.removeLabel(config.triageLabel);
            }
          }
        } else if (!issue.isAssigned() && config.todoColumnName) {
          if (
            config.workingColumnName &&
            issue.isInColumn(config.workingColumnName)
          ) {
            await issue.moveToColumn(config.todoColumnName);
          }
        }
        break;

      case Action.IssueLabeling:
        if (config.triageLabel) {
          if (issue.hasLabel(config.triageLabel)) {
            if (
              config.triageColumnName &&
              !issue.isInColumn(config.triageColumnName)
            ) {
              await issue.moveToColumn(config.triageColumnName);
            }
          } else {
            if (
              config.todoColumnName &&
              !issue.isInColumn(config.todoColumnName)
            ) {
              await issue.moveToColumn(config.todoColumnName);
            }
          }
        }
        break;
    }
  } else {
    const pr = await loadPr(octokit, context.payload.pull_request!.html_url!);

    switch (actionInfo.action) {
      case Action.PrOpened:
        // Find referenced open issues; if in triage or todo, move them to
        // in-progress
        // TODO: maybe only do this for issues that the PR would close
        for (const issueRef of pr.referencedIssues) {
          const issue = await loadIssue(octokit, issueRef.url, projectName);

          // Only consider project issues
          if (!issue.issueCard) {
            continue;
          }

          if (
            (config.todoColumnName &&
              issue.isInColumn(config.todoColumnName)) ||
            (config.triageColumnName &&
              issue.isInColumn(config.triageColumnName))
          ) {
            if (config.workingColumnName) {
              await issue.moveToColumn(config.workingColumnName);
            }
            if (config.triageLabel && issue.hasLabel(config.triageLabel)) {
              await issue.removeLabel(config.triageLabel);
            }
          }
        }
        break;

      case Action.PrClosed:
        // Find referenced in-progress issues. If not assigned and in
        // in-progress and there are no other attached open PRs, move them to
        // todo.
        for (const issueRef of pr.referencedIssues) {
          const issue = await loadIssue(octokit, issueRef.url, projectName);

          // Only consider project issues
          if (!issue.issueCard) {
            continue;
          }

          await issue.loadLinkedPrs();
          const otherOpenPrs = issue.linkedPrs.filter(p => !p.closed && p.id !== pr.id);

          if (
            (otherOpenPrs.length === 0 || !issue.isAssigned()) &&
            config.todoColumnName
          ) {
            await issue.moveToColumn(config.todoColumnName);
          }
        }
        break;
    }
  }
}

main().catch((error) => console.error(error));
