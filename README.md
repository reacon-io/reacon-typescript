# Reacon TypeScript and JavaScript SDK

Package `@reacon-io/sdk`, version `2.0.12-beta.1`.

Minimum runtime: **Node.js 20**.

[API reference and SDK examples](https://docs.reacon.io). Select your language on an endpoint page for SDK calls and response schemas.

The SDK connects to `https://api.reacon.io`. The API address is built in and cannot be overridden. Configure your API key as shown in your language’s examples; do not pass a base URL.

API keys are secrets. Load your key from an environment variable or secret manager and pass it through the SDK authentication configuration. Do not commit keys or include them in browser or mobile application bundles. The examples use `REACON_API_KEY`; the SDK does not load this environment variable automatically.

SDK package versions and API path versions are separate. The generated methods already select their API paths; do not derive an API path such as `/v2` from the package’s major version.

For reproducible deployments, commit your dependency lockfile or pin the package version in your build configuration. Review the API reference and run your application’s integration tests before upgrading the SDK.

## Installation

```sh
npm install @reacon-io/sdk@2.0.12-beta.1
```


A TypeScript SDK client for the api.reacon.io API.

## Usage and request behavior

The package supports Node.js 20 or later, CommonJS, and ES modules. TypeScript
declarations are included. After installing `@reacon-io/sdk`, configure a client:

```ts
import {
  Configuration, DomainsApi, ResponseError, ReaconRequestTimeoutError,
  ReaconRequestAbortedError, ReaconTransportError, ReaconResponseDecodeError,
} from '@reacon-io/sdk';

const client = new DomainsApi(new Configuration({
  apiKey: 'YOUR_API_KEY',
  requestTimeoutMs: 30_000,
}));
const cancellation = new AbortController();

async function readCounts() {
  try {
    return await client.getDomainCounts({ domain: 'example.com' }, {
      timeoutMs: 5_000,
      signal: cancellation.signal,
    });
  } catch (error) {
    if (error instanceof ResponseError) {
      // Inspect status, code, requestId, headers and body to handle API errors.
      // Credit information remains available in the response body and headers.
      if (error.status === 402) throw error;
    } else if (error instanceof ReaconRequestTimeoutError) {
      // The deadline elapsed; a billable or mutating request may have completed.
    } else if (error instanceof ReaconRequestAbortedError) {
      // The caller cancelled the request.
    } else if (error instanceof ReaconTransportError) {
      // A connection failed before the complete response was received.
    } else if (error instanceof ReaconResponseDecodeError) {
      // The successful response had malformed JSON or an unexpected media type.
    }
    throw error;
  }
}

// Call cancellation.abort() to cancel a pending request.
void readCounts;
```

Every generated JSON/CSV request uses a 30-second default network deadline,
including response-body reads. Set `Configuration.requestTimeoutMs` for a client
or pass `timeoutMs` in an operation's second argument. Values must be positive
milliseconds, at most 2147483647. `signal` accepts an `AbortSignal`. For `Raw`
methods, consume the response body within the deadline or explicitly cancel it.

The SDK defaults to one fetch call and never follows redirects. HTTP methods
alone do not determine retry safety: some GET operations spend
credits. A lost response does not prove that the operation failed on the server.
Injected fetch implementations and middleware must preserve this policy; caller
code that issues another fetch can otherwise replay an operation.

To opt into retries for audited reads, configure `safeRetries: { maxRetries: 2 }`
on `Configuration` or `Reacon`, or pass `retry: { maxRetries: 2 }` to a generated
method. `retry: false` disables them per request. Only `getApiKeyIdentity`,
`getDomainCounts` and `listLeads` are currently audited. Client-wide settings
leave every other operation at one attempt; requesting retries explicitly on
an unaudited operation raises `ReaconRetryPolicyError` before transmission.

At most three additional attempts are allowed, and only for HTTP 429, 502, 503
and 504. Transport failures, interrupted bodies and decoding failures are never
retried. Backoff doubles with jitter, starting at `baseDelayMs` (default 100)
and capped by `maxDelayMs` (default 2000, maximum 60000). A valid `Retry-After`
seconds value or HTTP date is a minimum wait. If that wait exceeds the delay cap
or remaining total deadline, the SDK returns the last HTTP error instead of
retrying sooner. Cancellation interrupts backoff. The original total deadline
covers every attempt, wait and final body read.

`ResponseError` keeps the original readable `response`, the parsed JSON body
(or original text), status, headers, request ID when present, and flat or nested
API error code when present. `Retry-After` is available in headers, without a
default retry. A malformed successful JSON response raises
`ReaconResponseDecodeError` with its status, headers and text body.

Streaming uses the separate `Reacon` helper and its idle/total timeout options;
`requestTimeoutMs` applies to generated JSON/CSV methods.

### Bounded, lazy pagination

`Reacon.leads.pages()` / `.items()`, `Reacon.emails.pages()` / `.items()`, and
`Reacon.emails.mentionPages()` / `.mentionItems()` return async iterators. Requests
start when you iterate; breaking the loop never prefetches another page. Original
one-page methods remain available. Iterator parameters preserve filters, sort,
grouping, and header-cursor precedence. They reject offset pagination, detect
repeated cursors, and continue through empty pages when a next cursor exists.

Defaults are at most 100 pages and 10,000 items. Set `maxPages` / `maxItems` to
smaller bounds (zero sends no requests). Each request is capped to the remaining
item bound. `signal` cancels a request or further iteration; `timeoutMs` bounds
each page's network request, including body reads.

Email listing can spend credits on every page. Use `onlyIfFree: 'true'`, or pass
`allowPaidRequests: true` explicitly to acknowledge those charges. Request/item
bounds are not monetary spending caps. Failures propagate without retries.
Iterators explicitly disable client-wide safe retries to keep their request
counts within the specified page bound. Streaming also never retries or reconnects.

```ts
import { Reacon } from '@reacon-io/sdk';
const sdk = new Reacon({ apiKey: 'YOUR_API_KEY' });
async function listContacts(teamId: string) {
  for await (const lead of sdk.leads.items({ teamId, limit: 50 }, { maxItems: 100 })) {
    console.log(lead.email);
  }
}
void listContacts;
```

## Documentation

### API Endpoints

All URIs are relative to *https://api.reacon.io*

| Class | Method | HTTP request | Description
| ----- | ------ | ------------ | -------------
*CompaniesApi* | [**listCompanies**](https://docs.reacon.io/api-reference/listCompanies) | **GET** /v1/companies | List companies
*DomainsApi* | [**getDomainCatchAll**](https://docs.reacon.io/api-reference/getDomainCatchAll) | **GET** /v1/domains/{domain}/catch-all | Read domain catch-all status
*DomainsApi* | [**getDomainCompanyContext**](https://docs.reacon.io/api-reference/getDomainCompanyContext) | **GET** /v1/domains/{domain}/company-context | Get company context for a domain
*DomainsApi* | [**getDomainCounts**](https://docs.reacon.io/api-reference/getDomainCounts) | **GET** /v1/domains/{domain}/counts | Count known emails for a domain
*EmailsApi* | [**deleteEmail**](https://docs.reacon.io/api-reference/deleteEmail) | **DELETE** /v1/emails/{email} | Delete an email and its mentions
*EmailsApi* | [**listEmailMentions**](https://docs.reacon.io/api-reference/listEmailMentions) | **GET** /v1/emails/{email}/mentions | List sources mentioning an email
*EmailsApi* | [**listEmails**](https://docs.reacon.io/api-reference/listEmails) | **GET** /v1/emails | List and reveal emails for a domain
*EmailsApi* | [**revealEmail**](https://docs.reacon.io/api-reference/revealEmail) | **GET** /v1/emails/{email} | Reveal an email profile
*EmailsApi* | [**revealEmailById**](https://docs.reacon.io/api-reference/revealEmailById) | **GET** /v1/emails/id/{id} | Reveal an email profile by ID
*IdentityApi* | [**getApiKeyIdentity**](https://docs.reacon.io/api-reference/getApiKeyIdentity) | **GET** /v1/whoami | Get API-key identity
*InsightsApi* | [**getEmailInsights**](https://docs.reacon.io/api-reference/getEmailInsights) | **GET** /v1/insights/{email} | Extract insights associated with an email
*IntegrationsApi* | [**bindTypeformForm**](https://docs.reacon.io/api-reference/bindTypeformForm) | **POST** /v1/teams/{teamId}/integrations/typeform/oauth/bind | Bind a Typeform OAuth form
*IntegrationsApi* | [**bindWebflowForm**](https://docs.reacon.io/api-reference/bindWebflowForm) | **POST** /v1/teams/{teamId}/integrations/webflow/oauth/bind | Bind a Webflow OAuth form
*IntegrationsApi* | [**cancelIntegrationJob**](https://docs.reacon.io/api-reference/cancelIntegrationJob) | **POST** /v1/teams/{teamId}/integrations/jobs/{jobId}/cancel | Cancel an integration job
*IntegrationsApi* | [**configureAirtableMapping**](https://docs.reacon.io/api-reference/configureAirtableMapping) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/airtable-mapping/configure | Configure Airtable field mapping
*IntegrationsApi* | [**configureCoda**](https://docs.reacon.io/api-reference/configureCoda) | **POST** /v1/teams/{teamId}/integrations/coda | Configure a Coda connection
*IntegrationsApi* | [**configureCrmMapping**](https://docs.reacon.io/api-reference/configureCrmMapping) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/crm-mapping/configure | Configure CRM field mapping
*IntegrationsApi* | [**configureCrmSync**](https://docs.reacon.io/api-reference/configureCrmSync) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/crm-sync/configure | Configure CRM synchronization
*IntegrationsApi* | [**configureFreshsales**](https://docs.reacon.io/api-reference/configureFreshsales) | **POST** /v1/teams/{teamId}/integrations/freshsales | Configure a Freshsales connection
*IntegrationsApi* | [**configureNotificationRoutes**](https://docs.reacon.io/api-reference/configureNotificationRoutes) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/notification-routes | Configure notification routes
*IntegrationsApi* | [**configureSlackDestination**](https://docs.reacon.io/api-reference/configureSlackDestination) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/slack-destination | Configure a Slack destination
*IntegrationsApi* | [**configureTeamsWorkflow**](https://docs.reacon.io/api-reference/configureTeamsWorkflow) | **POST** /v1/teams/{teamId}/integrations/microsoft-teams | Configure a Microsoft Teams workflow
*IntegrationsApi* | [**configureTypeformForm**](https://docs.reacon.io/api-reference/configureTypeformForm) | **POST** /v1/teams/{teamId}/integrations/typeform | Configure a Typeform form
*IntegrationsApi* | [**configureWarehouse**](https://docs.reacon.io/api-reference/configureWarehouse) | **POST** /v1/teams/{teamId}/integrations/warehouses | Configure a warehouse connection
*IntegrationsApi* | [**configureWebflowForm**](https://docs.reacon.io/api-reference/configureWebflowForm) | **POST** /v1/teams/{teamId}/integrations/webflow | Configure a Webflow form
*IntegrationsApi* | [**disableMcpIdentity**](https://docs.reacon.io/api-reference/disableMcpIdentity) | **DELETE** /v1/teams/{teamId}/integrations/mcp-identities/{identityId} | Disable an MCP identity
*IntegrationsApi* | [**executeIntegrationCapability**](https://docs.reacon.io/api-reference/executeIntegrationCapability) | **POST** /v1/actions/{capability} | Execute an integration capability
*IntegrationsApi* | [**getAirtableMappingOptions**](https://docs.reacon.io/api-reference/getAirtableMappingOptions) | **GET** /v1/teams/{teamId}/integrations/connections/{connectionId}/airtable-mapping-options | Get Airtable mapping options
*IntegrationsApi* | [**getCrmMappingOptions**](https://docs.reacon.io/api-reference/getCrmMappingOptions) | **GET** /v1/teams/{teamId}/integrations/connections/{connectionId}/crm-mapping-options | Get CRM mapping options
*IntegrationsApi* | [**getHubSpotConfigurationOptions**](https://docs.reacon.io/api-reference/getHubSpotConfigurationOptions) | **GET** /v1/teams/{teamId}/integrations/connections/{connectionId}/hubspot-configuration-options | Get HubSpot configuration options
*IntegrationsApi* | [**getIntegrationJob**](https://docs.reacon.io/api-reference/getIntegrationJob) | **GET** /v1/teams/{teamId}/integrations/jobs/{jobId} | Get an integration job
*IntegrationsApi* | [**inspectCodaTable**](https://docs.reacon.io/api-reference/inspectCodaTable) | **POST** /v1/teams/{teamId}/integrations/coda/inspect | Inspect Coda table columns
*IntegrationsApi* | [**inspectExcelWorkbook**](https://docs.reacon.io/api-reference/inspectExcelWorkbook) | **POST** /v1/teams/{teamId}/integrations/microsoft-excel/inspect | Inspect an Excel workbook
*IntegrationsApi* | [**inspectGoogleSheet**](https://docs.reacon.io/api-reference/inspectGoogleSheet) | **POST** /v1/teams/{teamId}/integrations/google-sheets/inspect | Inspect a Google spreadsheet
*IntegrationsApi* | [**linkMcpIdentity**](https://docs.reacon.io/api-reference/linkMcpIdentity) | **POST** /v1/teams/{teamId}/integrations/mcp-identities | Link an MCP identity
*IntegrationsApi* | [**listIntegrationConnections**](https://docs.reacon.io/api-reference/listIntegrationConnections) | **GET** /v1/teams/{teamId}/integrations/connections | List integration connections
*IntegrationsApi* | [**listIntegrationJobs**](https://docs.reacon.io/api-reference/listIntegrationJobs) | **GET** /v1/teams/{teamId}/integrations/jobs | List integration jobs
*IntegrationsApi* | [**listIntegrationProviders**](https://docs.reacon.io/api-reference/listIntegrationProviders) | **GET** /v1/integrations/providers | List integration providers
*IntegrationsApi* | [**listMcpIdentities**](https://docs.reacon.io/api-reference/listMcpIdentities) | **GET** /v1/teams/{teamId}/integrations/mcp-identities | List linked MCP identities
*IntegrationsApi* | [**listSheetWorkflows**](https://docs.reacon.io/api-reference/listSheetWorkflows) | **GET** /v1/teams/{teamId}/integrations/spreadsheet-workflows | List spreadsheet workflows
*IntegrationsApi* | [**previewSheetWorkflow**](https://docs.reacon.io/api-reference/previewSheetWorkflow) | **POST** /v1/teams/{teamId}/integrations/spreadsheet-workflows/{workflowId}/preview | Preview spreadsheet workflow inputs
*IntegrationsApi* | [**queueIntegrationLeadExport**](https://docs.reacon.io/api-reference/queueIntegrationLeadExport) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/export-leads | Queue lead export to an integration
*IntegrationsApi* | [**queueNotificationTest**](https://docs.reacon.io/api-reference/queueNotificationTest) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/notification-test | Queue a test notification
*IntegrationsApi* | [**rotateCodaCredential**](https://docs.reacon.io/api-reference/rotateCodaCredential) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/credentials/coda/rotate | Rotate a Coda credential
*IntegrationsApi* | [**rotateFreshsalesCredential**](https://docs.reacon.io/api-reference/rotateFreshsalesCredential) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/credentials/freshsales/rotate | Rotate a Freshsales credential
*IntegrationsApi* | [**runSheetWorkflow**](https://docs.reacon.io/api-reference/runSheetWorkflow) | **POST** /v1/teams/{teamId}/integrations/spreadsheet-workflows/{workflowId}/run | Queue a spreadsheet workflow
*IntegrationsApi* | [**saveSheetWorkflow**](https://docs.reacon.io/api-reference/saveSheetWorkflow) | **POST** /v1/teams/{teamId}/integrations/spreadsheet-workflows | Create or update a spreadsheet workflow
*IntegrationsApi* | [**startAttioOAuth**](https://docs.reacon.io/api-reference/startAttioOAuth) | **POST** /v1/teams/{teamId}/integrations/attio/oauth/start | Start Attio authorization
*IntegrationsApi* | [**startGoogleSheetsOAuth**](https://docs.reacon.io/api-reference/startGoogleSheetsOAuth) | **POST** /v1/teams/{teamId}/integrations/google-sheets/oauth/start | Start Google Sheets authorization
*IntegrationsApi* | [**startIntegrationOAuth**](https://docs.reacon.io/api-reference/startIntegrationOAuth) | **POST** /v1/teams/{teamId}/integrations/{provider}/oauth/start | Start provider authorization
*IntegrationsApi* | [**testIntegrationConnection**](https://docs.reacon.io/api-reference/testIntegrationConnection) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/test | Test an integration connection
*IntegrationsApi* | [**updateIntegrationConnectionState**](https://docs.reacon.io/api-reference/updateIntegrationConnectionState) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/state | Change integration connection state
*IntegrationsApi* | [**updateSheetWorkflowState**](https://docs.reacon.io/api-reference/updateSheetWorkflowState) | **POST** /v1/teams/{teamId}/integrations/spreadsheet-workflows/{workflowId}/state | Change spreadsheet workflow state
*LeadsApi* | [**createLead**](https://docs.reacon.io/api-reference/createLead) | **POST** /v1/teams/{teamId}/leads | Create a lead in a team
*LeadsApi* | [**deleteLead**](https://docs.reacon.io/api-reference/deleteLead) | **DELETE** /v1/leads/{leadId} | Delete a lead
*LeadsApi* | [**exportLeads**](https://docs.reacon.io/api-reference/exportLeads) | **POST** /v1/teams/{teamId}/leads/export | Export selected leads
*LeadsApi* | [**getLead**](https://docs.reacon.io/api-reference/getLead) | **GET** /v1/leads/{leadId} | Retrieve a lead
*LeadsApi* | [**listLeads**](https://docs.reacon.io/api-reference/listLeads) | **GET** /v1/teams/{teamId}/leads | List team leads
*LeadsApi* | [**updateLead**](https://docs.reacon.io/api-reference/updateLead) | **POST** /v1/leads/{leadId}/update | Update a lead
*MailApi* | [**addMailPortfolioTeam**](https://docs.reacon.io/api-reference/addMailPortfolioTeam) | **POST** /v1/teams/{teamId}/mail/portfolio/teams | Add a team to a portfolio
*MailApi* | [**archiveMailExperiment**](https://docs.reacon.io/api-reference/archiveMailExperiment) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/archive | Archive an experiment
*MailApi* | [**cancelMailMessage**](https://docs.reacon.io/api-reference/cancelMailMessage) | **POST** /v1/teams/{teamId}/mail/messages/{messageId}/cancel | Cancel a queued message
*MailApi* | [**changeMailCadenceCampaignState**](https://docs.reacon.io/api-reference/changeMailCadenceCampaignState) | **POST** /v1/teams/{teamId}/mail/cadence-campaigns/{campaignId}/state | Change a cadence campaign state
*MailApi* | [**changeMailCadenceRunState**](https://docs.reacon.io/api-reference/changeMailCadenceRunState) | **POST** /v1/teams/{teamId}/mail/cadence-runs/{runId}/state | Change a cadence run state
*MailApi* | [**changeMailCampaignState**](https://docs.reacon.io/api-reference/changeMailCampaignState) | **POST** /v1/teams/{teamId}/mail/campaigns/{campaignId}/state | Change a campaign state
*MailApi* | [**classifyMailReply**](https://docs.reacon.io/api-reference/classifyMailReply) | **POST** /v1/teams/{teamId}/mail/crm/classify-reply | Classify a reply
*MailApi* | [**completeMailCrmTask**](https://docs.reacon.io/api-reference/completeMailCrmTask) | **POST** /v1/teams/{teamId}/mail/crm/tasks/{taskId}/complete | Complete a CRM task
*MailApi* | [**configureMailDeliverability**](https://docs.reacon.io/api-reference/configureMailDeliverability) | **POST** /v1/teams/{teamId}/mail/deliverability/mailboxes/{mailboxId} | Configure a mailbox sending ramp
*MailApi* | [**configureMailTrackingDomain**](https://docs.reacon.io/api-reference/configureMailTrackingDomain) | **POST** /v1/teams/{teamId}/mail/tracking-domain | Configure a tracking domain
*MailApi* | [**copyMailCadence**](https://docs.reacon.io/api-reference/copyMailCadence) | **POST** /v1/teams/{teamId}/mail/cadences/{cadenceId}/copy | Copy a cadence to another team
*MailApi* | [**copyMailTemplate**](https://docs.reacon.io/api-reference/copyMailTemplate) | **POST** /v1/teams/{teamId}/mail/templates/{templateId}/copy | Copy a template to another team
*MailApi* | [**createMailCampaignDraft**](https://docs.reacon.io/api-reference/createMailCampaignDraft) | **POST** /v1/teams/{teamId}/mail/campaigns | Create a campaign draft
*MailApi* | [**createMailCrmNote**](https://docs.reacon.io/api-reference/createMailCrmNote) | **POST** /v1/teams/{teamId}/mail/crm/notes | Add a contact note
*MailApi* | [**createMailCrmTask**](https://docs.reacon.io/api-reference/createMailCrmTask) | **POST** /v1/teams/{teamId}/mail/crm/tasks | Create a CRM task
*MailApi* | [**createMailMailboxPool**](https://docs.reacon.io/api-reference/createMailMailboxPool) | **POST** /v1/teams/{teamId}/mail/deliverability/pools | Create a mailbox pool
*MailApi* | [**createMailPortfolio**](https://docs.reacon.io/api-reference/createMailPortfolio) | **POST** /v1/teams/{teamId}/mail/portfolio | Create a mail portfolio
*MailApi* | [**createMailPortfolioSuppression**](https://docs.reacon.io/api-reference/createMailPortfolioSuppression) | **POST** /v1/teams/{teamId}/mail/portfolio/suppressions | Create a portfolio suppression
*MailApi* | [**createMailSuppression**](https://docs.reacon.io/api-reference/createMailSuppression) | **POST** /v1/teams/{teamId}/mail/suppressions | Suppress an email or domain
*MailApi* | [**createMailWebhook**](https://docs.reacon.io/api-reference/createMailWebhook) | **POST** /v1/teams/{teamId}/mail/webhooks | Create a mail webhook
*MailApi* | [**decideMailExperiment**](https://docs.reacon.io/api-reference/decideMailExperiment) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/decide | Record an experiment decision
*MailApi* | [**deleteMailCampaignDraft**](https://docs.reacon.io/api-reference/deleteMailCampaignDraft) | **DELETE** /v1/teams/{teamId}/mail/campaigns/{campaignId} | Delete a campaign draft
*MailApi* | [**deleteMailReplyAutomation**](https://docs.reacon.io/api-reference/deleteMailReplyAutomation) | **DELETE** /v1/teams/{teamId}/mail/reply-automations/{automationId} | Delete a reply automation
*MailApi* | [**deleteMailTrackingDomain**](https://docs.reacon.io/api-reference/deleteMailTrackingDomain) | **DELETE** /v1/teams/{teamId}/mail/tracking-domain | Delete a tracking domain
*MailApi* | [**deleteMailWebhook**](https://docs.reacon.io/api-reference/deleteMailWebhook) | **DELETE** /v1/teams/{teamId}/mail/webhooks/{subscriptionId} | Delete a mail webhook
*MailApi* | [**disconnectMailMailbox**](https://docs.reacon.io/api-reference/disconnectMailMailbox) | **DELETE** /v1/teams/{teamId}/mail/mailboxes/{mailboxId} | Disconnect a mailbox
*MailApi* | [**duplicateMailCampaignDraft**](https://docs.reacon.io/api-reference/duplicateMailCampaignDraft) | **POST** /v1/teams/{teamId}/mail/campaigns/{campaignId}/duplicate | Duplicate a campaign draft
*MailApi* | [**enqueueMailMessage**](https://docs.reacon.io/api-reference/enqueueMailMessage) | **POST** /v1/teams/{teamId}/mail/messages | Queue an outbound message
*MailApi* | [**enrollMailCadence**](https://docs.reacon.io/api-reference/enrollMailCadence) | **POST** /v1/teams/{teamId}/mail/cadence-runs | Enroll contacts in a cadence
*MailApi* | [**exportMailAnalytics**](https://docs.reacon.io/api-reference/exportMailAnalytics) | **POST** /v1/teams/{teamId}/mail/analytics/export | Export mail analytics
*MailApi* | [**exportMailPortfolio**](https://docs.reacon.io/api-reference/exportMailPortfolio) | **POST** /v1/teams/{teamId}/mail/portfolio/export | Export portfolio analytics
*MailApi* | [**getMailAnalytics**](https://docs.reacon.io/api-reference/getMailAnalytics) | **GET** /v1/teams/{teamId}/mail/analytics | Get mail analytics
*MailApi* | [**getMailCampaignDraft**](https://docs.reacon.io/api-reference/getMailCampaignDraft) | **GET** /v1/teams/{teamId}/mail/campaigns/{campaignId} | Get a campaign draft
*MailApi* | [**getMailCampaignProgress**](https://docs.reacon.io/api-reference/getMailCampaignProgress) | **GET** /v1/teams/{teamId}/mail/campaign-progress | Get campaign progress
*MailApi* | [**getMailChannels**](https://docs.reacon.io/api-reference/getMailChannels) | **GET** /v1/teams/{teamId}/mail/channels | Get channel availability
*MailApi* | [**getMailContactStates**](https://docs.reacon.io/api-reference/getMailContactStates) | **POST** /v1/teams/{teamId}/mail/crm/states/batch | Get contact CRM states in a batch
*MailApi* | [**getMailContacts**](https://docs.reacon.io/api-reference/getMailContacts) | **POST** /v1/teams/{teamId}/mail/crm/contacts/batch | Get mail contacts in a batch
*MailApi* | [**getMailDeliverability**](https://docs.reacon.io/api-reference/getMailDeliverability) | **GET** /v1/teams/{teamId}/mail/deliverability | Get deliverability configuration
*MailApi* | [**getMailExperimentReport**](https://docs.reacon.io/api-reference/getMailExperimentReport) | **GET** /v1/teams/{teamId}/mail/experiments/{experimentKey}/report | Get an experiment report
*MailApi* | [**getMailExperimentsOverview**](https://docs.reacon.io/api-reference/getMailExperimentsOverview) | **GET** /v1/teams/{teamId}/mail/experiments-overview | Get experiment overview
*MailApi* | [**getMailOverview**](https://docs.reacon.io/api-reference/getMailOverview) | **GET** /v1/teams/{teamId}/mail/overview | Get mail overview
*MailApi* | [**getMailPortfolio**](https://docs.reacon.io/api-reference/getMailPortfolio) | **GET** /v1/teams/{teamId}/mail/portfolio | Get a mail portfolio
*MailApi* | [**getMailPortfolioOverview**](https://docs.reacon.io/api-reference/getMailPortfolioOverview) | **GET** /v1/teams/{teamId}/mail/portfolio/overview | Get portfolio analytics
*MailApi* | [**getMailQueue**](https://docs.reacon.io/api-reference/getMailQueue) | **GET** /v1/teams/{teamId}/mail/queue | Get mail queue status
*MailApi* | [**getMailTrackingDomain**](https://docs.reacon.io/api-reference/getMailTrackingDomain) | **GET** /v1/teams/{teamId}/mail/tracking-domain | Get tracking domain configuration
*MailApi* | [**inspectMailDomainHealth**](https://docs.reacon.io/api-reference/inspectMailDomainHealth) | **POST** /v1/teams/{teamId}/mail/deliverability/domain-health | Inspect domain authentication
*MailApi* | [**launchMailCadenceCampaign**](https://docs.reacon.io/api-reference/launchMailCadenceCampaign) | **POST** /v1/teams/{teamId}/mail/cadence-campaigns | Queue a cadence campaign
*MailApi* | [**launchMailCampaignDraft**](https://docs.reacon.io/api-reference/launchMailCampaignDraft) | **POST** /v1/teams/{teamId}/mail/campaigns/{campaignId}/launch | Launch a campaign draft
*MailApi* | [**listMailAudienceLists**](https://docs.reacon.io/api-reference/listMailAudienceLists) | **GET** /v1/teams/{teamId}/mail/audience-lists | List campaign audience lists
*MailApi* | [**listMailCadenceCampaigns**](https://docs.reacon.io/api-reference/listMailCadenceCampaigns) | **GET** /v1/teams/{teamId}/mail/cadence-campaigns | List cadence campaigns
*MailApi* | [**listMailCadenceRuns**](https://docs.reacon.io/api-reference/listMailCadenceRuns) | **GET** /v1/teams/{teamId}/mail/cadence-runs | List cadence runs
*MailApi* | [**listMailCadences**](https://docs.reacon.io/api-reference/listMailCadences) | **GET** /v1/teams/{teamId}/mail/cadences | List cadences
*MailApi* | [**listMailCampaignDrafts**](https://docs.reacon.io/api-reference/listMailCampaignDrafts) | **GET** /v1/teams/{teamId}/mail/campaigns | List campaign drafts
*MailApi* | [**listMailContactStates**](https://docs.reacon.io/api-reference/listMailContactStates) | **GET** /v1/teams/{teamId}/mail/crm/states | List contact CRM states
*MailApi* | [**listMailCrmTasks**](https://docs.reacon.io/api-reference/listMailCrmTasks) | **GET** /v1/teams/{teamId}/mail/crm/tasks | List CRM tasks
*MailApi* | [**listMailCrmTimeline**](https://docs.reacon.io/api-reference/listMailCrmTimeline) | **GET** /v1/teams/{teamId}/mail/crm/timeline | List CRM timeline events
*MailApi* | [**listMailExperiments**](https://docs.reacon.io/api-reference/listMailExperiments) | **GET** /v1/teams/{teamId}/mail/experiments | List mail experiments
*MailApi* | [**listMailInbox**](https://docs.reacon.io/api-reference/listMailInbox) | **GET** /v1/teams/{teamId}/mail/inbox | List inbox messages
*MailApi* | [**listMailInboxThreads**](https://docs.reacon.io/api-reference/listMailInboxThreads) | **GET** /v1/teams/{teamId}/mail/inbox/threads | List inbox conversation threads
*MailApi* | [**listMailMailboxes**](https://docs.reacon.io/api-reference/listMailMailboxes) | **GET** /v1/teams/{teamId}/mail/mailboxes | List mailboxes and connections
*MailApi* | [**listMailMessages**](https://docs.reacon.io/api-reference/listMailMessages) | **GET** /v1/teams/{teamId}/mail/messages | List mail delivery activity
*MailApi* | [**listMailReplyAutomations**](https://docs.reacon.io/api-reference/listMailReplyAutomations) | **GET** /v1/teams/{teamId}/mail/reply-automations | List reply automations
*MailApi* | [**listMailSignatures**](https://docs.reacon.io/api-reference/listMailSignatures) | **GET** /v1/teams/{teamId}/mail/signatures | List extracted signatures
*MailApi* | [**listMailSuppressions**](https://docs.reacon.io/api-reference/listMailSuppressions) | **GET** /v1/teams/{teamId}/mail/suppressions | List mail suppressions
*MailApi* | [**listMailTemplates**](https://docs.reacon.io/api-reference/listMailTemplates) | **GET** /v1/teams/{teamId}/mail/templates | List message templates
*MailApi* | [**listMailWebhooks**](https://docs.reacon.io/api-reference/listMailWebhooks) | **GET** /v1/teams/{teamId}/mail/webhooks | List mail webhooks and deliveries
*MailApi* | [**pauseMailExperiment**](https://docs.reacon.io/api-reference/pauseMailExperiment) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/pause | Pause an experiment
*MailApi* | [**pauseMailMailbox**](https://docs.reacon.io/api-reference/pauseMailMailbox) | **POST** /v1/teams/{teamId}/mail/deliverability/mailboxes/{mailboxId}/pause | Pause a mailbox
*MailApi* | [**preflightMailCadenceEnrollment**](https://docs.reacon.io/api-reference/preflightMailCadenceEnrollment) | **POST** /v1/teams/{teamId}/mail/cadence-runs/preflight | Check cadence enrollment
*MailApi* | [**provisionMailMailbox**](https://docs.reacon.io/api-reference/provisionMailMailbox) | **POST** /v1/teams/{teamId}/mail/mailboxes/manual | Connect an SMTP/IMAP mailbox
*MailApi* | [**reconcileMailMailboxHealth**](https://docs.reacon.io/api-reference/reconcileMailMailboxHealth) | **POST** /v1/teams/{teamId}/mail/deliverability/mailboxes/{mailboxId}/reconcile | Reconcile mailbox health
*MailApi* | [**reconcileMailWebhook**](https://docs.reacon.io/api-reference/reconcileMailWebhook) | **POST** /v1/teams/{teamId}/mail/webhooks/{subscriptionId}/reconcile | Reconcile a mail webhook
*MailApi* | [**recordMailExperimentConversion**](https://docs.reacon.io/api-reference/recordMailExperimentConversion) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/conversions | Record an experiment conversion
*MailApi* | [**removeMailMailboxPoolMember**](https://docs.reacon.io/api-reference/removeMailMailboxPoolMember) | **DELETE** /v1/teams/{teamId}/mail/deliverability/pools/{poolId}/members/{mailboxId} | Remove a mailbox pool member
*MailApi* | [**removeMailPortfolioTeam**](https://docs.reacon.io/api-reference/removeMailPortfolioTeam) | **DELETE** /v1/teams/{teamId}/mail/portfolio/teams/{memberTeamId} | Remove a team from a portfolio
*MailApi* | [**replayMailWebhookDelivery**](https://docs.reacon.io/api-reference/replayMailWebhookDelivery) | **POST** /v1/teams/{teamId}/mail/webhooks/deliveries/{deliveryId}/replay | Replay a webhook delivery
*MailApi* | [**replyToMailInboxMessage**](https://docs.reacon.io/api-reference/replyToMailInboxMessage) | **POST** /v1/teams/{teamId}/mail/inbox/{messageId}/reply | Queue an inbox reply
*MailApi* | [**resumeMailExperiment**](https://docs.reacon.io/api-reference/resumeMailExperiment) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/resume | Resume an experiment
*MailApi* | [**resumeMailMailbox**](https://docs.reacon.io/api-reference/resumeMailMailbox) | **POST** /v1/teams/{teamId}/mail/deliverability/mailboxes/{mailboxId}/resume | Resume a mailbox
*MailApi* | [**retryMailMessage**](https://docs.reacon.io/api-reference/retryMailMessage) | **POST** /v1/teams/{teamId}/mail/messages/{messageId}/retry | Retry a message explicitly
*MailApi* | [**rotateMailWebhookSecret**](https://docs.reacon.io/api-reference/rotateMailWebhookSecret) | **POST** /v1/teams/{teamId}/mail/webhooks/{subscriptionId}/rotate-secret | Rotate a mail webhook secret
*MailApi* | [**saveMailCadence**](https://docs.reacon.io/api-reference/saveMailCadence) | **POST** /v1/teams/{teamId}/mail/cadences | Save a cadence version
*MailApi* | [**saveMailReplyAutomation**](https://docs.reacon.io/api-reference/saveMailReplyAutomation) | **POST** /v1/teams/{teamId}/mail/reply-automations | Save a reply automation
*MailApi* | [**saveMailTemplate**](https://docs.reacon.io/api-reference/saveMailTemplate) | **POST** /v1/teams/{teamId}/mail/templates | Save a message template
*MailApi* | [**setMailContactState**](https://docs.reacon.io/api-reference/setMailContactState) | **PUT** /v1/teams/{teamId}/mail/crm/states | Set a contact CRM state
*MailApi* | [**setMailMailboxPoolMember**](https://docs.reacon.io/api-reference/setMailMailboxPoolMember) | **PUT** /v1/teams/{teamId}/mail/deliverability/pools/{poolId}/members/{mailboxId} | Set a mailbox pool member
*MailApi* | [**setMailWebhookStatus**](https://docs.reacon.io/api-reference/setMailWebhookStatus) | **POST** /v1/teams/{teamId}/mail/webhooks/{subscriptionId}/status | Set a mail webhook status
*MailApi* | [**startMailOAuth**](https://docs.reacon.io/api-reference/startMailOAuth) | **POST** /v1/teams/{teamId}/mail/oauth/begin | Start mailbox authorization
*MailApi* | [**updateMailCampaignDraft**](https://docs.reacon.io/api-reference/updateMailCampaignDraft) | **PATCH** /v1/teams/{teamId}/mail/campaigns/{campaignId} | Update a campaign draft
*MailApi* | [**updateMailInboxMessage**](https://docs.reacon.io/api-reference/updateMailInboxMessage) | **POST** /v1/teams/{teamId}/mail/inbox/{messageId} | Update an inbox message
*MailApi* | [**updateMailWebhook**](https://docs.reacon.io/api-reference/updateMailWebhook) | **PATCH** /v1/teams/{teamId}/mail/webhooks/{subscriptionId} | Update a mail webhook
*MailApi* | [**verifyMailTrackingDomain**](https://docs.reacon.io/api-reference/verifyMailTrackingDomain) | **POST** /v1/teams/{teamId}/mail/tracking-domain/verify | Verify a tracking domain
*NamesApi* | [**listNamePatterns**](https://docs.reacon.io/api-reference/listNamePatterns) | **GET** /v1/name/schemas | List supported email name patterns
*NamesApi* | [**verifyName**](https://docs.reacon.io/api-reference/verifyName) | **GET** /v1/name/verify | Verify name-based email patterns
*ProductToolsApi* | [**executeProductTool**](https://docs.reacon.io/api-reference/executeProductTool) | **POST** /v1/product/tools/{tool} | Execute a product tool
*StatsApi* | [**getStats**](https://docs.reacon.io/api-reference/getStats) | **GET** /v1/stats | Get public dataset statistics
*VerificationApi* | [**verifyBatch**](https://docs.reacon.io/api-reference/verifyBatch) | **POST** /v1/verify/batch | Verify a batch of email addresses
*VerificationApi* | [**verifyEmail**](https://docs.reacon.io/api-reference/verifyEmail) | **GET** /v1/verify | Verify an email address
*WebhooksApi* | [**createAutomationHook**](https://docs.reacon.io/api-reference/createAutomationHook) | **POST** /v1/hooks | Create an automation webhook
*WebhooksApi* | [**createSegmentInstallation**](https://docs.reacon.io/api-reference/createSegmentInstallation) | **POST** /v1/origin-installations/segment | Create a Segment origin installation
*WebhooksApi* | [**deleteAutomationHook**](https://docs.reacon.io/api-reference/deleteAutomationHook) | **DELETE** /v1/hooks/{hookId} | Delete an automation webhook
*WebhooksApi* | [**deleteSegmentInstallation**](https://docs.reacon.io/api-reference/deleteSegmentInstallation) | **DELETE** /v1/origin-installations/segment/{installationId} | Delete a Segment origin installation


### Models

- AirtableMappingOptionsResponse
- AirtableMappingOptionsResponseOptions
- AirtableMappingOptionsResponseOptionsBasesInner
- AirtableMappingOptionsResponseOptionsTablesInner
- AirtableMappingOptionsResponseOptionsTablesInnerFieldsInner
- ApiError
- ApiKeyIdentity
- ApiValidationIssue
- AutomationHookCreated
- BatchVerificationError
- BatchVerificationItem
- BatchVerificationRequest
- BatchVerificationRequestOnlyIfFree
- BatchVerificationResponse
- BindTypeformFormRequest
- BindWebflowFormRequest
- CapabilityDomainSearch
- CapabilityDomainSearchContactsInner
- CapabilityEmailFound
- CapabilityEmailVerified
- CapabilityEmailVerifiedDetails
- CodaTableInspectionResponse
- CodaTableInspectionResponseInspection
- CompanyContextAddress
- CompanyContextJob
- CompanyContextSource
- CompanyList
- CompanyListResultsInner
- CompanyListResultsInnerAddressesInner
- ConfigureAirtableMappingRequest
- ConfigureCodaRequest
- ConfigureCodaRequestMapping
- ConfigureCrmMappingRequest
- ConfigureCrmSyncRequest
- ConfigureCrmSyncRequestConfiguration
- ConfigureCrmSyncRequestConfigurationHubspot
- ConfigureCrmSyncRequestConfigurationHubspotDeal
- ConfigureCrmSyncRequestConfigurationPolicy
- ConfigureFreshsalesRequest
- ConfigureNotificationRoutesRequest
- ConfigureSlackDestinationRequest
- ConfigureTeamsWorkflowRequest
- ConfigureTypeformFormRequest
- ConfigureWarehouseRequest
- ConfigureWebflowFormRequest
- CreateAutomationHookRequest
- CreateLeadRequest
- CreateLeadRequestCompany
- CreateLeadRequestPerson
- CreateLeadResponse
- CreateLeadResponseLead
- CreateSegmentInstallationRequest
- CrmMappingOptionsResponse
- CrmMappingOptionsResponseOptions
- CrmMappingOptionsResponseOptionsObjectsInner
- CrmRemoteField
- CrmSyncConfiguration
- CrmSyncConfigurationHubspot
- CrmSyncConfigurationHubspotDeal
- CrmSyncConfigurationPolicy
- CrmSyncConfigurationResponse
- DeleteEmailResponse
- DeleteLeadResponse
- DomainCatchAll
- DomainCompanyContext
- DomainCompanyContextCompany
- DomainCounts
- EmailMention
- EmailMentionsPage
- EmailNotFoundError
- EmailNotFoundErrorError
- EmailPage
- EmailPageResultsInner
- EmailPageResultsInnerSourcesInner
- EmailRevealResponse
- EmailRevealResponseProfile
- ExcelWorkbookInspectionResponse
- ExcelWorkbookInspectionResponseInspection
- ExecuteIntegrationCapabilityRequest
- ExportLeadsRequest
- ExportLeadsRequestSelectionScopesInner
- GetLeadResponse
- GetLeadResponseLead
- GetLeadResponseLeadCompany
- GetLeadResponseLeadSync
- GetLeadResponseLeadVerification
- GoogleSheetInspectionResponse
- GoogleSheetInspectionResponseInspection
- HubSpotConfigurationOptionsResponse
- HubSpotConfigurationOptionsResponseOptions
- HubSpotConfigurationOptionsResponseOptionsOwnersInner
- HubSpotConfigurationOptionsResponseOptionsPipelinesInner
- HubSpotConfigurationOptionsResponseOptionsPipelinesInnerStagesInner
- InsightAddress
- InsightAddressEntry
- InsightAttribute
- InsightErrorEvent
- InsightEvidence
- InsightFinalEvent
- InsightGeo
- InsightIdentifier
- InsightJurisdiction
- InsightMention
- InsightMentionErrorEvent
- InsightMentionExtractedEvent
- InsightMentionInsightEvent
- InsightOffice
- InsightOrganization
- InsightPhone
- InsightPlatformDetectedEvent
- InsightPlatformProgressEvent
- InsightPlatformScan
- InsightPlatformScanEvent
- InsightRole
- InsightSocialProfile
- InsightSource
- InsightStartedEvent
- InsightsResponse
- InspectCodaTableRequest
- InspectExcelWorkbookRequest
- InspectGoogleSheetRequest
- IntegrationCapabilityResponse
- IntegrationCapabilityResponseOutput
- IntegrationCapabilityResponseOutputNonNull
- IntegrationConnection
- IntegrationConnectionHealth
- IntegrationConnectionList
- IntegrationConnectionResponse
- IntegrationConnectionStateResponse
- IntegrationConnectionTest
- IntegrationConnectionTestResponse
- IntegrationFormConnectionResponse
- IntegrationJob
- IntegrationJobCancellation
- IntegrationJobCounters
- IntegrationJobPage
- IntegrationJobResponse
- IntegrationLeadExportResponse
- IntegrationOAuthStartResponse
- IntegrationProviderList
- IntegrationProviderListProvidersInner
- IntegrationProviderListProvidersInnerConnectability
- IntegrationProviderListProvidersInnerReadiness
- LeadExportInner
- LeadExportInnerCompany
- LeadExportInnerPerson
- LeadExportTooLargeError
- LeadPage
- LeadPageResultsInner
- LeadPageResultsInnerCompany
- LinkMcpIdentityRequest
- MailCadenceCampaignRecord
- MailCadenceDefinition
- MailCadenceEnrollmentVariableGap
- MailCadenceExperimentContext
- MailCadenceMessageExperiment
- MailCadenceMessageExperimentVariant
- MailCadenceNode
- MailCadenceNodeAnyOf
- MailCadenceNodeAnyOf1
- MailCadenceNodeAnyOf2
- MailCadenceNodeAnyOf3
- MailCadenceNodeAnyOf4
- MailCadenceNodeAnyOf4AllOfCondition
- MailCadenceNodeAnyOf5
- MailCadenceNodeAnyOf6
- MailCadenceNodeBase
- MailCadenceRunRecord
- MailCadenceStopConditions
- MailCadenceWorkflowExperiment
- MailCadenceWorkflowExperimentVariant
- MailCampaignDraftRecord
- MailCampaignDraftStep
- MailCampaignProgress
- MailCampaignProgressMessageCounts
- MailContactCrmState
- MailContactListSummaryRecord
- MailContactRecord
- MailConversationEntry
- MailConversationEntryFrom
- MailConversationEntryLastError
- MailConversationEntryLastErrorAnyOf
- MailConversationEntryLastErrorAnyOf1
- MailConversationEntryLastErrorAnyOf2
- MailConversationThread
- MailCrmTask
- MailCrmTimelineEvent
- MailDeleteCampaignsByCampaignIdRequest
- MailDeleteCampaignsByCampaignIdResponse200
- MailDeleteDeliverabilityPoolsByPoolIdMembersByMailboxIdResponse200
- MailDeleteMailboxesByMailboxIdResponse200
- MailDeletePortfolioTeamsByMemberTeamIdResponse200
- MailDeleteReplyAutomationsByAutomationIdResponse200
- MailDeleteTrackingDomainResponse200
- MailDeleteWebhooksBySubscriptionIdResponse200
- MailDomainHealthCheck
- MailDomainHealthReport
- MailEvidenceField
- MailExperimentDecisionRecord
- MailExperimentDefinitionRecord
- MailExperimentOutcomeRecord
- MailExperimentReport
- MailExperimentReportDecision
- MailExperimentRevisionRecord
- MailExperimentVariant
- MailExperimentVariantReport
- MailExperimentVariantReportConfidenceInterval95
- MailExperimentVariantReportGuardrails
- MailGetAnalyticsResponse200
- MailGetAudienceListsResponse200
- MailGetCadenceCampaignsResponse200
- MailGetCadenceRunsResponse200
- MailGetCadencesResponse200
- MailGetCampaignProgressResponse200
- MailGetCampaignsByCampaignIdResponse200
- MailGetCampaignsResponse200
- MailGetChannelsResponse200
- MailGetChannelsResponse200Email
- MailGetChannelsResponse200Execution
- MailGetChannelsResponse200Sms
- MailGetChannelsResponse200Whatsapp
- MailGetCrmStatesResponse200
- MailGetCrmTasksResponse200
- MailGetCrmTimelineResponse200
- MailGetDeliverabilityResponse200
- MailGetDeliverabilityResponse200PoolsInner
- MailGetExperimentsByExperimentKeyReportResponse200
- MailGetExperimentsOverviewResponse200
- MailGetExperimentsResponse200
- MailGetExperimentsResponse200ResultsInner
- MailGetInboxResponse200
- MailGetInboxThreadsResponse200
- MailGetMailboxesResponse200
- MailGetMessagesResponse200
- MailGetOverviewResponse200
- MailGetOverviewResponse200Inbox
- MailGetPortfolioOverviewResponse200
- MailGetPortfolioResponse200
- MailGetPortfolioResponse200AnyOf
- MailGetPortfolioResponse200AnyOf1
- MailGetPortfolioResponse200Portfolio
- MailGetQueueResponse200
- MailGetReplyAutomationsResponse200
- MailGetSignaturesResponse200
- MailGetSuppressionsResponse200
- MailGetTemplatesResponse200
- MailGetTrackingDomainResponse200
- MailGetTrackingDomainResponse200Domain
- MailGetWebhooksResponse200
- MailGetWebhooksResponse200SubscriptionsInner
- MailImapCursor
- MailInboxMessageRecord
- MailMailAddress
- MailMailPortfolio
- MailMailPortfolioOverviewRow
- MailMailPortfolioSuppression
- MailMailPortfolioTeam
- MailMailboxConnectionRecord
- MailMailboxHealthRecord
- MailMailboxPoolMember
- MailMailboxProviderKind
- MailMailboxRecord
- MailMessageAnalyticsOverview
- MailMessageAnalyticsOverviewDailyInner
- MailMessageAnalyticsOverviewMailboxesInner
- MailMessageAnalyticsOverviewVariantsInner
- MailMessagePolicy
- MailMessagePolicyInput
- MailMessageRecord
- MailMessageTemplateVersion
- MailMessageTemplateVersionWhatsappApproval
- MailMessageVariantInput
- MailOperationalAnalyticsOverview
- MailOperationalAnalyticsOverviewCadenceStepsInner
- MailPatchCampaignsByCampaignIdRequest
- MailPatchCampaignsByCampaignIdRequestPolicy
- MailPatchCampaignsByCampaignIdRequestPolicyDomainQuotasInner
- MailPatchCampaignsByCampaignIdRequestPolicySendingWindowsInner
- MailPatchCampaignsByCampaignIdRequestStepsInner
- MailPatchCampaignsByCampaignIdRequestStepsInnerVariantsInner
- MailPatchCampaignsByCampaignIdResponse200
- MailPatchWebhooksBySubscriptionIdRequest
- MailPatchWebhooksBySubscriptionIdResponse200
- MailPhoneNumberValue
- MailPostAnalyticsExportRequest
- MailPostAnalyticsExportRequestAfter
- MailPostAnalyticsExportResponse200
- MailPostAnalyticsExportResponse200NextCursor
- MailPostCadenceCampaignsByCampaignIdStateRequest
- MailPostCadenceCampaignsByCampaignIdStateResponse200
- MailPostCadenceCampaignsByCampaignIdStateResponse200AnyOf
- MailPostCadenceCampaignsByCampaignIdStateResponse200AnyOf1
- MailPostCadenceCampaignsRequest
- MailPostCadenceCampaignsResponse202
- MailPostCadenceRunsByRunIdStateRequest
- MailPostCadenceRunsByRunIdStateResponse200
- MailPostCadenceRunsPreflightRequest
- MailPostCadenceRunsPreflightResponse200
- MailPostCadenceRunsRequest
- MailPostCadenceRunsResponse200
- MailPostCadencesByCadenceIdCopyRequest
- MailPostCadencesByCadenceIdCopyResponse200
- MailPostCadencesRequest
- MailPostCadencesRequestNodesInner
- MailPostCadencesRequestNodesInnerAnyOf
- MailPostCadencesRequestNodesInnerAnyOf1
- MailPostCadencesRequestNodesInnerAnyOf1Experiment
- MailPostCadencesRequestNodesInnerAnyOf1ExperimentVariantsInner
- MailPostCadencesRequestNodesInnerAnyOf2
- MailPostCadencesRequestNodesInnerAnyOf3
- MailPostCadencesRequestNodesInnerAnyOf4
- MailPostCadencesRequestNodesInnerAnyOf4Condition
- MailPostCadencesRequestNodesInnerAnyOf5
- MailPostCadencesRequestNodesInnerAnyOf5Experiment
- MailPostCadencesRequestNodesInnerAnyOf5ExperimentVariantsInner
- MailPostCadencesRequestNodesInnerAnyOf6
- MailPostCadencesRequestStopConditions
- MailPostCadencesResponse200
- MailPostCampaignsByCampaignIdDuplicateResponse201
- MailPostCampaignsByCampaignIdLaunchRequest
- MailPostCampaignsByCampaignIdLaunchResponse200
- MailPostCampaignsByCampaignIdLaunchResponse200Campaign
- MailPostCampaignsByCampaignIdStateRequest
- MailPostCampaignsByCampaignIdStateResponse200
- MailPostCampaignsRequest
- MailPostCampaignsResponse201
- MailPostCrmClassifyReplyRequest
- MailPostCrmClassifyReplyResponse200
- MailPostCrmContactsBatchRequest
- MailPostCrmContactsBatchResponse200
- MailPostCrmNotesRequest
- MailPostCrmNotesResponse200
- MailPostCrmNotesResponse200Event
- MailPostCrmNotesResponse200EventPayload
- MailPostCrmStatesBatchRequest
- MailPostCrmStatesBatchResponse200
- MailPostCrmTasksByTaskIdCompleteRequest
- MailPostCrmTasksByTaskIdCompleteResponse200
- MailPostCrmTasksRequest
- MailPostCrmTasksResponse201
- MailPostDeliverabilityDomainHealthRequest
- MailPostDeliverabilityDomainHealthResponse200
- MailPostDeliverabilityMailboxesByMailboxIdPauseRequest
- MailPostDeliverabilityMailboxesByMailboxIdPauseResponse200
- MailPostDeliverabilityMailboxesByMailboxIdReconcileResponse200
- MailPostDeliverabilityMailboxesByMailboxIdRequest
- MailPostDeliverabilityMailboxesByMailboxIdResponse200
- MailPostDeliverabilityMailboxesByMailboxIdResumeResponse200
- MailPostDeliverabilityPoolsRequest
- MailPostDeliverabilityPoolsResponse201
- MailPostDeliverabilityPoolsResponse201Pool
- MailPostExperimentsByExperimentKeyArchiveResponse200
- MailPostExperimentsByExperimentKeyConversionsRequest
- MailPostExperimentsByExperimentKeyConversionsResponse200
- MailPostExperimentsByExperimentKeyDecideRequest
- MailPostExperimentsByExperimentKeyDecideResponse200
- MailPostExperimentsByExperimentKeyPauseResponse200
- MailPostExperimentsByExperimentKeyResumeResponse200
- MailPostInboxByMessageIdReplyRequest
- MailPostInboxByMessageIdReplyResponse200
- MailPostInboxByMessageIdRequest
- MailPostInboxByMessageIdResponse200
- MailPostInboxByMessageIdResponse200Message
- MailPostMailboxesManualRequest
- MailPostMailboxesManualRequestImap
- MailPostMailboxesManualRequestSmtp
- MailPostMailboxesManualResponse200
- MailPostMessagesByMessageIdCancelResponse200
- MailPostMessagesByMessageIdRetryResponse200
- MailPostMessagesRequest
- MailPostMessagesRequestTo
- MailPostMessagesResponse201
- MailPostOauthBeginRequest
- MailPostOauthBeginResponse200
- MailPostPortfolioExportResponse200
- MailPostPortfolioRequest
- MailPostPortfolioResponse200
- MailPostPortfolioSuppressionsRequest
- MailPostPortfolioSuppressionsRequestAnyOf
- MailPostPortfolioSuppressionsRequestAnyOf1
- MailPostPortfolioSuppressionsResponse200
- MailPostPortfolioTeamsRequest
- MailPostPortfolioTeamsResponse200
- MailPostReplyAutomationsRequest
- MailPostReplyAutomationsRequestActions
- MailPostReplyAutomationsRequestActionsTask
- MailPostReplyAutomationsResponse200
- MailPostSuppressionsRequest
- MailPostSuppressionsRequestAnyOf
- MailPostSuppressionsRequestAnyOf1
- MailPostSuppressionsResponse200
- MailPostTemplatesByTemplateIdCopyRequest
- MailPostTemplatesByTemplateIdCopyResponse200
- MailPostTemplatesRequest
- MailPostTemplatesRequestWhatsappApproval
- MailPostTemplatesResponse200
- MailPostTrackingDomainRequest
- MailPostTrackingDomainResponse200
- MailPostTrackingDomainVerifyResponse200
- MailPostWebhooksBySubscriptionIdReconcileResponse200
- MailPostWebhooksBySubscriptionIdRotateSecretResponse200
- MailPostWebhooksBySubscriptionIdStatusRequest
- MailPostWebhooksBySubscriptionIdStatusResponse200
- MailPostWebhooksDeliveriesByDeliveryIdReplayResponse200
- MailPostWebhooksRequest
- MailPostWebhooksResponse201
- MailProviderFailure
- MailPutCrmStatesRequest
- MailPutCrmStatesResponse200
- MailPutDeliverabilityPoolsByPoolIdMembersByMailboxIdRequest
- MailPutDeliverabilityPoolsByPoolIdMembersByMailboxIdResponse200
- MailQueueSnapshot
- MailQuotaRule
- MailRenderedMessage
- MailReplyAutomationRule
- MailReplyAutomationRuleActions
- MailReplyAutomationRuleActionsTask
- MailReplyClassificationResult
- MailSendingWindow
- MailSequenceRunRecord
- MailSignatureCandidate
- MailSignatureCandidateFields
- MailSignatureCandidateFieldsPhonesInner
- MailStoredImapSettings
- MailStoredSmtpSettings
- MailSuppressionRecord
- MailTrackingDomainRecord
- MailWebhookDelivery
- MailWebhookEventSnapshot
- McpIdentity
- McpIdentityList
- McpIdentityResponse
- NamePattern
- NamePatternsResponse
- NameVerificationEmptyFinal
- NameVerificationItem
- NameVerificationResponse
- PersonInsight
- PreviewSheetWorkflowRequest
- ProductAccountInfoExecution
- ProductAccountInfoOutput
- ProductCombinedEnrichExecution
- ProductCombinedEnrichInput
- ProductCombinedEnrichOutput
- ProductCompaniesListExecution
- ProductCompaniesListInput
- ProductCompaniesListOutput
- ProductCompany
- ProductCompanyDeleteExecution
- ProductCompanyDeleteInput
- ProductCompanyDeleteOutput
- ProductCompanyEnrichExecution
- ProductCompanyEnrichInput
- ProductCompanyList
- ProductCompanyListAddExecution
- ProductCompanyListAddInput
- ProductCompanyListAddOutput
- ProductCompanyListCreateExecution
- ProductCompanyListCreateInput
- ProductCompanyListRemoveExecution
- ProductCompanyListRemoveInput
- ProductCompanyListRemoveOutput
- ProductCompanyListsListExecution
- ProductCompanyListsListOutput
- ProductCompanySummary
- ProductCompanyTrackExecution
- ProductCompanyTrackInput
- ProductCompanyTrackOutput
- ProductCompanyUpdateExecution
- ProductCompanyUpdateInput
- ProductCompanyUpdateOutput
- ProductConnectedApp
- ProductConnectedAppPushExecution
- ProductConnectedAppPushInput
- ProductConnectedAppPushOutput
- ProductConnectedAppsExecution
- ProductConnectedAppsOutput
- ProductCustomAttribute
- ProductCustomAttributeCreateExecution
- ProductCustomAttributeCreateInput
- ProductCustomAttributesListExecution
- ProductCustomAttributesListOutput
- ProductDatedRecipient
- ProductDiscoverCompaniesExecution
- ProductDiscoverCompaniesInput
- ProductDiscoverCompaniesOutput
- ProductDiscoverPeopleExecution
- ProductDiscoverPeopleInput
- ProductDiscoverPeopleOutput
- ProductDomainFinderExecution
- ProductDomainFinderInput
- ProductDomainFinderOutput
- ProductEmailCountExecution
- ProductEmailCountInput
- ProductEmailCountOutput
- ProductLead
- ProductLeadBulkDeleteExecution
- ProductLeadBulkDeleteInput
- ProductLeadBulkDeleteOutput
- ProductLeadCreateExecution
- ProductLeadCreateInput
- ProductLeadDeleteExecution
- ProductLeadDeleteInput
- ProductLeadDeleteOutput
- ProductLeadEnrichExecution
- ProductLeadEnrichInput
- ProductLeadGetExecution
- ProductLeadGetInput
- ProductLeadList
- ProductLeadListAddLeadExecution
- ProductLeadListAddLeadInput
- ProductLeadListAddLeadOutput
- ProductLeadListCreateExecution
- ProductLeadListCreateInput
- ProductLeadListDeleteExecution
- ProductLeadListDeleteInput
- ProductLeadListDeleteOutput
- ProductLeadListRemoveLeadExecution
- ProductLeadListRemoveLeadInput
- ProductLeadListRemoveLeadOutput
- ProductLeadListUpdateExecution
- ProductLeadListUpdateInput
- ProductLeadListsListExecution
- ProductLeadListsListOutput
- ProductLeadTagAssignExecution
- ProductLeadTagAssignInput
- ProductLeadTagAssignOutput
- ProductLeadTagCreateExecution
- ProductLeadTagCreateInput
- ProductLeadTagRemoveExecution
- ProductLeadTagRemoveInput
- ProductLeadTagRemoveOutput
- ProductLeadTagsListExecution
- ProductLeadTagsListOutput
- ProductLeadUpdateExecution
- ProductLeadUpdateInput
- ProductLeadUpsertExecution
- ProductLeadUpsertInput
- ProductLeadWithAttributes
- ProductLeadsListExecution
- ProductLeadsListInput
- ProductLeadsListOutput
- ProductNamedResource
- ProductPerson
- ProductPersonEnrichExecution
- ProductPersonEnrichInput
- ProductPersonSummary
- ProductRecipient
- ProductSavedSearchesListExecution
- ProductSavedSearchesListOutput
- ProductSequence
- ProductSequenceRecipientAddExecution
- ProductSequenceRecipientAddInput
- ProductSequenceRecipientAddOutput
- ProductSequenceRecipientCancelExecution
- ProductSequenceRecipientCancelInput
- ProductSequenceRecipientsAddExecution
- ProductSequenceRecipientsAddInput
- ProductSequenceRecipientsAddInputRecipientsInner
- ProductSequenceRecipientsAddOutput
- ProductSequenceRecipientsListExecution
- ProductSequenceRecipientsListInput
- ProductSequenceRecipientsListOutput
- ProductSequenceStartExecution
- ProductSequenceStartInput
- ProductSequenceStartOutput
- ProductSequencesListExecution
- ProductSequencesListOutput
- ProductTeamMember
- ProductTeamMembersExecution
- ProductTeamMembersOutput
- ProductToolExecution
- ProductToolRequest
- ProductToolRequestInput
- ProductTrackedCompany
- ProductUsageExecution
- ProductUsageHistoryExecution
- ProductUsageHistoryInput
- ProductUsageHistoryOutput
- ProductUsageOutput
- ProductUsageTransaction
- PublicStats
- QueueIntegrationLeadExportRequest
- QueueIntegrationLeadExportRequestSelectionScopesInner
- QueueNotificationTestRequest
- QueuedIntegrationJob
- QueuedIntegrationJobResponse
- QueuedIntegrationJobStreamPosition
- RotateCodaCredentialRequest
- RotateFreshsalesCredentialRequest
- RunSheetWorkflowRequest
- SaveSheetWorkflowRequest
- SegmentInstallationCreated
- SheetWorkflow
- SheetWorkflowDeleted
- SheetWorkflowList
- SheetWorkflowPreview
- SheetWorkflowPreviewRowsInner
- SheetWorkflowResponse
- SheetWorkflowStateResponse
- SheetWorkflowValidation
- StartAttioOAuthRequest
- StartGoogleSheetsOAuthRequest
- StartIntegrationOAuthRequest
- UpdateIntegrationConnectionStateRequest
- UpdateLeadRequest
- UpdateLeadRequestCompany
- UpdateLeadRequestPerson
- UpdateLeadResponse
- UpdateLeadResponseLead
- UpdateSheetWorkflowStateRequest
- VerificationFinal
- VerificationProgress
- VerificationResponse
- VerificationResult
- VerificationStage
- VerificationStreamError

### Authorization


Authentication schemes defined for the API:
<a id="ApiKey"></a>
#### ApiKey


- **Type**: API key
- **API key parameter name**: `X-API-Key`
- **Location**: HTTP header
<a id="McpIdentityToken"></a>
#### McpIdentityToken


- **Type**: HTTP Bearer Token authentication

## About

This TypeScript SDK client supports the [Fetch API](https://fetch.spec.whatwg.org/)
and is automatically generated by the
[OpenAPI Generator](https://openapi-generator.tech) project:

- API version: `0.1.0`
- Package version: `2.0.12-beta.1`
- Generator version: `7.25.0`
- Build package: `org.openapitools.codegen.languages.TypeScriptFetchClientCodegen`

The generated npm module supports the following:

- Environments
  * Node.js
  * Webpack
  * Browserify
- Language levels
  * ES5 - you must have a Promises/A+ library installed
  * ES6
- Module systems
  * CommonJS
  * ES6 module system


## Development

### Building

To build the TypeScript source code, you need to have Node.js and npm installed.
After cloning the repository, navigate to the project directory and run:

```bash
npm install
npm run build
```

### Publishing

Once you've built the package, you can publish it to npm:

```bash
npm publish
```

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0.html)

The service URL is fixed to https://api.reacon.io. SDKs do not accept a service URL override.

## Retrying requests

A timeout or dropped connection does not prove that the server rejected a request. Before retrying a write or credit-consuming operation, check its outcome. Only retry when the operation is safe to repeat; when present, respect the Retry-After response header. Keep application-level retries bounded as well: wrapping an SDK call in an unbounded retry loop can multiply requests and repeat side effects.

## Reporting failures

When reporting a failure, include the SDK package version and HTTP status. Include a request identifier if the response supplies one. Remove API keys and customer data from logs and bug reports. Redact Authorization and X-API-Key headers before sharing a request. Never include the API key in a URL or a screenshot.
