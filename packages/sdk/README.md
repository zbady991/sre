# SmythOS SDK

Welcome to the SmythOS SDK! This powerful toolkit allows you to build, manage, and deploy sophisticated AI agents with ease. Whether you're creating a simple chatbot or a complex multi-agent system, the SmythOS SDK provides the tools you need to bring your ideas to life.

The SDK is a lightweight wrapper around the Smyth Runtime Environment. It lets you create and run agents with minimal setup while still allowing advanced customisation when needed.

## Key Features

-   ** Fluent Agent API**: A clean and intuitive API for creating and interacting with agents.
-   ** Extensible Skills**: Easily add new capabilities to your agents, from calling APIs to running custom code.
-   ** Streaming Support**: Get real-time responses from your agents for dynamic and interactive experiences.
-   ** Integrated AI Components**: Seamlessly connect to LLMs, Vector Databases, and Storage solutions.
-   ** Agent Serialization**: Save and load your agent's state, including skills and memory.
-   ** Team Management**: Orchestrate multiple agents to work together in teams.
-   ** Document Parsing**: Built-in support for parsing various document types like PDF, DOCX, and Markdown.

## Getting Started

Let's build your first agent in just a few lines of code. This example creates a simple agent that can fetch cryptocurrency prices.

### 1. Install the SDK

```bash
pnpm install @smythos/sdk
```

### 2. Create your Agent

Create a file named `index.ts` and add the following code:

```typescript
import { Agent } from '@smythos/sdk';

async function main() {
    // Create a new agent
    const agent = new Agent({
        name: 'CryptoMarket Assistant',
        behavior: 'You are a crypto price tracker. You are given a coin id and you need to get the price of the coin in USD',
        model: 'gpt-4o',
    });

    // Add a skill to the agent
    agent.addSkill({
        name: 'MarketData',
        description: 'Use this skill to get comprehensive market data and statistics for a cryptocurrency',
        process: async ({ coin_id }) => {
            const url = `https://api.coingecko.com/api/v3/coins/${coin_id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
            const response = await fetch(url);
            const data = await response.json();
            return data.market_data;
        },
    });

    // Prompt the agent and let it use the skill
    const promptResult = await agent.prompt('What are the current prices of Bitcoin and Ethereum ?');
    console.log(promptResult);

    // You can also call the skill directly
    const directCallResult = await agent.call('MarketData', { coin_id: 'bitcoin' });
    console.log('Direct call to MarketData for Bitcoin:', directCallResult.current_price.usd);
}

main();
```

### 3. Run your Agent

```bash
ts-node index.ts
```

You should see your agent respond with the current prices of Bitcoin and Ethereum!

## Core Concepts

### Agents

The `Agent` is the fundamental building block of the SmythOS SDK. It encapsulates a model, a set of behaviors, and a collection of skills. You can interact with an agent by sending it prompts.

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'My Assistant',
    model: 'gpt-4',
    behavior: 'You are a helpful assistant.',
});
```

### Prompting

The `prompt()` method is the primary way to interact with an agent. It returns a special `AgentCommand` object which can be awaited directly for a simple response, or used to stream the response for real-time applications.

**Promise-based response:**

```typescript
const response = await agent.prompt('Hello, world!');
console.log(response);
```

**Streaming response:**

```typescript
const stream = await agent.prompt('Tell me a story.').stream();
stream.on('data', (chunk) => process.stdout.write(chunk));
```

### Skills

Skills are functions that you can add to your agent to extend its capabilities. The agent's LLM can intelligently decide which skill to use based on the user's prompt.

```typescript
agent.addSkill({
    name: 'calculator',
    description: 'Perform mathematical calculations.',
    process: async ({ operation, a, b }) => {
        if (operation === 'add') return a + b;
        if (operation === 'subtract') return a - b;
        // ...
    },
});
```

You can also call a skill directly using `agent.call()`:

```typescript
const sum = await agent.call('calculator', { operation: 'add', a: 5, b: 3 });
console.log(sum); // 8
```

### AI Components

The SDK provides seamless integration with essential AI components:

-   **LLMs**: Connect to different large language models.
-   **VectorDB**: Manage vector embeddings for semantic search and memory.
-   **Storage**: Persistent key-value storage for your agents.

You can access these components through the agent instance:

```typescript
// Access integrated components
const llm = agent.llm;
const vectorDB = agent.vectorDB;
const storage = agent.storage;
```

## Examples

The `examples/` folder in the repository contains a variety of runnable projects to demonstrate the SDK's features in action.

-   **[01-agent-code-skill](./examples/01-agent-code-skill/)**: Basic agent creation, prompting, and skills.
-   **[02-agent-smyth-file](./examples/02-agent-smyth-file/)**: Shows how to save and load agent definitions from files.
-   **[03-agent-workflow-components](./examples/03-agent-workflow-components/)**: Demonstrates more complex agent workflows.
-   **[04-VectorDB-no-agent](./examples/04-VectorDB-no-agent/)**: Using the VectorDB component directly without an agent.
-   **[05-VectorDB-with-agent](./examples/05-VectorDB-with-agent/)**: Integrating a VectorDB with an agent.
-   **[06-Storage-no-agent](./examples/06-Storage-no-agent/)**: Using the Storage component directly.

Explore these examples to learn how to leverage the full power of the SmythOS SDK.

## API Reference

For a detailed breakdown of all classes and methods, please refer to our [full API documentation](./docs/01-getting-started.md).

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for more details.
