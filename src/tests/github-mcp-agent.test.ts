import "dotenv/config";
import { AIProjectClient } from "@azure/ai-projects";
import { AzureCliCredential } from "@azure/identity";

async function main() {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT!;
  const agentName = process.env.FOUNDRY_AGENT_NAME!;

  const project = new AIProjectClient(endpoint, new AzureCliCredential());

  const openai = project.getOpenAIClient({
    azureConfig: {
      allowPreview: true,
      agentName,
    },
  });

  const conversation = await openai.conversations.create();

  try {
    const response = await openai.responses.create({
      conversation: conversation.id,
      input:
        "Use GitHub MCP to find open pull requests in " +
        "naveen2451/DayBrief-AI. " +
        "Return the PR number, title and URL. " +
        "If none exist, say so.",
      max_output_tokens: 7000,
    });
    console.log("\nTOKEN USAGE");
    console.log("Input tokens:", response.usage?.input_tokens ?? "N/A");
    console.log("Output tokens:", response.usage?.output_tokens ?? "N/A");
    console.log("Total tokens:", response.usage?.total_tokens ?? "N/A");
    console.log("\n📋 GitHub Pull Request Summary");
    console.log("────────────────────────────");

    console.log("Response status:", response.status);

    if (response.output_text?.trim()) {
      console.log(response.output_text.trim());
    } else {
      console.log("No final text response.");
    }

    for (const item of response.output) {
      if (item.type === "mcp_list_tools") {
        console.log("\nAVAILABLE GITHUB MCP TOOLS:");

        for (const tool of item.tools) {
          console.log(`- ${tool.name}`);
        }

        console.log("Total tools:", item.tools.length);
      }
      console.log("Output type:", item.type);

      if (item.type === "mcp_approval_request") {
        console.log("MCP approval required.");
      }

      if (item.type === "mcp_call") {
        console.log("MCP tool:", item.name);
        console.log("MCP error:", item.error ?? "None");
      }
    }

    if (response.status === "incomplete") {
      console.log("Incomplete reason:", response.incomplete_details);
    }
  } finally {
    await openai.conversations.delete(conversation.id);
  }
}

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
