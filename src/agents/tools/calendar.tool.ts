export const outlookCalendarTool = {
  type: "function" as const,
  name: "get_outlook_calendar_events",
  description:
    "Retrieve events from the user's personal Outlook calendar " +
    "within a specified date range. Read-only. " +
    "Use when the user asks about upcoming meetings, appointments, " +
    "calendar events, or their daily schedule.",
  parameters: {
    type: "object",
    properties: {
      startDate: {
        type: "string",
        description:
          "Start of the date range as an ISO 8601 timestamp with timezone offset.",
      },
      endDate: {
        type: "string",
        description:
          "End of the date range as an ISO 8601 timestamp with timezone offset.",
      },
    },
    required: ["startDate", "endDate"],
    additionalProperties: false,
  },
  strict: true,
};
