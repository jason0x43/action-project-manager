import { Context } from './types';
import { GitHub } from '@actions/github';

export interface Entity {
  name: string;
  id: string;
}

export interface Card {
  id: string;
  project: Entity;
}

export interface Project {
  name: string;
  id: string;
  columns: {
    nodes: Entity[];
  };
}

export interface IssueQueryResource {
  id: string;
  assignees: {
    nodes: Entity[];
  };
  projectCards: {
    nodes: Card[];
  };
  repository: {
    projects: {
      nodes: Project[];
    };
    labels: {
      nodes: Entity[];
    };
  };
}

export class Issue {
  // Issue or card
  issueCard?: Card;
  // Column for the card
  cardColumn?: Entity;
  // Project columns
  projectColumns?: Entity[];
  // Repo labels
  repoLabels?: Entity[];
  // Issue id
  id?: string;
  // Issue labels
  labels?: Entity[];
  // Issue assignees
  assignees?: Entity[];

  constructor(
    public octokit: GitHub,
    public context: Context,
    public projectName: string
  ) {}

  /**
   * Load data for an issue and its containing project and repo
   */
  async load() {
    const { payload } = this.context;
    const url = payload.issue.html_url;
    const query = `
      {
        resource(url: "${url}") {
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
    const { resource } = await this.octokit.graphql(query);
    const cards: Card[] = resource.projectCards.nodes ?? [];
    this.issueCard = cards.find(
      (card) => card.project.name === this.projectName
    );
    this.cardColumn = resource.projectCards.column;
    this.projectColumns =
      resource.repository.projects.nodes[0]?.columns?.nodes ?? [];
    this.repoLabels = resource.repository.labels.nodes;
    this.assignees = resource.assignees;
    this.id = resource.id;
    this.labels = resource.labels;
  }

  /**
   * Add this issue to a particular column in its project
   */
  async moveToColumn(toColumn: Entity | string): Promise<void> {
    const column =
      typeof toColumn === 'string' ? this.getColumn(toColumn) : toColumn;
    const contentId = this.id;
    const query = this.issueCard
      ? `
      mutation {
        moveProjectCard(input: {
          cardId: "${this.issueCard.id}",
          columnId: "${column.id}"
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

    await this.mutate(query);
  }

  /**
   * Add a label to this issue
   */
  async addLabel(newLabel: Entity | string): Promise<void> {
    const label =
      typeof newLabel === 'string' ? this.getLabel(newLabel) : newLabel;
    if (this.hasLabel(label.name)) {
      return;
    }

    const query = `
      mutation {
        addLabelToLabelable(input: {
          labelIds: ["${label.id}"],
          labelableId: "${this.id}"
        }) { clientMutationId }
      }
    `;

    await this.mutate(query);
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
  isInColumn(column: Entity | string): boolean {
    const col = typeof column === 'string' ? this.getColumn(column) : column;
    if (this.cardColumn && col) {
      return this.cardColumn.id === col.id;
    }
    return false;
  }

  /**
   * Get a column from this issue's project
   */
  private getColumn(label: string): Entity | undefined {
    return this.projectColumns.find((col) => col.name === label);
  }

  /**
   * Get a label from this issue's repository
   */
  private getLabel(label: string): Entity | undefined {
    return this.repoLabels.find((lbl) => lbl.name === label);
  }

  /**
   * Mutate the issue
   */
  private async mutate(query: string) {
    await this.octokit.graphql(query);
    await this.load();
  }
}
