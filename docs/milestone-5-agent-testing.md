# DayBrief AI — Milestone 5: Agent Invocation & Conversation Testing

**Status:** Completed  
**Technology:** TypeScript, Microsoft Foundry Agent Service, Azure OpenAI (`gpt-5-mini`)

## Objective

Invoke the existing `daybrief-agent` from TypeScript and verify that it can maintain conversation context across multiple messages.

## 1. Create the test file

```bash
touch src/tests/daybrief-agent.test.ts
```

## 2. Implement the agent test

File: `src/tests/daybrief-agent.test.ts`

```typescript
import "dotenv/config";
import { AzureCliCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

async function main(): Promise<void> {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  const agentName = process.env.FOUNDRY_AGENT_NAME;

  if (!endpoint || !agentName) {
    throw new Error("Missing Foundry environment configuration");
  }

  const project = new AIProjectClient(endpoint, new AzureCliCredential());

  // Connect to the existing Foundry agent.
  const openai = project.getOpenAIClient({
    azureConfig: {
      allowPreview: true,
      agentName,
    },
  });

  // Create a conversation.
  const conversation = await openai.conversations.create();

  try {
    const first = await openai.responses.create({
      conversation: conversation.id,
      input: "My name is Alex. What is your role?",
    });

    console.log("First response:", first.output_text);
    console.log("Token usage:", first.usage);

    const second = await openai.responses.create({
      conversation: conversation.id,
      input: "What name did I tell you?",
    });

    console.log("Second response:", second.output_text);
    console.log("Token usage:", second.usage);
  } finally {
    // Delete the test conversation.
    await openai.conversations.delete(conversation.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

## 3. Configure npm script

```bash
npm pkg set 'scripts.test:agent=tsx src/tests/daybrief-agent.test.ts'
```

## 4. Authenticate with Azure

Activate the Azure CLI virtual environment:

```bash
source ~/.venvs/azure-cli/bin/activate
```

Verify the active subscription:

```bash
az account show --output table
```

## 5. Execute the test

```bash
npm run test:agent
```

Expected output:

```text
First response:
I'm DayBrief AI, your personal daily briefing assistant...

Second response:
You told me your name is Alex.

Token usage:
{
  input_tokens: ...,
  output_tokens: ...,
  total_tokens: ...
}
```

## 6. Validate TypeScript

```bash
npm run typecheck
```

## 7. Commit changes to GitHub

```bash
git add src/tests/daybrief-agent.test.ts package.json
git commit -m "Add Foundry agent conversation integration test"
git push
```

## Architecture

```text
VS Code / TypeScript
        |
        v
AzureCliCredential
        |
        v
Microsoft Foundry
        |
        v
daybrief-agent (existing version)
        |
        v
Conversation created
        |
        +-- Message 1: My name is Alex
        |
        +-- Message 2: What name did I tell you?
        |
        v
Agent uses conversation history
        |
        v
Conversation deleted
```

## Key Concepts Learned

| Concept            | Implementation                                      |
| ------------------ | --------------------------------------------------- |
| Agent invocation   | `getOpenAIClient()` with agent configuration        |
| Authentication     | `AzureCliCredential`                                |
| Conversation state | `conversations.create()`                            |
| Multi-turn context | Reuse the same conversation ID                      |
| Token monitoring   | `response.usage`                                    |
| Resource cleanup   | `conversations.delete()`                            |
| Agent versioning   | Reuse existing agent without creating a new version |

## Milestone Progress

| Milestone                                       | Status        |
| ----------------------------------------------- | ------------- |
| 1. Azure infrastructure provisioning            | Completed     |
| 2. Azure OpenAI model deployment                | Completed     |
| 3. TypeScript connectivity                      | Completed     |
| 4. Foundry Agent creation                       | Completed     |
| 5. Agent invocation and multi-turn conversation | **Completed** |
| 6. Web Search — Weather integration             | Next          |
| 7. Google MCP — Gmail and Calendar              | Pending       |
| 8. Microsoft connector — Outlook and Calendar   | Pending       |
| 9. Scheduling and email delivery                | Pending       |

## Outcome

Successfully invoked the existing Foundry agent, maintained context across two messages, inspected token usage, and deleted the test conversation.

**Next milestone:** Integrate Foundry Web Search to retrieve live weather information for the daily briefing.
