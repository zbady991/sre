hello-agent.ts
import { Agent } from "@smythos/sre-sdk";

const agent = new Agent({
  name: "HelloAgent",
  description: "Replies with Hello World",
  skills: [
    {
      name: "sayHello",
      run: async () => "Hello, World!"
    }
  ]
});

agent.run();
