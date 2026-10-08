import "dotenv/config";
import { Client } from "@microsoft/microsoft-graph-client";
import { getOutlookAccessToken } from "./auth.js";

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location: string;
  isAllDay: boolean;
  isCancelled: boolean;
}

interface GraphCalendarEvent {
  id?: string;
  subject?: string;
  start?: {
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    timeZone?: string;
  };
  location?: {
    displayName?: string;
  };
  isAllDay?: boolean;
  isCancelled?: boolean;
}

export async function getOutlookCalendarEvents(
  startDate: string,
  endDate: string
): Promise<OutlookCalendarEvent[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start >= end
  ) {
    throw new Error("Invalid calendar date range");
  }

  const accessToken = await getOutlookAccessToken();

  const graphClient = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const result = await graphClient
    .api("/me/calendarView")
    .query({
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
    })
    .header("Prefer", 'outlook.timezone="Europe/London"')
    .select("id,subject,start,end,location,isAllDay,isCancelled")
    .orderby("start/dateTime")
    .top(50)
    .get();

  const events: GraphCalendarEvent[] = result.value ?? [];

  return events
    .filter((event) => !event.isCancelled)
    .map((event) => ({
      id: event.id ?? "",
      subject: event.subject ?? "Untitled event",
      start: event.start?.dateTime ?? "",
      end: event.end?.dateTime ?? "",
      location: event.location?.displayName ?? "",
      isAllDay: event.isAllDay ?? false,
      isCancelled: event.isCancelled ?? false,
    }));
}
