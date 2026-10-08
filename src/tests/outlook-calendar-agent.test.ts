import "dotenv/config";
import { AzureCliCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";
import { getOutlookCalendarEvents } from "../integrations/outlook/calendar.service.js";
import { isFunctionCall } from "../agents/utils/function-call.js";

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
    const start = new Date();
    const end = new Date(start);

    end.setUTCDate(end.getUTCDate() + 7);

    let response = await openai.responses.create({
      conversation: conversation.id,
      input:
        "Check my Outlook calendar for events between " +
        `${start.toISOString()} and ${end.toISOString()}. ` +
        "Use get_outlook_calendar_events. " +
        "Summarise upcoming events in short, readable lines. " +
        "Include the date and UK local time. " +
        "If there are no events, say so.",
      max_output_tokens: 7000,
    });

    let calendarCalled = false;

    for (let round = 0; round < 3; round++) {
      console.log(`\nROUND ${round + 1}`);
      console.log(
        "Output types:",
        response.output.map((item) => item.type)
      );

      const calls = response.output.filter(isFunctionCall);

      if (calls.length === 0) {
        break;
      }

      const outputs: Array<{
        type: "function_call_output";
        call_id: string;
        output: string;
      }> = [];

      for (const call of calls) {
        if (call.name !== "get_outlook_calendar_events") {
          throw new Error(`Unexpected function: ${call.name}`);
        }

        const args: unknown = JSON.parse(call.arguments);

        if (
          typeof args !== "object" ||
          args === null ||
          !("startDate" in args) ||
          !("endDate" in args) ||
          typeof args.startDate !== "string" ||
          typeof args.endDate !== "string"
        ) {
          throw new Error("Invalid calendar tool arguments");
        }

        calendarCalled = true;

        console.log(
          `Agent requested calendar events: ` +
            `${args.startDate} to ${args.endDate}`
        );

        const events = await getOutlookCalendarEvents(
          args.startDate,
          args.endDate
        );

        console.log(`Retrieved ${events.length} calendar events`);

        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ events }),
        });
      }

      response = await openai.responses.create({
        conversation: conversation.id,
        input: outputs,
        max_output_tokens: 7000,
      });
    }

    console.log("\nCALENDAR FUNCTION CALLED:", calendarCalled);
    console.log("\nAGENT SUMMARY:\n", response.output_text);
    console.log("\nSTATUS:", response.status);

    if (!calendarCalled) {
      throw new Error("Agent did not request the calendar function");
    }

    if (response.output.some(isFunctionCall)) {
      throw new Error("Agent still has pending function calls");
    }

    if (response.status !== "completed" || !response.output_text) {
      throw new Error("Agent did not produce a completed calendar summary");
    }

    console.log("\nOUTLOOK CALENDAR AGENT TEST PASSED");
  } finally {
    await openai.conversations.delete(conversation.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
