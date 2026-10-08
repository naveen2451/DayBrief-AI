# Milestone 7A — Outlook Email Integration

**Project:** DayBrief AI  
**Status:** Completed  
**Date:** 8 October 2026

## Objective

Connect the Microsoft Foundry agent to a personal Outlook inbox through Microsoft Graph, and produce a short, readable briefing that groups repeated messages.

## Delivered

- Registered an Entra application supporting personal Microsoft accounts with delegated `User.Read` and `Mail.Read` permissions.
- Implemented device-code sign-in with MSAL Node for initial interactive authentication.
- Added persistent local MSAL token caching via `@azure/msal-node-extensions`, allowing subsequent local test runs to authenticate silently when permitted.
- Implemented a read-only Outlook service using Microsoft Graph to fetch recent inbox messages.
- Registered the custom `get_outlook_emails` function tool with the Foundry agent.
- Implemented a bounded tool-execution loop that validates function arguments, invokes the Outlook service, and returns results with the matching `call_id`.
- Refined the briefing prompt to group similar messages, report counts, and produce concise one-line summaries per unique topic.
- Successfully executed the full agent test end-to-end.

## Architecture

```text
Test / future scheduled job
          |
          v
TypeScript agent runner
          |
          v
Microsoft Foundry agent
          |
          | function_call: get_outlook_emails({ limit: 5 })
          v
TypeScript function dispatcher
          |
          v
Outlook service -> MSAL cached authentication -> Microsoft Graph
          |
          | recent email metadata and body preview
          v
function_call_output (matching call_id)
          |
          v
Microsoft Foundry agent -> grouped, concise email briefing
```

**Execution boundary:** The Foundry model decides when to request a custom tool. The Node.js application executes the local function and returns its result. Publishing the tool schema alone does not deploy the TypeScript implementation.

## Key Project Files

| File | Responsibility |
| --- | --- |
| `src/integrations/outlook/auth.ts` | MSAL sign-in, persistent token cache, silent token acquisition and device-code fallback |
| `src/integrations/outlook/outlook.service.ts` | Read-only Microsoft Graph inbox retrieval |
| `src/agents/tools/outlook.tool.ts` | JSON schema for the `get_outlook_emails` agent tool |
| `src/agents/daybrief-agent.ts` | Foundry agent definition and tool registration |
| `src/tests/outlook-service.test.ts` | Outlook service integration test |
| `src/tests/outlook-agent.test.ts` | End-to-end agent function-calling test |

A reusable generic `isFunctionCall` type guard was discussed as a refactoring; its final file placement should be verified in the repository.

## Function Calling: Round 1 and Round 2

1. **Round 1:** The agent receives the user's request and returns a structured `function_call`, for example `get_outlook_emails` with `{ "limit": 5 }`.
2. **Application execution:** The TypeScript runner validates the request, calls `getOutlookEmails(limit)`, and obtains data from Microsoft Graph.
3. **Tool result:** The runner submits `function_call_output` with the original `call_id`.
4. **Round 2:** The agent interprets the returned messages and generates the briefing. Further rounds are possible if more tools are requested.

The bounded loop prevents unbounded tool execution. Function calls should be dispatched only to explicitly permitted handlers.

## Briefing Requirements

- Summarise **unique topics**, rather than listing every message separately.
- Combine repeated or closely related emails into one line and include the count.
- Keep each line short, readable and specific.
- Use available email content to report meaningful outcomes or required actions, but do not invent information.
- Omit sender addresses, timestamps, IP addresses and technical identifiers unless specifically requested.

**Illustrative output:**

```text
3 Microsoft security alerts about account sign-ins.
Baby College: Forwarded registration confirmation.
YellowNest: Forwarded application-related email.
```

These lines illustrate the desired style, not independently verified interpretations of full email bodies.

## Authentication and Security

- `.env` stores the Entra app client ID and configuration, **not** Outlook passwords or tokens.
- Persistent cache is stored outside the Git repository, under the user's home directory.
- Local silent authentication can fail if Microsoft requires renewed interaction or consent.
- Current Microsoft Graph permissions are delegated and read-only for mail.
- Email content sent to Foundry should be minimised and treated as untrusted input; email text must not be allowed to override agent instructions.
- The local MSAL cache is **not** an unattended authentication solution for an Azure-hosted scheduled job.

## Validation

The user confirmed successful local execution of:

```bash
npm run typecheck
npm run test:outlook-service
npm run test:outlook-agent
```

Observed integration behaviour:

- The Foundry agent requested `get_outlook_emails(5)`.
- The Outlook service retrieved five messages.
- The runner returned the function output to Foundry.
- The agent produced an email briefing.
- Persistent caching removed repeated interactive sign-in under normal local testing conditions.
- The final prompt was refined for deduplicated, concise summaries.

## Known Limitations and Next Steps

1. **Full email bodies:** The current documented retrieval uses `bodyPreview`, which is only an excerpt. Fetch and safely normalise `body.content` if full-body understanding is required.
2. **Production orchestration:** Move the tool execution loop from the test file into a reusable agent runner.
3. **Unattended authentication:** Design protected, renewable authentication for the personal Outlook account before deploying a scheduled Azure Function.
4. **Calendar:** Reuse the MSAL authentication helper and Graph integration pattern for read-only Outlook Calendar access.
5. **Scheduling and delivery:** Later add an 08:00 Europe/London schedule and an approved email-delivery mechanism.

## Milestone Result

**Milestone 7A complete for local development and testing:** The DayBrief AI Foundry agent can request recent Outlook emails through a custom function, receive the results, and produce a grouped, concise briefing.
