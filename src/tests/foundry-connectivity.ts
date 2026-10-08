import "dotenv/config";
import { DefaultAzureCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

async function main(): Promise<void> {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  const model = process.env.FOUNDRY_MODEL;

  if (!endpoint || !model) {
    throw new Error("Missing Foundry environment configuration");
  }

  const project = new AIProjectClient(endpoint, new DefaultAzureCredential());

  const openai = project.getOpenAIClient();

  const response = await openai.responses.create({
    model,
    input: "Introduce yourself as DayBrief AI in one sentence.",
    store: false,
  });

  console.log("AI response:", response.output_text);
  console.log("Token usage:", response.usage);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
