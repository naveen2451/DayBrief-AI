import { runDayBrief } from "../agents/daybrief-runner.js";

async function main(): Promise<void> {
  const result = await runDayBrief();

  console.log("\n☀️ DAYBRIEF AI");
  console.log("════════════════════════════════════");
  console.log(result.summary);

  console.log("\nINTEGRATION CHECKS");
  console.log("Outlook email:", result.emailCalled ? "PASS" : "FAIL");
  console.log("Calendar:", result.calendarCalled ? "PASS" : "FAIL");

  console.log(
    "GitHub MCP:",
    result.outputTypes.includes("mcp_call") ? "PASS" : "NOT OBSERVED"
  );

  console.log(
    "Web search:",
    result.outputTypes.includes("web_search_call") ? "PASS" : "NOT OBSERVED"
  );

  if (!result.emailCalled || !result.calendarCalled) {
    throw new Error("One or more Outlook integrations were not executed");
  }

  if (!result.outputTypes.includes("mcp_call")) {
    throw new Error("GitHub MCP execution was not observed");
  }

  if (!result.outputTypes.includes("web_search_call")) {
    throw new Error("Weather web search was not observed");
  }

  console.log("\nDAYBRIEF INTEGRATION TEST PASSED");
}

main().catch((error) => {
  console.error("\nTest failed:", error);
  process.exitCode = 1;
});
