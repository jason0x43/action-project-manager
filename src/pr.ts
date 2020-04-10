import { Entity } from './types';
import { GitHub } from '@actions/github';
import { Issue, loadIssue } from './issue';

export interface ReferencedIssue extends Entity {
  url: string;
}

export class PullRequest {
  // Pr id
  id: string;
  // Pr number
  number: number;
  // Referenced issues
  referencedIssues: ReferencedIssue[];
  // Repo name
  repository: string;

  constructor(public octokit: GitHub, public url: string) {
    this.id = '';
    this.number = 0;
    this.referencedIssues = [];
    this.repository = '';
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
            number
            repository {
              nameWithOwner
            }
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
    const resource = response!['resource'];
    this.id = resource.id;
    this.number = resource.number;
    this.repository = resource.repository.nameWithOwner;
    this.referencedIssues = resource.timelineItems.nodes.map(
      (node: { source: Entity }) => ({
        ...node.source,
      })
    );
  }

  /**
   * Find all issues in the given project linked to this PR
   */
  async findLinkedIssues(projectName: string): Promise<Issue[]> {
    // Find all open issues linked to PRs by a closing reference
    const query = `
      search(query: "linked:pr is:open type:issue repo:${this.repository}", type: ISSUE, first: 50) {
        nodes {
          ... on Issue {
            url
          }
        }
      }
    `;

    const response = await this.octokit.graphql(query);
    const issueUrls: string[] = response!.search.nodes.map(
      (node: any) => node.id
    );
    const issues = [];

    for (const url of issueUrls) {
      issues.push(await loadIssue(this.octokit, url, projectName));
    }

    return issues.filter(
      (issue) =>
        issue.projectCard != null &&
        issue.linkedPrs.some((pr) => pr.id === this.id)
    );
  }
}

export async function loadPr(octokit: GitHub, url: string) {
  const pr = new PullRequest(octokit, url);
  await pr.load();
  return pr;
}
