import "dotenv/config";
import { Client } from "@microsoft/microsoft-graph-client";
import { getOutlookAccessToken } from "./auth.js";

export interface OutlookEmail {
  subject: string;
  from: string;
  receivedDateTime: string;
  isRead: boolean;
  bodyPreview: string;
}

export async function getOutlookEmails(
  limit: number = 5
): Promise<OutlookEmail[]> {
  const accessToken = await getOutlookAccessToken();

  const graphClient = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const result = await graphClient
    .api("/me/mailFolders/inbox/messages")
    .select("subject,from,receivedDateTime,isRead,bodyPreview")
    .orderby("receivedDateTime DESC")
    .top(Math.min(Math.max(limit, 1), 10))
    .get();

  return (result.value ?? []).map(
    (email: {
      subject?: string;
      from?: {
        emailAddress?: {
          address?: string;
        };
      };
      receivedDateTime?: string;
      isRead?: boolean;
      bodyPreview?: string;
    }): OutlookEmail => ({
      subject: email.subject ?? "",
      from: email.from?.emailAddress?.address ?? "",
      receivedDateTime: email.receivedDateTime ?? "",
      isRead: email.isRead ?? false,
      bodyPreview: email.bodyPreview ?? "",
    })
  );
}
