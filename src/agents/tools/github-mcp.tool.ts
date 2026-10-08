export const githubMcpTool = {
  type: "mcp" as const,
  server_label: "github",
  server_url:
    "https://api.githubcopilot.com/mcp/readonly?toolsets=pull_requests",
  require_approval: "never" as const,
  project_connection_id: process.env.GITHUB_MCP_CONNECTION_ID!,
  allowed_tools: [
    "list_pull_requests",
    "pull_request_read",
    "search_pull_requests",
  ], //added this to restrict the tools that foundary exposes to agent..to limit the token consumeotion
};
