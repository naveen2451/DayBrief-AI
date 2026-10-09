# DayBrief AI

**An AI-powered personal daily briefing built with TypeScript, Node.js and Microsoft Foundry.**

DayBrief AI brings together weather, Outlook inbox updates, Outlook calendar appointments and GitHub pull requests in one concise briefing. It is a hands-on learning project exploring **AI agents, tool calling, hosted tools, MCP, Microsoft Graph and multi-step orchestration**.

> **Current status — Milestone 9 complete:** The unified runner and four integrations have been exercised together. The application is run manually; unattended Azure hosting, daily 08:00 scheduling and briefing delivery are **not yet implemented** (planned for Milestone 10).

## What it does

| Integration          | What DayBrief retrieves                                                          | How it works                                | Status                               |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| **Weather**          | Current forecast for High Wycombe, UK, including temperature/rain when available | Foundry-hosted `web_search_preview`         | Integrated; search activity observed |
| **Outlook email**    | Five recent emails, grouped into key topics                                      | Node.js custom function → Microsoft Graph   | Integrated and tested                |
| **Outlook calendar** | Events for the briefing date, shown in UK local time                             | Node.js custom function → Microsoft Graph   | Integrated and tested                |
| **GitHub**           | Open pull requests in `naveen2451/DayBrief-AI`                                   | Foundry-hosted, read-only remote GitHub MCP | Integrated; MCP activity observed    |

The generated briefing uses five sections: **Weather**, **Outlook Emails**, **Calendar**, **GitHub** and **Action Items**. The prompt targets a briefing of fewer than 250 words, with at most three meaningful actions. The agent is instructed not to invent information.

## Architecture

```text
                 Manual run / integration test
                             |
                             v
                   TypeScript / Node.js
                     runDayBrief()
                             |
                Microsoft Foundry project
                             |
                  Prompt agent: daybrief-agent
                    Responses API
                             |
           +-----------------+-----------------+
           |                 |                 |
           v                 v                 v
   Hosted Web Search   Hosted GitHub MCP   Function-call schemas
           |                 |                 |
      Weather pages    GitHub MCP server    Foundry requests
                             |              named functions
                        Pull requests             |
                                                  v
                                        Node.js tool dispatcher
                                           /           \
                                          v             v
                                   Outlook emails   Outlook calendar
                                          \             /
                                           Microsoft Graph
                                                 |
                                     MSAL delegated authentication
                                                 |
                           function_call_output + matching call_id
                                                 |
                                                 v
                                        Foundry continues
                                                 |
                                                 v
                                        Final DayBrief summary
```

**Execution boundary:** Foundry runs hosted Web Search and GitHub MCP tools. For Outlook, Foundry only _requests_ a function; the Node.js runner executes it locally and submits the result. A function schema registered on the agent is not a deployed backend function.

## Technology stack

- **Language/runtime:** TypeScript, Node.js 22, `tsx`, ES modules (NodeNext)
- **AI:** Microsoft Foundry prompt agent, Azure OpenAI Responses API, `gpt-5-mini`
- **SDKs:** `@azure/ai-projects`, `openai`, `@azure/identity`
- **Microsoft 365:** Microsoft Graph, MSAL Node, `@azure/msal-node-extensions`
- **GitHub:** Remote Model Context Protocol (MCP), Foundry project connection with a repository-scoped token
- **Azure infrastructure:** Bicep, Azure CLI; development resources in UK South

## Project structure

```text
infra/
  main.bicep                      # Azure development infrastructure
src/
  agents/
    daybrief-agent.ts             # Foundry agent definition / tool registration
    daybrief-runner.ts            # Unified orchestration loop
    utils/
      function-call.ts            # Type guard for custom function calls
    tools/
      outlook.tool.ts             # Outlook email function schema
      github-mcp.tool.ts          # Hosted GitHub MCP configuration
  integrations/
    outlook/
      auth.ts                     # MSAL authentication and token cache
      outlook.service.ts          # Microsoft Graph inbox reads
      calendar.service.ts         # Microsoft Graph calendar reads
  tests/
    daybrief-integration.test.ts  # Unified integration test
    github-mcp-agent.test.ts      # Isolated GitHub MCP test
```

Other isolated tests and tool-schema files may also be present in the repository. See the source tree for the authoritative list.

## Getting started (local development)

### Prerequisites

1. Node.js 22 and npm.
2. Azure CLI, signed in to an account authorised for the Foundry project.
3. An existing Foundry project, deployed model and published `daybrief-agent`.
4. An Entra app registration supporting delegated Microsoft Graph access to a personal Outlook account.
5. A Foundry **Custom Keys** project connection for GitHub MCP, using a read-only, repository-scoped token.

