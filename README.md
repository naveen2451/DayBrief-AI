# DayBrief AI

DayBrief AI is a **code-first personal AI assistant** built using **TypeScript, Microsoft Foundry and Azure OpenAI**.

The application runs every morning at **08:00 Europe/London** and generates a personalised daily briefing using:

- Current weather and useful recommendations
- Personal Gmail emails
- Google Calendar events
- Personal Outlook emails
- Outlook Calendar events

V1 is **read-only**. Future versions will support controlled actions such as drafting emails and scheduling meetings.

---

## Architecture

```text id="s07wby"
                     Foundry Routine
                  08:00 Europe/London
                           │
                           ▼
                  ┌──────────────────┐
                  │ DayBrief Agent   │
                  │ Microsoft       │
                  │ Foundry         │
                  └────────┬─────────┘
                           │
                    Azure OpenAI
                           │
                    Tool Selection
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
     Web Search           MCP          Managed Connector
          │                │                │
          ▼                ▼                ▼
       Weather        Google MCP         Microsoft
                         │                Services
                    ┌────┴────┐       ┌────┴────┐
                    ▼         ▼       ▼         ▼
                  Gmail    Google   Outlook   Outlook
                           Calendar            Calendar

          └────────────────┬────────────────┘
                           │
                           ▼
                    Agent Reasoning
                           │
                           ▼
                    Daily Briefing
                           │
                           ▼
                       Email
```

### Integration Strategy

| Requirement | Approach | Purpose |
|---|---|---|
| Weather | Foundry Web Search | Live web grounding |
| Gmail | MCP | Learn MCP integration |
| Google Calendar | MCP | Learn MCP tools |
| Outlook | Managed connector | Learn managed integrations |
| Outlook Calendar | Managed connector | Learn managed integrations |

This deliberately uses different integration approaches to explore **Web Search, MCP and managed connectors** within the same agent.

---

## Code-First Approach

The agent is configured and deployed using **TypeScript and Microsoft Foundry SDKs**.

```text id="3srd45"
TypeScript Repository
        │
        ▼
Foundry SDK
        │
        ├── Configure Agent
        ├── Configure Azure OpenAI Model
        ├── Configure Tools
        ├── Configure Connections
        └── Configure 08:00 Routine
        │
        ▼
Microsoft Foundry
```

The Foundry-hosted routine runs independently, so the development machine does not need to remain online.

---

## Authentication & Security

### Local Development

```text id="0dxfxq"
Developer
   │
 az login
   │
   ▼
DefaultAzureCredential
   │
   ▼
Microsoft Entra ID
   │
   ▼
Azure RBAC
```

No Azure credentials are stored in source code.

### Azure Runtime

```text id="6gx90f"
Azure Workload
      │
      ▼
Managed Identity
      │
      ▼
Microsoft Entra ID
      │
      ▼
Azure RBAC
      │
      ├── Foundry
      └── Key Vault
```

Azure resources use **Managed Identity + RBAC** rather than long-lived API keys wherever possible.

### External Accounts

Personal Gmail and Outlook access use **OAuth 2.0 delegated authentication**.

Each user authenticates using their own account:

```text id="0g5l6i"
User
 │
 ├── Google OAuth
 │      ├── Gmail Read
 │      └── Calendar Read
 │
 └── Microsoft OAuth
        ├── Mail.Read
        └── Calendars.Read
```

V1 follows the **principle of least privilege** and requests read-only permissions.

Application secrets that genuinely need to exist are stored in **Azure Key Vault**.

Credentials are never placed in:

- Source code
- Git
- Agent prompts
- LLM context

The LLM decides **which tool to call**, while authentication and authorization happen outside the model at the integration boundary.

---

## Multi-User Design

The initial POC is for a single user, but authentication is designed to support multiple users.

```text id="0s4p0u"
                  DayBrief
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      User A       User B       User C
        │            │            │
     OAuth A       OAuth B       OAuth C
        │            │            │
   Personal Data Personal Data Personal Data
```

Each user grants access to their own Gmail, Outlook and calendar accounts.

Shared credentials are not used to access personal data.

---

## Observability & Cost

DayBrief tracks:

```text id="r5i98u"
Agent executions
Tool calls
Input tokens
Output tokens
Latency
Failures
Model usage
Estimated cost
```

Using:

- Foundry tracing
- Application Insights
- Azure Monitor
- Azure Cost Management

Since DayBrief normally runs once per day, the architecture uses **pay-as-you-go model consumption** rather than provisioned throughput.

---

## Concepts Covered

This POC demonstrates:

**AI**
- Azure OpenAI
- Microsoft Foundry
- AI Agents
- Prompt engineering
- Tool/function calling
- Structured outputs

**Agent Integrations**
- Web Search / grounding
- MCP
- Managed connectors
- OAuth-protected tools

**Security**
- OAuth 2.0
- Managed Identity
- Azure RBAC
- Azure Key Vault
- Least privilege
- User-context authentication

**Production AI**
- Scheduled agent execution
- Tracing
- Token monitoring
- Cost monitoring
- Failure handling
- Multi-user architecture

---

## Future Enhancements

V1:

```text id="38sp9m"
READ
├── Weather
├── Gmail
├── Google Calendar
├── Outlook
└── Outlook Calendar
```

Future:

```text id="fnx4k2"
ACTION
├── Create email draft
├── Prepare reply
├── Schedule meeting
├── Create reminder
└── Human approval before execution
```

RAG, embeddings, vector search and reranking are intentionally excluded from this POC and will be explored separately where they solve an appropriate retrieval problem.

---

## Technology Stack

```text id="q9d1u7"
Language        TypeScript
AI Platform     Microsoft Foundry
Model           Azure OpenAI
Agent           Foundry Agent Service
Scheduling      Foundry Routine
Public Data     Web Search
Google          MCP
Microsoft       Managed Connector
Secrets         Azure Key Vault
Identity        Entra ID / Managed Identity
Authorization   Azure RBAC
User Auth       OAuth 2.0
Monitoring      Application Insights / Azure Monitor
```

## Interview Summary

> DayBrief AI is a code-first agentic AI application I built using TypeScript, Microsoft Foundry and Azure OpenAI. A scheduled Foundry agent generates a daily briefing using live weather, Gmail, Outlook and calendar information.
>
> I deliberately used three integration patterns: Web Search for live public information, MCP for Google services and managed connectors for Microsoft services.
>
> The security architecture uses OAuth for personal accounts, Managed Identity and RBAC for Azure resources, and Key Vault for secrets. Credentials are never exposed to the LLM.
>
> The project also includes production concerns such as scheduling, tracing, token and cost monitoring, least-privilege access and a design that can later support multiple users and controlled agent actions.

Change  to test the PR
