import "dotenv/config";
import { AzureCliCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";
import { getOutlookEmails } from "../integrations/outlook/outlook.service.js";
import { isFunctionCall } from "../agents/utils/function-call.js";

function parseEmailLimit(argumentsJson: string): number {
  const parsed: unknown = JSON.parse(argumentsJson);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid function arguments");
  }

  const args = parsed as Record<string, unknown>;
  const limit = args.limit;

  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10
  ) {
    throw new Error("Email limit must be between 1 and 10");
  }

  return limit;
}

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

  const conversation = await openai.conversations.create();

  try {
    let response = await openai.responses.create({
      conversation: conversation.id,
      input:
        "Retrieve my latest 5 Outlook emails using get_outlook_emails. " +
        "Create a very short, easy-to-read email briefing. " +
        "Group similar or repeated emails into one summary line and show their count. " +
        "For example, three Microsoft sign-in alerts should become " +
        "'3 Microsoft security alerts about account sign-ins.' " +
        "For other emails, summarise their actual purpose using the email body. " +
        "Mention important outcomes or actions only when explicitly stated. " +
        "Use one line per unique topic, maximum 15 words per line. " +
        "Do not list sender addresses, timestamps, IP addresses, countries, " +
        "technical identifiers or unnecessary details. " +
        "Do not repeat similar information or invent details.",
      max_output_tokens: 7000,
    });

    let functionCalled = false;

    for (let round = 0; round < 3; round++) {
      console.log(`\nROUND ${round + 1}`);
      console.log("Response status:", response.status);
      console.log(
        "Output types:",
        response.output.map((item) => item.type)
      );

      const calls = response.output.filter(isFunctionCall);

      if (calls.length === 0) {
        break;
      }

      functionCalled = true;

      const outputs: Array<{
        type: "function_call_output";
        call_id: string;
        output: string;
      }> = [];

      for (const call of calls) {
        if (call.name !== "get_outlook_emails") {
          throw new Error(`Unexpected function: ${call.name}`);
        }

        const limit = parseEmailLimit(call.arguments);

        console.log(`Agent requested: ${call.name}(${limit})`);

        // Execute the actual Microsoft Graph integration.
        const emails = await getOutlookEmails(limit);

        console.log(`Retrieved ${emails.length} Outlook emails`);

        // Return the result using the function's call_id.
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ emails }),
        });
      }

      response = await openai.responses.create({
        conversation: conversation.id,
        input: outputs,
        max_output_tokens: 6000,
      });
    }

    console.log("\nFUNCTION CALLED:", functionCalled);
    console.log("\nAGENT SUMMARY:\n", response.output_text);
    console.log("\nSTATUS:", response.status);
    console.log(
      "OUTPUT TYPES:",
      response.output.map((item) => item.type)
    );
    console.log("\nTOKEN USAGE:", response.usage);

    if (!functionCalled) {
      throw new Error(
        "Agent did not request get_outlook_emails. " +
          "Check the agent's registered tools."
      );
    }

    if (response.output.some(isFunctionCall)) {
      throw new Error("Agent still has pending function calls");
    }

    if (response.status !== "completed" || !response.output_text) {
      throw new Error("Agent did not produce a completed email summary");
    }

    console.log("\nOUTLOOK AGENT TEST PASSED");
  } finally {
    await openai.conversations.delete(conversation.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
