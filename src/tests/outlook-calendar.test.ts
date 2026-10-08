import { getOutlookCalendarEvents } from "../integrations/outlook/calendar.service.js";

async function main(): Promise<void> {
  const start = new Date();
  const end = new Date(start);

  end.setUTCDate(end.getUTCDate() + 7);

  const events = await getOutlookCalendarEvents(
    start.toISOString(),
    end.toISOString()
  );

  console.log(`Retrieved ${events.length} calendar events`);

  for (const event of events) {
    console.log({
      subject: event.subject,
      start: event.start,
      end: event.end,
      location: event.location,
      isAllDay: event.isAllDay,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
