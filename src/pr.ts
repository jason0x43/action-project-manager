import { Entity } from './types';
import { GitHub } from '@actions/github';

export interface ReferencedIssue extends Entity {
  url: string;
}

export class PullRequest {
  // Pr id
  id: string;
  // Referenced issues
  referencedIssues: ReferencedIssue[];

  constructor(public octokit: GitHub, public url: string) {
    this.id = '';
    this.referencedIssues = [];
  }

  /**
   * Load data for an issue and its containing project and repo
   */
  async load() {
    const query = `
      {
        resource(url: "${this.url}") {
          ... on PullRequest {
            id
            timelineItems(first: 10, itemTypes: CROSS_REFERENCED_EVENT) {
              nodes {
                ... on CrossReferencedEvent {
                  source {
                    ... on Issue {
                      id
                      url
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
    this.id = resource.id;
    this.referencedIssues = resource.timelineItems.nodes.map(
      (node: { source: Entity }) => ({
        ...node.source,
      })
    );
  }
}

export async function loadPr(octokit: GitHub, url: string) {
  const pr = new PullRequest(octokit, url);
  await pr.load();
  return pr;
}
