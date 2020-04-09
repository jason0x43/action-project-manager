import { NamedEntity } from './types';
import { GitHub } from '@actions/github';

export interface Card {
  id: string;
  column: NamedEntity;
  project: NamedEntity;
}

export interface LinkedPr {
  willCloseIssue: boolean;
  closed: boolean;
  id: string;
}

export interface Project {
  name: string;
  id: string;
  columns: {
    nodes: NamedEntity[];
  };
}

export interface IssueQueryResource {
  id: string;
  assignees: {
    nodes: NamedEntity[];
  };
  projectCards: {
    nodes: Card[];
  };
  repository: {
    projects: {
      nodes: Project[];
    };
    labels: {
      nodes: NamedEntity[];
    };
  };
}

export class Issue {
  // Issue or card
  issueCard?: Card;
  // Project columns
  projectColumns: NamedEntity[];
  // Repo labels
  repoLabels: NamedEntity[];
  // Issue id
  id: string;
  // Issue labels
  labels: NamedEntity[];
  // Issue assignees
  assignees: NamedEntity[];
  // Linked PRs
  linkedPrs: LinkedPr[];

  constructor(
    public octokit: GitHub,
    public url: string,
    public projectName: string
  ) {
    this.id = '';
    this.labels = [];
    this.assignees = [];
    this.projectColumns = [];
    this.repoLabels = [];
    this.linkedPrs = [];
  }

  /**
   * Load data for an issue and its containing project and repo
   */
  async load() {
    const query = `
      {
        resource(url: "${this.url}") {
          ... on Issue {
            id
            assignees(first: 1) {
              nodes {
                name
                id
              }
            }
            labels(first: 10) {
              nodes {
                name
                id
              }
            }
            projectCards {
              nodes {
                id
                column {
                  name
                  id
                }
                project {
                  name
                  id
                }
              }
            },
            repository {
              projects(search: "${this.projectName}", first: 10, states: [OPEN]) {
                nodes {
                  name
                  id
                  columns(first: 10) {
                    nodes {
                      id
                      name
                    }
                  }
                }
              }
              labels(first: 50) {
                nodes {
                  name
                  id
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.octokit.graphql(query);
    const resource = response!["resource"];
    const cards: Card[] = resource.projectCards.nodes ?? [];

    // Project columns must exist, because this action only makes sense with a
    // valid project
    this.projectColumns = resource.repository.projects.nodes[0].columns.nodes;
    // Issue card may not exist
    this.issueCard = cards.find(
      (card) => card.project.name === this.projectName
    );
    this.repoLabels = resource.repository.labels.nodes;
    this.assignees = resource.assignees.nodes;
    this.id = resource.id;
    this.labels = resource.labels.nodes;
  }

  /**
   * Load any PRs linked to this issue
   */
  async loadLinkedPrs() {
    const query = `
      {
        resource(url: "${this.url}") {
          ... on Issue {
            timelineItems(first: 100, itemTypes: CROSS_REFERENCED_EVENT) {
              nodes {
                ... on CrossReferencedEvent {
                  willCloseTarget
                  source {
                    ... on PullRequest {
                      id
                      closed
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.octokit.graphql(query);
    const resource = response!["resource"];
    this.linkedPrs = resource.timelineItems.nodes.map((node: any) => ({
      willCloseIssue: node.willCloseTarget,
      ...node.source
    }));
  }

  /**
   * Add this issue to a particular column in its project
   */
  async moveToColumn(toColumn: NamedEntity | string): Promise<void> {
    const column =
      typeof toColumn === 'string' ? this.getColumn(toColumn) : toColumn;

    if (!column) {
      throw new Error(`Invalid column "${toColumn}"`);
    }

    const contentId = this.id;
    const query = this.issueCard
      ? `
      mutation {
        moveProjectCard(input: {
          cardId: "${this.issueCard.id}",
          columnId: "${column!.id}"
        }) { clientMutationId }
      }
    `
      : `
      mutation {
        addProjectCard(input: {
          contentId: "${contentId}",
          projectColumnId: "${column.id}"
        }) { clientMutationId }
      }
    `;

    await this.octokit.graphql(query);
  }

  /**
   * Add a label to this issue
   */
  async addLabel(toAdd: NamedEntity | string): Promise<void> {
    const label = typeof toAdd === 'string' ? this.getLabel(toAdd) : toAdd;
    if (!label) {
      throw new Error(`Invalid label "${toAdd}"`);
    }

    if (this.hasLabel(label.name)) {
      return;
    }

    const query = `
      mutation {
        addLabelsToLabelable(input: {
          labelIds: ["${label.id}"],
          labelableId: "${this.id}"
        }) { clientMutationId }
      }
    `;

    await this.octokit.graphql(query);
  }

  /**
   * Indicate whether this issue already has a given label
   */
  hasLabel(label: string): boolean {
    return this.labels.some((lbl) => lbl.name === label);
  }

  /**
   * Indicate whether this issue is assigned
   */
  isAssigned(): boolean {
    return this.assignees && this.assignees.length > 0;
  }

  /**
   * Indicate whether this issue is in the given column
   */
  isInColumn(column: NamedEntity | string): boolean {
    const col = typeof column === 'string' ? this.getColumn(column) : column;
    if (!col || !this.issueCard) {
      return false;
    }
    return this.issueCard.column.id === col.id;
  }

  /**
   * Remove a label from this issue
   */
  async removeLabel(toRemove: NamedEntity | string): Promise<void> {
    const label =
      typeof toRemove === 'string' ? this.getLabel(toRemove) : toRemove;
    if (!label) {
      throw new Error(`Invalid label "${toRemove}"`);
    }

    if (!this.hasLabel(label.name)) {
      return;
    }

    const query = `
      mutation {
        removeLabelsFromLabelable(input: {
          labelIds: ["${label.id}"],
          labelableId: "${this.id}"
        }) { clientMutationId }
      }
    `;

    await this.octokit.graphql(query);
  }

  /**
   * Get a column from this issue's project
   */
  private getColumn(label: string): NamedEntity | undefined {
    return this.projectColumns.find((col) => col.name === label);
  }

  /**
   * Get a label from this issue's repository
   */
  private getLabel(label: string): NamedEntity | undefined {
    return this.repoLabels.find((lbl) => lbl.name === label);
  }
}

export async function loadIssue(
  octokit: GitHub,
  url: string,
  projectName: string
) {
  const issue = new Issue(octokit, url, projectName);
  await issue.load();
  return issue;
}
