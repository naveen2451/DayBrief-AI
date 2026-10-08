import "dotenv/config";
import { AzureCliCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

async function main(): Promise<void> {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  const agentName = process.env.FOUNDRY_AGENT_NAME;

  if (!endpoint || !agentName) {
    throw new Error("Missing Foundry configuration");
  }

  const project = new AIProjectClient(endpoint, new AzureCliCredential());

  const openai = project.getOpenAIClient({
    azureConfig: {
      allowPreview: true,
      agentName,
    },
  });

  const response = await openai.responses.create({
    input:
      "Use web search to find today's temperature in High Wycombe, UK. Reply with the temperature in Celsius and one source URL.",
    max_output_tokens: 1500,
    store: false,
  });

  console.log("\nWEATHER BRIEFING\n");
  console.log(response.output_text);

  console.log("\nTOOL CALLS\n");
  console.dir(
    response.output.filter((item) => item.type === "web_search_call"),
    { depth: 5 }
  );

  console.log("\nTOKEN USAGE\n");
  console.log(response.usage);
  console.log("STATUS:", response.status);
  console.log("INCOMPLETE DETAILS:", response.incomplete_details);
  console.log(
    "OUTPUT ITEMS:",
    response.output.map((item) => item.type)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
// Find today's weather forecast for High Wycombe, UK.

// Use Web Search for current information.

// Include:
// - Temperature in Celsius
// - Chance of rain
// - Weather conditions
// - Practical clothing recommendation
// - Source URLs
