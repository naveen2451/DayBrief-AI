# DayBrief AI — Milestone 9: GitHub MCP Integration

**Status:** Complete — GitHub pull-request summary successfully tested  
**Stack:** TypeScript, Node.js, Microsoft Foundry, GitHub Remote MCP

## Objective

Connect the DayBrief AI agent to GitHub through a **Foundry-hosted remote Model Context Protocol (MCP) tool** rather than implementing GitHub REST calls in the Node.js application.

The current connection is read-only. We verified retrieval of an open pull request and a readable summary. Broader review queues, comments, and failing checks are planned use cases, not yet individually verified.

## Architecture

```text
Node.js / TypeScript test (future unified runner)
          |
          v
Foundry Agent: daybrief-agent
          |
          +-- Web search (weather)
          +-- Custom function calls (Outlook email and calendar)
          +-- Remote MCP: github
                    |
                    +-- Foundry project connection
                    |   github-mcp-connection
                    |   Secret Authorization header
                    v
             GitHub Remote MCP server
             https://api.githubcopilot.com/mcp/readonly
                    |
                    v
             GitHub pull requests
```

## 1. Authentication and Foundry connection

Created a fine-grained GitHub personal access token with repository-scoped, read-only permissions. The token must never be committed or logged.

In Microsoft Foundry, created a **Custom Keys** connection:

| Field | Value |
|---|---|
| Connection name | `github-mcp-connection` |
| Key name | `Authorization` |
| Key value | `Bearer <GITHUB_PAT>` |
| Is Secret | Checked |

The remote MCP server URL is configured in the tool definition, not in this Custom Keys connection.

Verified the project connection using:

```bash
az rest \
  --method GET \
  --resource "https://ai.azure.com" \
  --url "${FOUNDRY_PROJECT_ENDPOINT}/connections?api-version=2025-11-15-preview" \
  --query "value[].{name:name,id:id}" \
  --output json
```

> The shell must have `FOUNDRY_PROJECT_ENDPOINT` exported before running the command; `.env` is not automatically loaded by Azure CLI.

## 2. Environment configuration

Store the environment-specific Foundry connection resource ID in the gitignored `.env` file:

```dotenv
GITHUB_MCP_CONNECTION_ID=/subscriptions/<subscription-id>/resourceGroups/rg-daybrief-dev/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>/projects/daybrief-ai/connections/github-mcp-connection
```

This is a resource identifier, not the GitHub token. Avoid hardcoding subscription and resource IDs in TypeScript.

## 3. MCP tool definition

**File:** `src/agents/tools/github-mcp.tool.ts`

```ts
export const githubMcpTool = {
  type: "mcp" as const,
  server_label: "github",
  server_url: "https://api.githubcopilot.com/mcp/readonly",
  require_approval: "never" as const,
  project_connection_id: process.env.GITHUB_MCP_CONNECTION_ID!,
};
```

`require_approval: "never"` is appropriate only for the current intentionally read-only configuration. Revisit approvals if write-capable MCP tools or broader token permissions are introduced.

## 4. Register GitHub MCP with the agent

**File:** `src/agents/daybrief-agent.ts`

Import `githubMcpTool` and include it in the tools passed to `project.agents.createVersion(...)`, alongside web search and the existing Outlook custom functions.

Add instructions that tell the agent to:

- Summarise PRs in readable text, grouped by repository.
- Include PR number, title, status, and link.
- Highlight items needing attention.
- Use `html_url` (not `url`) when selecting `list_pull_requests` fields.
- Avoid any write operations or disclosure of credentials.

## 5. Test

**File:** `src/tests/github-mcp-agent.test.ts`

The test uses `AIProjectClient` and `AzureCliCredential`, invokes the published agent via the Responses API, asks for open PRs in `naveen2451/DayBrief-AI`, prints `response.output_text`, and deletes the conversation afterward.

```bash
npm run typecheck
npm run agent:create
npx tsx src/tests/github-mcp-agent.test.ts
```

**Verified result:** A human-readable pull-request summary was returned successfully.

## 6. Issues encountered and resolutions

### MCP approval requested; no final summary

Diagnostic output included `mcp_list_tools`, `reasoning`, and `mcp_approval_request`, while `response.output_text` was empty.

**Cause:** The initial tool configuration used `require_approval: "always"`.

**Resolution:** For the read-only endpoint, changed it to `"never"`, republished the agent, and retried. If approval is required in future, the runner must explicitly handle approval responses instead.

### `list_pull_requests` rejected the `url` field

The MCP schema accepted `html_url` but not `url` in its `fields` list.

**Resolution:** Updated agent instructions to request `html_url` and other schema-supported fields. This demonstrates why agent-generated arguments must follow MCP tool schemas.

### HTTP 429 from `gpt-5-mini`

The Foundry model deployment initially had **10K TPM** capacity. The agent's model/tool workload hit the rate limit.

**Resolution:** Increased the Global Standard deployment capacity in `infra/main.bicep`:

```bicep
sku: {
  name: 'GlobalStandard'
  capacity: 30
}
```

Redeployed the existing infrastructure:

```bash
source ~/.venvs/azure-cli/bin/activate

az deployment group validate \
  --resource-group rg-daybrief-dev \
  --template-file infra/main.bicep \
  --parameters foundryName=daybrief-ai-1d47d645

az deployment group create \
  --name daybrief-infra-update \
  --resource-group rg-daybrief-dev \
  --template-file infra/main.bicep \
  --parameters foundryName=daybrief-ai-1d47d645 \
  --output table
```

The PR summary worked after this change. A larger TPM limit does not replace bounded retries and `Retry-After` handling in production. Global Standard model charges are usage-based; a larger limit can permit higher spending if traffic increases.

## Verification checklist

- [x] Fine-grained GitHub PAT created
- [x] Foundry Custom Keys connection created with secret Authorization value
- [x] Foundry connection ID retrieved and configured via `.env`
- [x] Remote GitHub MCP tool registered in the agent
- [x] MCP discovery verified
- [x] MCP approval behaviour diagnosed and configured
- [x] Unsupported `url` field corrected to `html_url`
- [x] Deployment capacity updated via Bicep
- [x] Readable GitHub PR summary verified

## Key learning: MCP versus custom function calling

**Outlook:** The model requests a custom function; the Node.js application executes Microsoft Graph calls and returns tool results.

**GitHub:** Foundry discovers and invokes tools on the remote GitHub MCP server using a project connection. No GitHub REST integration is needed in the Node.js application.

Both tool styles can coexist within the same agent.

## Next milestone: Unified DayBrief runner

Build `src/agents/daybrief-runner.ts` to combine weather, Outlook email, Outlook calendar, and GitHub into one concise daily briefing. Add bounded tool rounds, retry/backoff, useful error handling, and eventually scheduling for **08:00 Europe/London**.

**Important:** Unattended cloud execution will need an appropriate Outlook authentication/token strategy; the current device-code login flow is primarily suited to local development.
