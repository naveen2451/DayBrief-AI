export const githubMcpTool = {
  type: "mcp" as const,
  server_label: "github",
  server_url: "https://api.githubcopilot.com/mcp/readonly",
  require_approval: "never" as const,
  project_connection_id: process.env.GITHUB_MCP_CONNECTION_ID!,
};
