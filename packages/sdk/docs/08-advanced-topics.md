# Advanced Topics

This section covers more specialized features of the SmythOS SDK that you can use to build even more sophisticated applications.

## Team Management

In SmythOS, agents can be grouped into **Teams**. A Team provides a shared context and resources for a group of agents. For example, all agents within a team can share the same Storage and Vector Database instances, allowing them to collaborate and share knowledge seamlessly.

Every agent belongs to a team. By default, agents are assigned to a default team, but you can create and manage teams for more complex, multi-agent scenarios.

### Accessing Team Resources

You can access a team's shared resources through the `agent.team` property. This is particularly useful for managing team-level data that should be accessible to all agents in that team.

```typescript
import { Agent, Team } from '@smythos/sdk';

async function main() {
    // Create a new team. In a real app, this ID would be persisted.
    const devTeam = new Team('dev-team-01');

    // Create an agent and assign it to the team by passing the teamId
    const agent = new Agent({
        name: 'Team Lead',
        model: 'gpt-4o',
        teamId: devTeam.id,
    });

    // Access the team's shared storage via the agent
    const teamStorage = agent.team.storage.LocalStorage();

    // Write a file to the team's storage
    await teamStorage.write('project-docs.txt', 'Project Phoenix kickoff is Monday.');
    console.log('Shared document saved to team storage.');

    // Another agent on the same team could now access this file.
}

main();
```

## Document Parsing

The SDK includes a powerful and extensible document parsing engine. This allows you to easily extract text and metadata from various file formats, which is a common first step for populating a Vector Database or feeding information to an agent.

The `DocParser` can be used to automatically detect the file type and use the correct parser.

### Supported Formats

-   PDF
-   DOCX (Microsoft Word)
-   Markdown
-   Plain Text

### Example

Here's how you can use the `DocParser` to extract the content of a PDF file:

```typescript
import { DocParser } from '@smythos/sdk';
import fs from 'fs';
import path from 'path';

async function main() {
    // Create a dummy PDF file for the example
    const pdfPath = path.resolve(__dirname, 'sample.pdf');
    // In a real scenario, you would have an actual PDF file here.
    // For this example, we'll just pretend the buffer is from a PDF.
    const pdfBuffer = Buffer.from('This is a sample PDF content.');

    // 1. Create a parser instance
    const parser = new DocParser();

    // 2. Parse the document from a buffer
    //    The parser will inspect the buffer to determine the file type.
    const doc = await parser.parse(pdfBuffer);

    // 3. Access the extracted content
    console.log('--- Document Metadata ---');
    console.log(doc.metadata);
    console.log('\n--- Document Content ---');
    console.log(doc.content);

    // The 'doc' object can now be used, for example,
    // to insert its content into a Vector Database.
    // await vectorDB.insertDoc('my-pdf-doc', doc.content);
}

main();
```

More guides on deployment, custom components, and best practices will be published here as the SDK matures.
