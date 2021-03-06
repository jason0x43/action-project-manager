import { getInput } from '@actions/core';
import { GitHub, context } from '@actions/github';
import { Octokit } from '@octokit/rest';

(async function main() {
  try {
    const token = getInput('github-token');
    const projectName = getInput('project');
    const columnName = getInput('column');
    const octokit = (new GitHub(token)) as unknown as Octokit;
    const issueInfo = context.issue;

    console.log(`context: ${JSON.stringify(context, null, '  ')}`);

    // Find the project specified by the user
    const projects = await octokit.paginate(
      octokit.projects.listForRepo.endpoint.merge({
        owner: issueInfo.owner,
        repo: issueInfo.repo
      })
    );
    const project = projects.find(
      proj => proj.name.toLowerCase() === projectName.toLowerCase()
    );

    // Find the column specified by the user
    const columns = await octokit.paginate(
      octokit.projects.listColumns.endpoint.merge({
        project_id: project.id
      })
    );
    const column = columns.find(
      col => col.name.toLowerCase() === columnName.toLowerCase()
    );

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
      const issue = (await octokit.issues.get({
        owner: issueInfo.owner,
        repo: issueInfo.repo,
        issue_number: issueInfo.number
      })).data;

      // A card doesn't exist -- create it
      await octokit.projects.createCard({
        column_id: column.id,
        content_id: issue.id,
        content_type: 'Issue'
      });
    }
  } catch (error) {
    console.error(error);
  }
})();
