import { getOutlookEmails } from "../integrations/outlook/outlook.service.js";

async function main(): Promise<void> {
  const emails = await getOutlookEmails(5);

  console.log("\nOUTLOOK SERVICE RESULT\n");
  console.log(JSON.stringify(emails, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
