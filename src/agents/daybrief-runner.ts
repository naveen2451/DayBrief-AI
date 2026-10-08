import "dotenv/config";
import { AzureCliCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";
import { getOutlookEmails } from "../integrations/outlook/outlook.service.js";
import { getOutlookCalendarEvents } from "../integrations/outlook/calendar.service.js";
import { isFunctionCall } from "./utils/function-call.js";

type ToolOutput = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

export type DayBriefResult = {
  summary: string;
  emailCalled: boolean;
  calendarCalled: boolean;
  outputTypes: string[];
};

function parseEmailLimit(json: string): number {
  const args: unknown = JSON.parse(json);

  if (typeof args !== "object" || args === null) {
    throw new Error("Invalid email arguments");
  }

  const limit = (args as Record<string, unknown>).limit;

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

function parseCalendarDates(json: string): {
  startDate: string;
  endDate: string;
} {
  const args: unknown = JSON.parse(json);

  if (
    typeof args !== "object" ||
    args === null ||
    !("startDate" in args) ||
    !("endDate" in args) ||
    typeof args.startDate !== "string" ||
    typeof args.endDate !== "string"
  ) {
    throw new Error("Invalid calendar arguments");
  }

  return {
    startDate: args.startDate,
    endDate: args.endDate,
  };
}

export async function runDayBrief(): Promise<DayBriefResult> {
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

  const now = new Date();

  // Establish today's boundaries in Europe/London.
  const londonDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const calendarStart = `${londonDate}T00:00:00`;
  const calendarEnd = `${londonDate}T23:59:59`;

  const prompt = `
Create my DayBrief for ${londonDate}.

Use ALL FOUR integrations:

1. WEATHER
   Use web search to retrieve today's weather forecast
   for High Wycombe, Buckinghamshire, UK.

2. OUTLOOK EMAIL
   Call get_outlook_emails with limit 5.
   Group repeated emails and summarise unique topics briefly.

3. OUTLOOK CALENDAR
   Call get_outlook_calendar_events with:
   startDate="${calendarStart}"
   endDate="${calendarEnd}"
   Summarise today's events using UK local time.

4. GITHUB
   Use GitHub MCP to retrieve open pull requests
   in naveen2451/DayBrief-AI.
   Include PR numbers, titles and important action items.

   Format the final answer using exactly these headings:

   Weather
   Outlook Emails
   Calendar
   GitHub
   Action Items
   
   Formatting rules:
   - Keep the entire briefing under 250 words.
   - Weather: maximum 2 lines, including temperature and rain.
   - Emails: maximum 5 short lines; group repeated topics.
   - Calendar: show today's appointments with UK local times.
   - GitHub: show PR number, title and status.
   - Action Items: maximum 3 genuinely important actions.
   - Prioritise security alerts, upcoming appointments and blocked work.
   - Distinguish confirmed facts from uncertain information.
   - Do not invent events, PR statuses or action items.
   - Do not suggest modifying emails, calendars or GitHub.
   - Do not offer actions that our integrations cannot perform.
   - Do not ask follow-up questions.
   - Do not include a separate Sources section.
   - Keep source links inline only when useful.
   - Do not output raw JSON.
`;

  let emailCalled = false;
  let calendarCalled = false;
  const outputTypes: string[] = [];

  const toolResultCache = new Map<string, string>();

  try {
    let response = await openai.responses.create({
      conversation: conversation.id,
      input: prompt,
      max_output_tokens: 7000,
      tool_choice: "required",
      parallel_tool_calls: false,
    });

    console.log("\nFIRST RESPONSE TOKEN USAGE");
    console.log("Input:", response.usage?.input_tokens ?? "N/A");
    console.log("Output:", response.usage?.output_tokens ?? "N/A");
    console.log("Total:", response.usage?.total_tokens ?? "N/A");

    // Allow multiple rounds because the model may request
    // Outlook functions in separate responses.
    for (let round = 0; round < 6; round++) {
      outputTypes.push(...response.output.map((item) => item.type));

      const calls = response.output.filter(isFunctionCall);

      if (calls.length === 0) {
        break;
      }

      const outputs: ToolOutput[] = [];

      for (const call of calls) {
        const cacheKey = `${call.name}:${call.arguments}`;

        let output = toolResultCache.get(cacheKey);

        if (output === undefined) {
          switch (call.name) {
            case "get_outlook_emails": {
              const limit = parseEmailLimit(call.arguments);
              const emails = await getOutlookEmails(limit);

              emailCalled = true;
              console.log(`Outlook: retrieved ${emails.length} emails`);

              output = JSON.stringify({ emails });
              break;
            }

            case "get_outlook_calendar_events": {
              const { startDate, endDate } = parseCalendarDates(call.arguments);

              const events = await getOutlookCalendarEvents(startDate, endDate);

              calendarCalled = true;
              console.log(`Calendar: retrieved ${events.length} events`);

              output = JSON.stringify({ events });
              break;
            }

            default:
              throw new Error(`Unexpected function: ${call.name}`);
          }

          toolResultCache.set(cacheKey, output);
        } else {
          console.log(`Using cached result: ${call.name}`);
        }

        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output,
        });
      }

      response = await openai.responses.create({
        conversation: conversation.id,
        input: outputs,
        max_output_tokens: 3000,
        parallel_tool_calls: false,
      });
    }

    outputTypes.push(...response.output.map((item) => item.type));

    if (response.output.some(isFunctionCall)) {
      throw new Error("Agent still has pending function calls");
    }

    if (response.status !== "completed" || !response.output_text?.trim()) {
      throw new Error(
        `Agent did not complete briefing. Status: ${response.status}`
      );
    }

    return {
      summary: response.output_text.trim(),
      emailCalled,
      calendarCalled,
      outputTypes,
    };
  } finally {
    await openai.conversations.delete(conversation.id);
  }
}
