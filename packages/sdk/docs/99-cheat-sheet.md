# Create Agent
```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Book Assistant',
    model: 'gpt-4o',
    behavior: 'You are a helpful assistant that can answer questions about the books.',
});
```

# Add Code Skill
```typescript
agent.addSkill({
    name: 'get_book_info',
    description: 'Use this skill to get information about a book',
    process: async ({ book_name }) => {
        /* ... Skill logic ... */
    },
});
```

# Prompt Agent
```typescript
const response = await agent.prompt('Who is the author of "The Great Gatsby"?');
console.log(response);
```

# Prompt Agent with Stream
```typescript
const stream = await agent.prompt('Who is the author of "The Great Gatsby"?').stream();

stream.on(TLLMEvent.Content, (data) => {
    console.log(data);
});
//all available events: Content, End, Error, Thinking, ToolInfo, ToolCall, ToolResult, Usage
```

# Chat with Agent
```typescript
const chat = agent.chat(sessionId);

//with prompt
const response = await chat.prompt('Hi there');
console.log(response);

//with stream
const stream = await chat.prompt('Hi there').stream();

stream.on(TLLMEvent.Content, (data) => {
    console.log(data);
});
```

# Run agent as MCP
```typescript
//with stdio transport
await agent.mcp(MCPTransport.STDIO);

//with SSE transport, you can define the port number in the second argument
const mcpUrl = await agent.mcp(MCPTransport.SSE, 3388);
```

# LLMs
```typescript
const llm = agent.llm.OpenAI('gpt-4o');
//other available models : agent.llm.Anthropic(...), agent.llm.Google(...), agent.llm.Groq(...), agent.llm.TogetherAI(...), agent.llm.Bedrock(...), agent.llm.VertexAI(...), agent.llm.xAI(...), agent.llm.Perplexity(...)

//prompt
const response = await llm.prompt('Who is the author of "The Great Gatsby"?');
console.log(response);

//stream
const stream = await llm.prompt('Who is the author of "The Great Gatsby"?').stream();

stream.on(TLLMEvent.Content, (data) => {
    console.log(data);
});
```


# LLM with advanced settings
```typescript
const llm = agent.llm.OpenAI('gpt-4o', {
    temperature: 0.5,
    max_tokens: 100,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
});
```


# LLM with custom api key
```typescript
const llm = agent.llm.OpenAI('gpt-4o', {
    apiKey: 'your-api-key',
});
```

# LLM with custom model
```typescript
const llm = agent.llm.OpenAI(Model.OpenAI('custom-model', {baseURL: 'https://api.custom-model.com'}));
```


# Local Storage
```typescript
const storage = agent.storage.LocalStorage();
await storage.write('test.txt', 'Hello, world!');
const data = await storage.read('test.txt');
console.log(data);
```

# S3 Storage
```typescript
const storage = agent.storage.S3Storage({
    bucket: 'your-bucket',
    region: 'your-region',
});
```