### Install dependencies

```bash
npm install
az login
```

If you use the project's Python virtual environment for Azure CLI, activate it first:

```bash
source ~/.venvs/azure-cli/bin/activate
```

### Environment variables

Create a local `.env` file (do not commit it):

```dotenv
FOUNDRY_PROJECT_ENDPOINT=https://<foundry-account>.services.ai.azure.com/api/projects/<project-name>
FOUNDRY_MODEL=gpt-5-mini
FOUNDRY_AGENT_NAME=daybrief-agent
OUTLOOK_CLIENT_ID=<entra-app-client-id>
GITHUB_MCP_CONNECTION_ID=<full-foundry-project-connection-resource-id>
```

The GitHub PAT is stored in the **secret Authorization header of the Foundry connection**, not in application source code. The Outlook token cache is stored locally at `~/.daybrief-ai/outlook-cache.json`; protect it and never commit it.

### Publish/update the agent

```bash
npm run agent:create
```

The agent definition includes hosted Web Search, Outlook email/calendar function schemas and the read-only GitHub MCP tool. The currently tested agent was version 11; publishing a new version may change its behaviour, so rerun integration tests afterward.

### Run the unified integration test

```bash
npx tsx src/tests/daybrief-integration.test.ts
```

Expected integration indicators after a successful run:

```text
INTEGRATION CHECKS
Outlook email: PASS
Calendar: PASS
GitHub MCP: OBSERVED
Web search: OBSERVED
```

**Interpretation:** `PASS` confirms the corresponding Outlook handler ran. `OBSERVED` means the hosted tool call appeared in the Foundry response; it does not independently guarantee that the retrieved forecast or PR data was complete. Review the generated briefing for factual completeness as well.

> The unified runner currently uses Azure CLI credentials for local Foundry access and an interactive/cached delegated Outlook sign-in. This is **not yet suitable for unattended cloud scheduling**.

## How agent orchestration works

The runner sends an initial prompt to Foundry using `responses.create()`. Foundry may return a custom `function_call` rather than a finished briefing. The runner executes that function, returns a `function_call_output` with the same `call_id`, and asks Foundry to continue.

A simplified version of the core pattern:

```ts
let response = await openai.responses.create({
  conversation: conversation.id,
  input: prompt,
  tool_choice: "required",
  parallel_tool_calls: false,
  max_output_tokens: 7000,
});

const MAX_TOOL_ROUNDS = 6;

for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
  const calls = response.output.filter(isFunctionCall);
  if (calls.length === 0) break;

  const outputs = [];
  for (const call of calls) {
    const output = await executeAllowedFunction(call); // illustrative dispatcher
    outputs.push({
      type: "function_call_output" as const,
      call_id: call.call_id,
      output,
    });
  }

  response = await openai.responses.create({
    conversation: conversation.id,
    input: outputs, // Essential: send function results back
    parallel_tool_calls: false,
    max_output_tokens: 3000,
  });
}
```

`executeAllowedFunction` is pseudocode here: the actual runner dispatches the supported Outlook functions and validates their arguments.

**Outer loop vs inner loop:** The **outer loop** keeps the conversation going through successive Foundry responses. The **inner loop** handles all custom function calls in the _current_ response. Foundry does not announce the total number of future rounds in advance. The number `6` is an application-chosen safety limit, not a Foundry requirement. Each continuation replaces `response` with the newest Foundry response.

The production runner also includes:

- Validation of Outlook function arguments (including bounded email limits).
- A per-run cache keyed by function name and arguments to avoid repeated Graph reads.
- Checks for unfinished function calls and missing final text.
- Conversation cleanup in a `finally` block.
- Integration-execution tracking for tests.

### Tool selection settings

- **`tool_choice: "required"` on the initial request:** prevents the agent from immediately answering without requesting any tool. It does _not_ guarantee that all four integrations will run.
- **`parallel_tool_calls: false`:** asks the model to make sequential tool requests, which makes debugging easier.
- **No forced Outlook-only tool choice in the normal unified run:** the agent selects which available tool to call.

## Integration details

### 1. Weather — hosted web search

Foundry uses `web_search_preview` to look up the High Wycombe forecast. The model is instructed to provide a dated forecast, useful weather advice and sources when available, and to say when live weather cannot be obtained. Node.js does not implement a separate weather HTTP client.

### 2. Outlook email — custom function

The agent requests `get_outlook_emails`, typically with `limit: 5`. The Node.js handler authenticates through MSAL, calls Microsoft Graph and returns email data for summarisation. The integration is **read-only**: no sending, deleting or archiving.

