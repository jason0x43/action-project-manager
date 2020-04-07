import type { context } from '@actions/github';

export type Context = typeof context;

export enum Action {
  IssueOpened = 1,
  IssueAssignment,
  IssueClosed,
  IssueReopened,
  IssueLabeling
}
