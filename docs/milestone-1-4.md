# DayBrief AI — Azure Infrastructure Setup

## 1. Activate Azure CLI environment

Azure CLI was installed using Python virtual environment on macOS.

```bash
source ~/.venvs/azure-cli/bin/activate
```

Verify installation:

```bash
az version
```

## 2. Login to Azure

```bash
az login
```

Verify the active subscription:

```bash
az account show --output table
```

List available subscriptions:

```bash
az account list --output table
```

## 3. Install Bicep CLI

```bash
az bicep install
```

Verify:

```bash
az bicep version
```

## 4. Create Azure Resource Group

```bash
az group create \
  --name rg-daybrief-dev \
  --location uksouth
```

Verify:

```bash
az group show \
  --name rg-daybrief-dev \
  --output table
```

## 5. Create Bicep Infrastructure File

Create the following file in the GitHub repository:

```text
infra/main.bicep
```

This file defines:

- Microsoft Foundry account
- Microsoft Foundry project
- System-assigned managed identities
- Resource location and configuration

## 6. Preview Infrastructure Deployment

```bash
az deployment group what-if \
  --resource-group rg-daybrief-dev \
  --template-file infra/main.bicep \
  --parameters foundryName=daybrief-ai-$(az account show --query id -o tsv | cut -c1-8)
```

## 7. Deploy Foundry Infrastructure

```bash
az deployment group create \
  --resource-group rg-daybrief-dev \
  --template-file infra/main.bicep \
  --parameters foundryName=daybrief-ai-$(az account show --query id -o tsv | cut -c1-8)
```

This creates the Foundry account and its project within `rg-daybrief-dev`.

## 8. Verify Deployed Resources

List resources:

```bash
az resource list \
  --resource-group rg-daybrief-dev \
  --output table
```

Check deployment status:

```bash
az deployment group list \
  --resource-group rg-daybrief-dev \
  --query "[].{Name:name, State:properties.provisioningState}" \
  --output table
```

## Infrastructure Summary

| Resource               | Value                               |
| ---------------------- | ----------------------------------- |
| Azure subscription     | Azure Free Account                  |
| Resource group         | `rg-daybrief-dev`                   |
| Region                 | `uksouth`                           |
| Foundry account        | `daybrief-ai-<subscription-prefix>` |
| Foundry project        | `daybrief-ai`                       |
| Infrastructure as Code | Bicep                               |
| Local authentication   | Azure CLI / Microsoft Entra ID      |
| Resource identity      | System-assigned managed identity    |

## Next Milestone

Deploy `gpt-5-mini` through Bicep, then connect the Foundry project to our TypeScript application using `DefaultAzureCredential`.

# DayBrief AI — Milestones 2 & 3

## Milestone 2 — Deploy Azure OpenAI Model

**Goal:** Deploy `gpt-5-mini` to Microsoft Foundry using Bicep.

### 1. Configure model deployment

Add the following resource to `infra/main.bicep`, after the existing Foundry resource and project definitions.

```bicep
@description('Azure OpenAI model deployment name')
param modelDeploymentName string = 'gpt-5-mini'

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundry
  name: modelDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: 1
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-5-mini'
      version: '2025-08-07'
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

output modelDeployment string = modelDeployment.name
```

### 2. Preview deployment

```bash
az deployment group what-if \
  --resource-group rg-daybrief-dev \
  --template-file infra/main.bicep \
  --parameters foundryName=daybrief-ai-$(az account show --query id -o tsv | cut -c1-8)
```

### 3. Deploy the model

```bash
az deployment group create \
  --resource-group rg-daybrief-dev \
  --template-file infra/main.bicep \
  --parameters foundryName=daybrief-ai-$(az account show --query id -o tsv | cut -c1-8)
```

### 4. Verify deployment

```bash
FOUNDRY_NAME=daybrief-ai-$(az account show --query id -o tsv | cut -c1-8)

az cognitiveservices account deployment list \
  --resource-group rg-daybrief-dev \
  --name "$FOUNDRY_NAME" \
  --output table
```

Expected model: `gpt-5-mini`.

---

## Milestone 3 — TypeScript Application & Foundry Connectivity

**Goal:** Connect a TypeScript application to Microsoft Foundry using Microsoft Entra authentication and execute the first model request.

