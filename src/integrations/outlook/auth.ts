import "dotenv/config";
import {
  PublicClientApplication,
  type AuthenticationResult,
} from "@azure/msal-node";
import {
  PersistenceCreator,
  PersistenceCachePlugin,
} from "@azure/msal-node-extensions";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const scopes = ["User.Read", "Mail.Read"];

let msalClient: PublicClientApplication | undefined;

async function getMsalClient(): Promise<PublicClientApplication> {
  if (msalClient) {
    return msalClient;
  }

  const clientId = process.env.OUTLOOK_CLIENT_ID;

  if (!clientId) {
    throw new Error("OUTLOOK_CLIENT_ID is missing");
  }

  const cacheDirectory = path.join(os.homedir(), ".daybrief-ai");

  fs.mkdirSync(cacheDirectory, {
    recursive: true,
    mode: 0o700,
  });

  const persistence = await PersistenceCreator.createPersistence({
    cachePath: path.join(cacheDirectory, "outlook-cache.json"),
    dataProtectionScope: "CurrentUser",
    serviceName: "DayBrief-AI",
    accountName: "Outlook",
  });

  const cachePlugin = new PersistenceCachePlugin(persistence);

  msalClient = new PublicClientApplication({
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/consumers",
    },
    cache: {
      cachePlugin,
    },
  });

  return msalClient;
}

export async function getOutlookAccessToken(): Promise<string> {
  const client = await getMsalClient();

  const accounts = await client.getTokenCache().getAllAccounts();

  if (accounts.length > 0) {
    try {
      const result = await client.acquireTokenSilent({
        account: accounts[0],
        scopes,
      });

      console.log("Outlook: using cached authentication");
      return result.accessToken;
    } catch {
      console.log(
        "Outlook: cached authentication unavailable; signing in again"
      );
    }
  }

  const result: AuthenticationResult | null =
    await client.acquireTokenByDeviceCode({
      scopes,
      deviceCodeCallback: (response) => {
        console.log(response.message);
      },
    });

  if (!result) {
    throw new Error("Outlook authentication failed");
  }

  console.log("Outlook: authentication successful");

  return result.accessToken;
}
