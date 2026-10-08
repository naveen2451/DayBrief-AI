export const outlookEmailTool = {
  type: "function" as const,
  name: "get_outlook_emails",
  description:
    "Retrieve recent emails from the user's personal Outlook inbox. Read-only. Use when the user requests an email briefing or summary.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "Number of recent emails to retrieve, from 1 to 10.",
      },
    },
    required: ["limit"],
    additionalProperties: false,
  },
  strict: true,
};