### 3. Outlook calendar — custom function

The agent requests `get_outlook_calendar_events` with a start and end date. Node.js retrieves the events from Microsoft Graph and returns them for the UK-local-time briefing. Calendar access is **read-only**. Date/time-zone handling should be revalidated before unattended deployment.

### 4. GitHub — hosted remote MCP

The Foundry agent uses the remote GitHub MCP endpoint with a secret-bearing project connection. The current tool configuration is read-only and limited to pull-request tools, including `list_pull_requests`, `pull_request_read` and `search_pull_requests`. Restricting `allowed_tools` reduces exposed tool schemas and token overhead. GitHub PR #1 was successfully retrieved in isolated testing.

## Concepts explored

| Concept                       | Practical learning in DayBrief AI                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| **Prompt agents**             | Define agent instructions, model and tools in Microsoft Foundry                             |
| **Responses API**             | Start and continue model responses in a persistent conversation                             |
| **Function calling**          | Model requests a named function; application executes it                                    |
| **`call_id` correlation**     | Match every `function_call_output` to the originating call                                  |
| **Multi-round orchestration** | Continue until the model stops requesting custom functions                                  |
| **Hosted tools**              | Foundry operates Web Search and remote MCP without local dispatch                           |
| **MCP**                       | Standardised connection between the agent and GitHub tools                                  |
| **Tool schemas**              | Constrain callable names, arguments and available MCP capabilities                          |
| **Tool choice**               | Compare automatic, required and forced function selection                                   |
| **Sequential execution**      | Use `parallel_tool_calls: false` for predictable debugging                                  |
| **Token usage**               | Inspect prompt/tool-schema overhead, response tokens and rate limits                        |
| **Caching**                   | Reuse repeated tool results within a single briefing                                        |
| **Authentication**            | Azure CLI for local Foundry, delegated MSAL for Outlook, secret connection for GitHub       |
| **Least privilege**           | Read-only Graph access and repository-scoped GitHub permissions                             |
| **Guardrails**                | Validate arguments, limit rounds, avoid invented facts and treat external data as untrusted |
| **Integration testing**       | Distinguish executed custom functions from observed hosted tool calls                       |

## Troubleshooting lessons

**400 — `No tool output found for function call`**

The actual cause was a missing `input: outputs` property in the second `responses.create()` request. The Node.js logs showed that the function had executed, but SDK HTTP logging revealed that the tool result was absent from the outgoing request. Restoring the property resolved the error.

**Agent answered without using tools**

When tool choice was left automatic, some runs produced a response without any integration activity. Setting `tool_choice: "required"` on the initial request resolved this observed behaviour during testing. It does not replace integration verification.

**Repeated Outlook/calendar requests**

A bounded outer loop, `parallel_tool_calls: false`, and per-run tool-result caching help control repeated calls, latency and token usage.

**Hosted tool observed but incomplete summary**

An observed web search or MCP call does not necessarily mean useful information was returned. Inspect the final answer and, when necessary, the hosted tool results.

## Security and current limitations

- Never commit `.env`, GitHub tokens, Graph access tokens or MSAL token caches.
- Outlook and GitHub integrations are intentionally **read-only**.
- Treat email content, web pages and GitHub content as untrusted; do not follow instructions embedded in them.
- Local Azure CLI and cached delegated Outlook authentication are development choices, **not an unattended cloud authentication design**.
- The unified test validates orchestration, but it is not a full reliability, monitoring or data-quality test suite.
- Automated daily execution, retry/alerting, secure cloud authentication and delivery channels remain future work.

## Milestone progress

| Milestone / capability                                   | Status                   |
| -------------------------------------------------------- | ------------------------ |
| Azure infrastructure and Foundry project                 | Complete                 |
| Foundry prompt agent and model deployment                | Complete                 |
| Weather web search integration                           | Complete                 |
| Outlook email integration                                | Complete                 |
| Outlook calendar integration                             | Complete                 |
| GitHub remote MCP integration                            | Complete                 |
| **Milestone 9 — Unified runner and integration testing** | **Complete**             |
| **Milestone 10 — Production execution and scheduling**   | **Paused / not started** |

### Next: Milestone 10 (when resumed)

1. Establish a production application entry point.
2. Design secure unattended Outlook and Azure authentication.
3. Select an Azure hosting/scheduling service.
4. Schedule the briefing for **08:00 Europe/London** (including daylight-saving changes).
5. Add delivery, observability and failure handling.

---

**Project focus:** Learn practical AI engineering by integrating a real agent with external tools, rather than building a chatbot that only generates text.
