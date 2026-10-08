import "dotenv/config";
import { PublicClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

async function main(): Promise<void> {
  const clientId = process.env.OUTLOOK_CLIENT_ID;

  if (!clientId) {
    throw new Error("OUTLOOK_CLIENT_ID is missing");
  }

  const msalClient = new PublicClientApplication({
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/consumers",
    },
  });

  const auth = await msalClient.acquireTokenByDeviceCode({
    scopes: ["User.Read", "Mail.Read"],
    deviceCodeCallback: (response) => {
      console.log(response.message);
    },
  });

  if (!auth) {
    throw new Error("Outlook authentication failed");
  }

  const graphClient = Client.init({
    authProvider: (done) => {
      done(null, auth.accessToken);
    },
  });

  const result = await graphClient
    .api("/me/mailFolders/inbox/messages")
    .select("id,subject,from,receivedDateTime,isRead")
    .orderby("receivedDateTime DESC")
    .top(5)
    .get();

  console.log("\nLATEST OUTLOOK EMAILS\n");

  for (const email of result.value ?? []) {
    console.log({
      subject: email.subject,
      from: email.from?.emailAddress?.address,
      received: email.receivedDateTime,
      isRead: email.isRead,
    });
  }

  console.log("\nTotal retrieved:", result.value?.length ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