### 1. Initialise Node.js project

Node.js 22 is used for development.

```bash
nvm use 22
npm init -y
```

### 2. Install dependencies

```bash
npm install @azure/ai-projects @azure/identity dotenv
npm install -D typescript tsx @types/node
```

### 3. Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

### 4. Configure environment variables

Create `.env`:

```env
FOUNDRY_PROJECT_ENDPOINT=https://YOUR-RESOURCE.services.ai.azure.com/api/projects/daybrief-ai
FOUNDRY_MODEL=gpt-5-mini
```

Replace the endpoint with your Foundry project endpoint.

Ensure `.gitignore` includes:

```gitignore
node_modules/
dist/
.env
```

### 5. Configure Azure RBAC

Assign the **Foundry User** role to the signed-in developer.

```bash
FOUNDRY_NAME=daybrief-ai-$(az account show --query id -o tsv | cut -c1-8)

FOUNDRY_ID=$(az cognitiveservices account show \
  --name "$FOUNDRY_NAME" \
  --resource-group rg-daybrief-dev \
  --query id -o tsv)

USER_ID=$(az ad signed-in-user show --query id -o tsv)
```

Assign role:

```bash
az role assignment create \
  --assignee-object-id "$USER_ID" \
  --assignee-principal-type User \
  --role "53ca6127-db72-4b80-b1b0-d745d6d5456d" \
  --scope "$FOUNDRY_ID"
```

Verify:

```bash
az role assignment list \
  --assignee "$USER_ID" \
  --scope "$FOUNDRY_ID" \
  --query "[].{Role:roleDefinitionName,Scope:scope}" \
  --output table
```

### 6. Create connectivity test

Create `src/tests/foundry-connectivity.ts`:

```typescript
import "dotenv/config";
import { AzureCliCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

async function main(): Promise<void> {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  const model = process.env.FOUNDRY_MODEL;

  if (!endpoint || !model) {
    throw new Error("Missing Foundry configuration");
  }

  const project = new AIProjectClient(endpoint, new AzureCliCredential());

  const openai = project.getOpenAIClient();

  const response = await openai.responses.create({
    model,
    input: "Introduce yourself as DayBrief AI in one sentence.",
    store: false,
  });

  console.log("AI response:", response.output_text);
  console.log("Token usage:", response.usage);
}

main().catch(console.error);
```

### 7. Add npm scripts

```bash
npm pkg set 'scripts.test:connection=tsx src/tests/foundry-connectivity.ts'
npm pkg set 'scripts.typecheck=tsc --noEmit'
```

### 8. Execute connectivity test

Activate Azure CLI:

```bash
source ~/.venvs/azure-cli/bin/activate
az account show --output table
```

Run:

```bash
npm run test:connection
```

Expected result:

```text
AI response: Hello! I'm DayBrief AI...

Token usage: {
  input_tokens: ...,
  output_tokens: ...,
  total_tokens: ...
}
```

### 9. Validate TypeScript

```bash
npm run typecheck
```

### 10. Commit changes to GitHub

```bash
git add .
git commit -m "Complete Foundry model deployment and connectivity test"
git push
```

---

## Completed Architecture

```text
MacBook / VS Code
       |
       v
TypeScript application
       |
       v
AzureCliCredential
       |
       v
Microsoft Entra ID
       |
       v
Microsoft Foundry Project
       |
       v
gpt-5-mini (Global Standard)
       |
       v
AI response + token usage
```

## Current Project Structure

```text
DayBrief-AI/
├── infra/
│   └── main.bicep
├── src/
│   └── tests/
│       └── foundry-connectivity.ts
├── .env
├── .gitignore
├── .nvmrc
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

## Milestone Status

| Milestone                              | Status    |
| -------------------------------------- | --------- |
| 1. Azure infrastructure provisioning   | Completed |
| 2. Azure OpenAI model deployment       | Completed |
| 3. TypeScript connectivity test        | Completed |
| 4. Foundry Agent creation              | Next      |
| 5. Web Search for weather              | Pending   |
| 6. Google MCP integration              | Pending   |
| 7. Outlook connector integration       | Pending   |
| 8. Daily scheduling and email delivery | Pending   |

**Next:** Create the `daybrief-agent` through the Microsoft Foundry TypeScript SDK and test its instructions and responses.
