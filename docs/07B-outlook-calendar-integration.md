# Milestone 7B — Outlook Calendar Integration

**Project:** DayBrief AI  
**Status:** Completed (local implementation and agent test reported successful)  
**Date:** 8 October 2026

## Objective

Enable the Microsoft Foundry DayBrief Agent to retrieve upcoming events from a personal Outlook calendar and present a concise schedule using UK local times, without granting write access to the calendar.

## What was implemented

1. Added Microsoft Graph delegated permission **`Calendars.Read`** to the existing `DayBrief-AI-Outlook` app registration.
2. Extended the MSAL authentication scopes to include `Calendars.Read` alongside `User.Read` and `Mail.Read`. Reused the existing persistent token cache and silent authentication fallback.
3. Created `src/integrations/outlook/calendar.service.ts`, exposing `getOutlookCalendarEvents(startDate, endDate)`.
4. Used the Microsoft Graph `/me/calendarView` endpoint to retrieve events within a validated ISO date range, requesting `Europe/London` response times and selecting only the fields required for a briefing.
5. Added `src/tests/outlook-calendar.test.ts` to verify calendar retrieval independently of the agent.
6. Registered a read-only `get_outlook_calendar_events` function tool in `src/agents/tools/calendar.tool.ts`, with required `startDate` and `endDate` arguments.
7. Updated `src/agents/daybrief-agent.ts` to expose the calendar tool alongside Outlook email and hosted web search, and published a new agent version.
8. Created `src/tests/outlook-calendar-agent.test.ts` to verify the complete agent-to-calendar function-calling cycle.

## Architecture

```text
User request / local test
         |
         v
TypeScript orchestration -> Microsoft Foundry Agent
         ^                         |
         |                  function_call:
         |                  get_outlook_calendar_events
         |                         |
         +---- Node.js tool dispatcher <---+
                       |
             calendar.service.ts
                       |
           MSAL cached authentication
                       |
              Microsoft Graph API
               /me/calendarView
                       |
                Calendar events
                       |
            function_call_output
                       |
                Foundry Agent
                       |
             Concise schedule summary
```

## Core service contract

```typescript
export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location: string;
  isAllDay: boolean;
  isCancelled: boolean;
}

export async function getOutlookCalendarEvents(
  startDate: string,
  endDate: string
): Promise<OutlookCalendarEvent[]>;
```

The service validates that the date range is valid and ordered, retrieves the access token through `getOutlookAccessToken()`, queries calendar view, and excludes cancelled events. The initial implementation requests up to 50 events; pagination should be added if full coverage is required for busy calendars.

## Function tool definition

**Tool:** `get_outlook_calendar_events`  
**Type:** Custom function tool (executed by Node.js, not directly by Foundry)  
**Arguments:** `startDate` and `endDate` as ISO 8601 timestamp strings  
**Permissions:** Read-only (`Calendars.Read`)

The model can choose whether to request the calendar tool and select a relevant date range. The application is responsible for validating arguments and actually invoking the Graph integration.

## Understanding the execution rounds

**Initial model request:** The test asks the agent to check events over the next seven days.

**Round 1 — Tool request:** Foundry may return `reasoning` and a `function_call` for `get_outlook_calendar_events`. The Node.js loop parses and validates the dates, executes the calendar service, and packages the returned events as `function_call_output` with the **matching `call_id`**.

**Round 2 — Summary:** Foundry receives the calendar events and normally returns a readable summary as a `message`. If it requests another tool, the loop can continue, subject to the three-round safety limit.

**Important:** The number of function calls in a response is chosen by the agent; the maximum number of rounds and the permitted execution paths are controlled by the application. A response can contain zero, one, or multiple function calls.

## Tests and commands

```bash
npm run typecheck
npm run test:outlook-calendar
npm run agent:create
npm run test:outlook-calendar-agent
```

**Reported outcome:** Calendar service and calendar agent tests completed successfully. The test checks that the calendar function was requested, no function calls remain pending, and the final response is completed with non-empty text.

## Files added or changed

| File | Purpose |
|---|---|
| `src/integrations/outlook/auth.ts` | Add `Calendars.Read` scope; reuse MSAL cache |
| `src/integrations/outlook/calendar.service.ts` | Microsoft Graph calendar retrieval |
| `src/agents/tools/calendar.tool.ts` | Calendar tool JSON schema |
| `src/agents/daybrief-agent.ts` | Register tool and calendar instructions |
| `src/tests/outlook-calendar.test.ts` | Direct calendar integration test |
| `src/tests/outlook-calendar-agent.test.ts` | End-to-end agent function-calling test |
| `package.json` | Test scripts |

## Security and production considerations

- `Calendars.Read` is delegated and read-only; do not add write permissions without a clear need.
- The agent receives calendar details returned by the application; avoid returning unnecessary sensitive fields.
- Calendar content is untrusted data and must not be treated as instructions for tool execution.
- The current cached, interactive personal-account MSAL authentication works locally but needs a secure unattended-authentication design for scheduled Azure execution.
- Handle Microsoft Graph pagination, throttling, transient errors, daylight-saving boundaries, and limits on tool calls before production rollout.
- Extract duplicated test orchestration into a shared `agent-runner.ts` for use by both tests and the future scheduled job.

## Next milestone

**Shared Agent Runner:** Refactor the email and calendar tests into a reusable, allowlisted function dispatcher that can execute multiple tool calls, return outputs with their original `call_id`, enforce round limits, and generate the combined daily briefing.
