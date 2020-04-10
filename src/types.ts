import type { context } from '@actions/github';

export type Context = typeof context;

export enum Action {
  IssueOpened = 1,
  IssueAssignment,
  IssueClosed,
  IssueReopened,
  IssueLabeling,
  PrOpened,
  PrClosed
}

export enum ActionType {
  Issue = 1,
  PullRequest
}


export interface Entity {
  id: string;
}

export interface NamedEntity extends Entity {
  name: string;
}
