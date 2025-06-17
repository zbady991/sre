# Managing Agents with `.smyth` Files

As your agents become more complex, defining them entirely in code can be cumbersome. The SmythOS SDK offers a powerful solution: `.smyth` files. These are human-readable YAML files that allow you to define an agent's structure—its name, behavior, and skills—in a portable and declarative way.

This approach promotes a clean separation of concerns: the agent's definition lives in a `.smyth` file, while your application code handles the logic of interacting with it.

The [`examples/02-agent-smyth-file`](../../examples/02-agent-smyth-file) directory contains a working example of this concept.

## The `.smyth` File Format

A `.smyth` file is a simple YAML or JSON file that describes the agent's configuration. Here's an example of what `my-agent.smyth` might look like:

```yaml
# my-agent.smyth
name: 'Example File Agent'
behavior: 'You are a helpful assistant defined in a YAML file.'
defaultModel: 'gpt-4' # Note: This can be overridden in code
components:
    - name: 'greeter'
      type: 'skill'
      description: 'Use this skill to greet someone.'
      # For skills defined in the file, the 'process' logic is just a string.
      # This is less common; typically skills are added via code for complex logic.
      process: '({name}) => `Hello, ${name}!`'
```

## Importing an Agent

You can easily load an agent from a `.smyth` file using the static `Agent.import()` method. This method is asynchronous and returns a fully hydrated `Agent` instance, ready to be used.

```typescript
import { Agent } from '@smythos/sdk';
import path from 'path';

async function main() {
    // Construct the full path to your .smyth file
    const agentPath = path.resolve(__dirname, 'my-agent.smyth');

    console.log(`Importing agent from: ${agentPath}`);

    // Import the agent definition from the file
    const agent = await Agent.import(agentPath);

    // Now you can interact with the agent as usual
    const response = await agent.prompt('Use the greeter skill to say hello to the world.');
    console.log(response); // "Hello, world!"
}

main();
```

## Overriding Configuration

A key feature of `Agent.import()` is the ability to override any property of the `.smyth` file at load time. This is extremely useful for adapting a single agent definition to different environments or for using more powerful models.

For instance, you can override the `defaultModel` to use a different LLM without touching the original `.smyth` file.

```typescript
import { Agent, Model } from '@smythos/sdk';
import path from 'path';

async function main() {
    const agentPath = path.resolve(__dirname, 'my-agent.smyth');

    // Import the agent, but override the model to use gpt-4o
    const agent = await Agent.import(agentPath, {
        // The second argument to import() is an override object
        defaultModel: 'gpt-4o',
    });

    // You can also add or override skills programmatically
    agent.addSkill({
        name: 'farewell',
        description: 'Says goodbye.',
        process: async ({ name }) => `Goodbye, ${name}!`,
    });

    console.log(`Agent model is now: ${agent.data.defaultModel}`);

    const farewell = await agent.prompt('Say goodbye to the world.');
    console.log(farewell); // "Goodbye, world!"
}

main();
```

Using `.smyth` files allows for a modular and maintainable architecture, making it easy to manage and version your agent designs separately from your application logic.

## Next Steps

Now that you can manage agents as files, let's explore how to orchestrate multiple agents and components together in [Workflows](06-workflows.md).
