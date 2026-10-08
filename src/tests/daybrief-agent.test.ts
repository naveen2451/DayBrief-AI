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

  // Connect to the existing agent; do not create another version.
  const openai = project.getOpenAIClient({
    azureConfig: {
      allowPreview: true,
      agentName,
    },
  });

  // Create a conversation for multiple messages.
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
    await openai.conversations.delete(conversation.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
