# @reacon-io/sdk@0.4.0-beta.1

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
  basePath: 'https://api.reacon.io',
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
*CompaniesApi* | [**listCompanies**](docs/CompaniesApi.md#listcompanies) | **GET** /v1/companies | List companies
*DomainsApi* | [**getDomainCatchAll**](docs/DomainsApi.md#getdomaincatchall) | **GET** /v1/domains/{domain}/catch-all | Read domain catch-all status
*DomainsApi* | [**getDomainCompanyContext**](docs/DomainsApi.md#getdomaincompanycontext) | **GET** /v1/domains/{domain}/company-context | Get company context for a domain
*DomainsApi* | [**getDomainCounts**](docs/DomainsApi.md#getdomaincounts) | **GET** /v1/domains/{domain}/counts | Count known emails for a domain
*EmailsApi* | [**deleteEmail**](docs/EmailsApi.md#deleteemail) | **DELETE** /v1/emails/{email} | Delete an email and its mentions
*EmailsApi* | [**listEmailMentions**](docs/EmailsApi.md#listemailmentions) | **GET** /v1/emails/{email}/mentions | List sources mentioning an email
*EmailsApi* | [**listEmails**](docs/EmailsApi.md#listemails) | **GET** /v1/emails | List and reveal emails for a domain
*EmailsApi* | [**revealEmail**](docs/EmailsApi.md#revealemail) | **GET** /v1/emails/{email} | Reveal an email profile
*EmailsApi* | [**revealEmailById**](docs/EmailsApi.md#revealemailbyid) | **GET** /v1/emails/id/{id} | Reveal an email profile by ID
*IdentityApi* | [**getApiKeyIdentity**](docs/IdentityApi.md#getapikeyidentity) | **GET** /v1/whoami | Get API-key identity
*InsightsApi* | [**getEmailInsights**](docs/InsightsApi.md#getemailinsights) | **GET** /v1/insights/{email} | Extract insights associated with an email
*IntegrationsApi* | [**bindTypeformForm**](docs/IntegrationsApi.md#bindtypeformformoperation) | **POST** /v1/teams/{teamId}/integrations/typeform/oauth/bind | Bind a Typeform OAuth form
*IntegrationsApi* | [**bindWebflowForm**](docs/IntegrationsApi.md#bindwebflowformoperation) | **POST** /v1/teams/{teamId}/integrations/webflow/oauth/bind | Bind a Webflow OAuth form
*IntegrationsApi* | [**cancelIntegrationJob**](docs/IntegrationsApi.md#cancelintegrationjob) | **POST** /v1/teams/{teamId}/integrations/jobs/{jobId}/cancel | Cancel an integration job
*IntegrationsApi* | [**configureAirtableMapping**](docs/IntegrationsApi.md#configureairtablemappingoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/airtable-mapping/configure | Configure Airtable field mapping
*IntegrationsApi* | [**configureCoda**](docs/IntegrationsApi.md#configurecodaoperation) | **POST** /v1/teams/{teamId}/integrations/coda | Configure a Coda connection
*IntegrationsApi* | [**configureCrmMapping**](docs/IntegrationsApi.md#configurecrmmappingoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/crm-mapping/configure | Configure CRM field mapping
*IntegrationsApi* | [**configureCrmSync**](docs/IntegrationsApi.md#configurecrmsyncoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/crm-sync/configure | Configure CRM synchronization
*IntegrationsApi* | [**configureFreshsales**](docs/IntegrationsApi.md#configurefreshsalesoperation) | **POST** /v1/teams/{teamId}/integrations/freshsales | Configure a Freshsales connection
*IntegrationsApi* | [**configureNotificationRoutes**](docs/IntegrationsApi.md#configurenotificationroutesoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/notification-routes | Configure notification routes
*IntegrationsApi* | [**configureSlackDestination**](docs/IntegrationsApi.md#configureslackdestinationoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/slack-destination | Configure a Slack destination
*IntegrationsApi* | [**configureTeamsWorkflow**](docs/IntegrationsApi.md#configureteamsworkflowoperation) | **POST** /v1/teams/{teamId}/integrations/microsoft-teams | Configure a Microsoft Teams workflow
*IntegrationsApi* | [**configureTypeformForm**](docs/IntegrationsApi.md#configuretypeformformoperation) | **POST** /v1/teams/{teamId}/integrations/typeform | Configure a Typeform form
*IntegrationsApi* | [**configureWarehouse**](docs/IntegrationsApi.md#configurewarehouseoperation) | **POST** /v1/teams/{teamId}/integrations/warehouses | Configure a warehouse connection
*IntegrationsApi* | [**configureWebflowForm**](docs/IntegrationsApi.md#configurewebflowformoperation) | **POST** /v1/teams/{teamId}/integrations/webflow | Configure a Webflow form
*IntegrationsApi* | [**disableMcpIdentity**](docs/IntegrationsApi.md#disablemcpidentity) | **DELETE** /v1/teams/{teamId}/integrations/mcp-identities/{identityId} | Disable an MCP identity
*IntegrationsApi* | [**executeIntegrationCapability**](docs/IntegrationsApi.md#executeintegrationcapabilityoperation) | **POST** /v1/actions/{capability} | Execute an integration capability
*IntegrationsApi* | [**getAirtableMappingOptions**](docs/IntegrationsApi.md#getairtablemappingoptions) | **GET** /v1/teams/{teamId}/integrations/connections/{connectionId}/airtable-mapping-options | Get Airtable mapping options
*IntegrationsApi* | [**getCrmMappingOptions**](docs/IntegrationsApi.md#getcrmmappingoptions) | **GET** /v1/teams/{teamId}/integrations/connections/{connectionId}/crm-mapping-options | Get CRM mapping options
*IntegrationsApi* | [**getHubSpotConfigurationOptions**](docs/IntegrationsApi.md#gethubspotconfigurationoptions) | **GET** /v1/teams/{teamId}/integrations/connections/{connectionId}/hubspot-configuration-options | Get HubSpot configuration options
*IntegrationsApi* | [**getIntegrationJob**](docs/IntegrationsApi.md#getintegrationjob) | **GET** /v1/teams/{teamId}/integrations/jobs/{jobId} | Get an integration job
*IntegrationsApi* | [**inspectCodaTable**](docs/IntegrationsApi.md#inspectcodatableoperation) | **POST** /v1/teams/{teamId}/integrations/coda/inspect | Inspect Coda table columns
*IntegrationsApi* | [**inspectExcelWorkbook**](docs/IntegrationsApi.md#inspectexcelworkbookoperation) | **POST** /v1/teams/{teamId}/integrations/microsoft-excel/inspect | Inspect an Excel workbook
*IntegrationsApi* | [**inspectGoogleSheet**](docs/IntegrationsApi.md#inspectgooglesheetoperation) | **POST** /v1/teams/{teamId}/integrations/google-sheets/inspect | Inspect a Google spreadsheet
*IntegrationsApi* | [**linkMcpIdentity**](docs/IntegrationsApi.md#linkmcpidentityoperation) | **POST** /v1/teams/{teamId}/integrations/mcp-identities | Link an MCP identity
*IntegrationsApi* | [**listIntegrationConnections**](docs/IntegrationsApi.md#listintegrationconnections) | **GET** /v1/teams/{teamId}/integrations/connections | List integration connections
*IntegrationsApi* | [**listIntegrationJobs**](docs/IntegrationsApi.md#listintegrationjobs) | **GET** /v1/teams/{teamId}/integrations/jobs | List integration jobs
*IntegrationsApi* | [**listIntegrationProviders**](docs/IntegrationsApi.md#listintegrationproviders) | **GET** /v1/integrations/providers | List integration providers
*IntegrationsApi* | [**listMcpIdentities**](docs/IntegrationsApi.md#listmcpidentities) | **GET** /v1/teams/{teamId}/integrations/mcp-identities | List linked MCP identities
*IntegrationsApi* | [**listSheetWorkflows**](docs/IntegrationsApi.md#listsheetworkflows) | **GET** /v1/teams/{teamId}/integrations/spreadsheet-workflows | List spreadsheet workflows
*IntegrationsApi* | [**previewSheetWorkflow**](docs/IntegrationsApi.md#previewsheetworkflowoperation) | **POST** /v1/teams/{teamId}/integrations/spreadsheet-workflows/{workflowId}/preview | Preview spreadsheet workflow inputs
*IntegrationsApi* | [**queueIntegrationLeadExport**](docs/IntegrationsApi.md#queueintegrationleadexportoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/export-leads | Queue lead export to an integration
*IntegrationsApi* | [**queueNotificationTest**](docs/IntegrationsApi.md#queuenotificationtestoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/notification-test | Queue a test notification
*IntegrationsApi* | [**rotateCodaCredential**](docs/IntegrationsApi.md#rotatecodacredentialoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/credentials/coda/rotate | Rotate a Coda credential
*IntegrationsApi* | [**rotateFreshsalesCredential**](docs/IntegrationsApi.md#rotatefreshsalescredentialoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/credentials/freshsales/rotate | Rotate a Freshsales credential
*IntegrationsApi* | [**runSheetWorkflow**](docs/IntegrationsApi.md#runsheetworkflowoperation) | **POST** /v1/teams/{teamId}/integrations/spreadsheet-workflows/{workflowId}/run | Queue a spreadsheet workflow
*IntegrationsApi* | [**saveSheetWorkflow**](docs/IntegrationsApi.md#savesheetworkflowoperation) | **POST** /v1/teams/{teamId}/integrations/spreadsheet-workflows | Create or update a spreadsheet workflow
*IntegrationsApi* | [**startAttioOAuth**](docs/IntegrationsApi.md#startattiooauthoperation) | **POST** /v1/teams/{teamId}/integrations/attio/oauth/start | Start Attio authorization
*IntegrationsApi* | [**startGoogleSheetsOAuth**](docs/IntegrationsApi.md#startgooglesheetsoauthoperation) | **POST** /v1/teams/{teamId}/integrations/google-sheets/oauth/start | Start Google Sheets authorization
*IntegrationsApi* | [**startIntegrationOAuth**](docs/IntegrationsApi.md#startintegrationoauthoperation) | **POST** /v1/teams/{teamId}/integrations/{provider}/oauth/start | Start provider authorization
*IntegrationsApi* | [**testIntegrationConnection**](docs/IntegrationsApi.md#testintegrationconnection) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/test | Test an integration connection
*IntegrationsApi* | [**updateIntegrationConnectionState**](docs/IntegrationsApi.md#updateintegrationconnectionstateoperation) | **POST** /v1/teams/{teamId}/integrations/connections/{connectionId}/state | Change integration connection state
*IntegrationsApi* | [**updateSheetWorkflowState**](docs/IntegrationsApi.md#updatesheetworkflowstateoperation) | **POST** /v1/teams/{teamId}/integrations/spreadsheet-workflows/{workflowId}/state | Change spreadsheet workflow state
*LeadsApi* | [**createLead**](docs/LeadsApi.md#createleadoperation) | **POST** /v1/teams/{teamId}/leads | Create a lead in a team
*LeadsApi* | [**deleteLead**](docs/LeadsApi.md#deletelead) | **DELETE** /v1/leads/{leadId} | Delete a lead
*LeadsApi* | [**exportLeads**](docs/LeadsApi.md#exportleadsoperation) | **POST** /v1/teams/{teamId}/leads/export | Export selected leads
*LeadsApi* | [**getLead**](docs/LeadsApi.md#getlead) | **GET** /v1/leads/{leadId} | Retrieve a lead
*LeadsApi* | [**listLeads**](docs/LeadsApi.md#listleads) | **GET** /v1/teams/{teamId}/leads | List team leads
*LeadsApi* | [**updateLead**](docs/LeadsApi.md#updateleadoperation) | **POST** /v1/leads/{leadId}/update | Update a lead
*MailApi* | [**addMailPortfolioTeam**](docs/MailApi.md#addmailportfolioteam) | **POST** /v1/teams/{teamId}/mail/portfolio/teams | Add a team to a portfolio
*MailApi* | [**archiveMailExperiment**](docs/MailApi.md#archivemailexperiment) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/archive | Archive an experiment
*MailApi* | [**cancelMailMessage**](docs/MailApi.md#cancelmailmessage) | **POST** /v1/teams/{teamId}/mail/messages/{messageId}/cancel | Cancel a queued message
*MailApi* | [**changeMailCadenceCampaignState**](docs/MailApi.md#changemailcadencecampaignstate) | **POST** /v1/teams/{teamId}/mail/cadence-campaigns/{campaignId}/state | Change a cadence campaign state
*MailApi* | [**changeMailCadenceRunState**](docs/MailApi.md#changemailcadencerunstate) | **POST** /v1/teams/{teamId}/mail/cadence-runs/{runId}/state | Change a cadence run state
*MailApi* | [**changeMailCampaignState**](docs/MailApi.md#changemailcampaignstate) | **POST** /v1/teams/{teamId}/mail/campaigns/{campaignId}/state | Change a campaign state
*MailApi* | [**classifyMailReply**](docs/MailApi.md#classifymailreply) | **POST** /v1/teams/{teamId}/mail/crm/classify-reply | Classify a reply
*MailApi* | [**completeMailCrmTask**](docs/MailApi.md#completemailcrmtask) | **POST** /v1/teams/{teamId}/mail/crm/tasks/{taskId}/complete | Complete a CRM task
*MailApi* | [**configureMailDeliverability**](docs/MailApi.md#configuremaildeliverability) | **POST** /v1/teams/{teamId}/mail/deliverability/mailboxes/{mailboxId} | Configure a mailbox sending ramp
*MailApi* | [**configureMailTrackingDomain**](docs/MailApi.md#configuremailtrackingdomain) | **POST** /v1/teams/{teamId}/mail/tracking-domain | Configure a tracking domain
*MailApi* | [**copyMailCadence**](docs/MailApi.md#copymailcadence) | **POST** /v1/teams/{teamId}/mail/cadences/{cadenceId}/copy | Copy a cadence to another team
*MailApi* | [**copyMailTemplate**](docs/MailApi.md#copymailtemplate) | **POST** /v1/teams/{teamId}/mail/templates/{templateId}/copy | Copy a template to another team
*MailApi* | [**createMailCampaignDraft**](docs/MailApi.md#createmailcampaigndraft) | **POST** /v1/teams/{teamId}/mail/campaigns | Create a campaign draft
*MailApi* | [**createMailCrmNote**](docs/MailApi.md#createmailcrmnote) | **POST** /v1/teams/{teamId}/mail/crm/notes | Add a contact note
*MailApi* | [**createMailCrmTask**](docs/MailApi.md#createmailcrmtask) | **POST** /v1/teams/{teamId}/mail/crm/tasks | Create a CRM task
*MailApi* | [**createMailMailboxPool**](docs/MailApi.md#createmailmailboxpool) | **POST** /v1/teams/{teamId}/mail/deliverability/pools | Create a mailbox pool
*MailApi* | [**createMailPortfolio**](docs/MailApi.md#createmailportfolio) | **POST** /v1/teams/{teamId}/mail/portfolio | Create a mail portfolio
*MailApi* | [**createMailPortfolioSuppression**](docs/MailApi.md#createmailportfoliosuppression) | **POST** /v1/teams/{teamId}/mail/portfolio/suppressions | Create a portfolio suppression
*MailApi* | [**createMailSuppression**](docs/MailApi.md#createmailsuppression) | **POST** /v1/teams/{teamId}/mail/suppressions | Suppress an email or domain
*MailApi* | [**createMailWebhook**](docs/MailApi.md#createmailwebhook) | **POST** /v1/teams/{teamId}/mail/webhooks | Create a mail webhook
*MailApi* | [**decideMailExperiment**](docs/MailApi.md#decidemailexperiment) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/decide | Record an experiment decision
*MailApi* | [**deleteMailCampaignDraft**](docs/MailApi.md#deletemailcampaigndraft) | **DELETE** /v1/teams/{teamId}/mail/campaigns/{campaignId} | Delete a campaign draft
*MailApi* | [**deleteMailReplyAutomation**](docs/MailApi.md#deletemailreplyautomation) | **DELETE** /v1/teams/{teamId}/mail/reply-automations/{automationId} | Delete a reply automation
*MailApi* | [**deleteMailTrackingDomain**](docs/MailApi.md#deletemailtrackingdomain) | **DELETE** /v1/teams/{teamId}/mail/tracking-domain | Delete a tracking domain
*MailApi* | [**deleteMailWebhook**](docs/MailApi.md#deletemailwebhook) | **DELETE** /v1/teams/{teamId}/mail/webhooks/{subscriptionId} | Delete a mail webhook
*MailApi* | [**disconnectMailMailbox**](docs/MailApi.md#disconnectmailmailbox) | **DELETE** /v1/teams/{teamId}/mail/mailboxes/{mailboxId} | Disconnect a mailbox
*MailApi* | [**duplicateMailCampaignDraft**](docs/MailApi.md#duplicatemailcampaigndraft) | **POST** /v1/teams/{teamId}/mail/campaigns/{campaignId}/duplicate | Duplicate a campaign draft
*MailApi* | [**enqueueMailMessage**](docs/MailApi.md#enqueuemailmessage) | **POST** /v1/teams/{teamId}/mail/messages | Queue an outbound message
*MailApi* | [**enrollMailCadence**](docs/MailApi.md#enrollmailcadence) | **POST** /v1/teams/{teamId}/mail/cadence-runs | Enroll contacts in a cadence
*MailApi* | [**exportMailAnalytics**](docs/MailApi.md#exportmailanalytics) | **POST** /v1/teams/{teamId}/mail/analytics/export | Export mail analytics
*MailApi* | [**exportMailPortfolio**](docs/MailApi.md#exportmailportfolio) | **POST** /v1/teams/{teamId}/mail/portfolio/export | Export portfolio analytics
*MailApi* | [**getMailAnalytics**](docs/MailApi.md#getmailanalytics) | **GET** /v1/teams/{teamId}/mail/analytics | Get mail analytics
*MailApi* | [**getMailCampaignDraft**](docs/MailApi.md#getmailcampaigndraft) | **GET** /v1/teams/{teamId}/mail/campaigns/{campaignId} | Get a campaign draft
*MailApi* | [**getMailCampaignProgress**](docs/MailApi.md#getmailcampaignprogress) | **GET** /v1/teams/{teamId}/mail/campaign-progress | Get campaign progress
*MailApi* | [**getMailChannels**](docs/MailApi.md#getmailchannels) | **GET** /v1/teams/{teamId}/mail/channels | Get channel availability
*MailApi* | [**getMailContactStates**](docs/MailApi.md#getmailcontactstates) | **POST** /v1/teams/{teamId}/mail/crm/states/batch | Get contact CRM states in a batch
*MailApi* | [**getMailContacts**](docs/MailApi.md#getmailcontacts) | **POST** /v1/teams/{teamId}/mail/crm/contacts/batch | Get mail contacts in a batch
*MailApi* | [**getMailDeliverability**](docs/MailApi.md#getmaildeliverability) | **GET** /v1/teams/{teamId}/mail/deliverability | Get deliverability configuration
*MailApi* | [**getMailExperimentReport**](docs/MailApi.md#getmailexperimentreport) | **GET** /v1/teams/{teamId}/mail/experiments/{experimentKey}/report | Get an experiment report
*MailApi* | [**getMailExperimentsOverview**](docs/MailApi.md#getmailexperimentsoverview) | **GET** /v1/teams/{teamId}/mail/experiments-overview | Get experiment overview
*MailApi* | [**getMailOverview**](docs/MailApi.md#getmailoverview) | **GET** /v1/teams/{teamId}/mail/overview | Get mail overview
*MailApi* | [**getMailPortfolio**](docs/MailApi.md#getmailportfolio) | **GET** /v1/teams/{teamId}/mail/portfolio | Get a mail portfolio
*MailApi* | [**getMailPortfolioOverview**](docs/MailApi.md#getmailportfoliooverview) | **GET** /v1/teams/{teamId}/mail/portfolio/overview | Get portfolio analytics
*MailApi* | [**getMailQueue**](docs/MailApi.md#getmailqueue) | **GET** /v1/teams/{teamId}/mail/queue | Get mail queue status
*MailApi* | [**getMailTrackingDomain**](docs/MailApi.md#getmailtrackingdomain) | **GET** /v1/teams/{teamId}/mail/tracking-domain | Get tracking domain configuration
*MailApi* | [**inspectMailDomainHealth**](docs/MailApi.md#inspectmaildomainhealth) | **POST** /v1/teams/{teamId}/mail/deliverability/domain-health | Inspect domain authentication
*MailApi* | [**launchMailCadenceCampaign**](docs/MailApi.md#launchmailcadencecampaign) | **POST** /v1/teams/{teamId}/mail/cadence-campaigns | Queue a cadence campaign
*MailApi* | [**launchMailCampaignDraft**](docs/MailApi.md#launchmailcampaigndraft) | **POST** /v1/teams/{teamId}/mail/campaigns/{campaignId}/launch | Launch a campaign draft
*MailApi* | [**listMailAudienceLists**](docs/MailApi.md#listmailaudiencelists) | **GET** /v1/teams/{teamId}/mail/audience-lists | List campaign audience lists
*MailApi* | [**listMailCadenceCampaigns**](docs/MailApi.md#listmailcadencecampaigns) | **GET** /v1/teams/{teamId}/mail/cadence-campaigns | List cadence campaigns
*MailApi* | [**listMailCadenceRuns**](docs/MailApi.md#listmailcadenceruns) | **GET** /v1/teams/{teamId}/mail/cadence-runs | List cadence runs
*MailApi* | [**listMailCadences**](docs/MailApi.md#listmailcadences) | **GET** /v1/teams/{teamId}/mail/cadences | List cadences
*MailApi* | [**listMailCampaignDrafts**](docs/MailApi.md#listmailcampaigndrafts) | **GET** /v1/teams/{teamId}/mail/campaigns | List campaign drafts
*MailApi* | [**listMailContactStates**](docs/MailApi.md#listmailcontactstates) | **GET** /v1/teams/{teamId}/mail/crm/states | List contact CRM states
*MailApi* | [**listMailCrmTasks**](docs/MailApi.md#listmailcrmtasks) | **GET** /v1/teams/{teamId}/mail/crm/tasks | List CRM tasks
*MailApi* | [**listMailCrmTimeline**](docs/MailApi.md#listmailcrmtimeline) | **GET** /v1/teams/{teamId}/mail/crm/timeline | List CRM timeline events
*MailApi* | [**listMailExperiments**](docs/MailApi.md#listmailexperiments) | **GET** /v1/teams/{teamId}/mail/experiments | List mail experiments
*MailApi* | [**listMailInbox**](docs/MailApi.md#listmailinbox) | **GET** /v1/teams/{teamId}/mail/inbox | List inbox messages
*MailApi* | [**listMailInboxThreads**](docs/MailApi.md#listmailinboxthreads) | **GET** /v1/teams/{teamId}/mail/inbox/threads | List inbox conversation threads
*MailApi* | [**listMailMailboxes**](docs/MailApi.md#listmailmailboxes) | **GET** /v1/teams/{teamId}/mail/mailboxes | List mailboxes and connections
*MailApi* | [**listMailMessages**](docs/MailApi.md#listmailmessages) | **GET** /v1/teams/{teamId}/mail/messages | List mail delivery activity
*MailApi* | [**listMailReplyAutomations**](docs/MailApi.md#listmailreplyautomations) | **GET** /v1/teams/{teamId}/mail/reply-automations | List reply automations
*MailApi* | [**listMailSignatures**](docs/MailApi.md#listmailsignatures) | **GET** /v1/teams/{teamId}/mail/signatures | List extracted signatures
*MailApi* | [**listMailSuppressions**](docs/MailApi.md#listmailsuppressions) | **GET** /v1/teams/{teamId}/mail/suppressions | List mail suppressions
*MailApi* | [**listMailTemplates**](docs/MailApi.md#listmailtemplates) | **GET** /v1/teams/{teamId}/mail/templates | List message templates
*MailApi* | [**listMailWebhooks**](docs/MailApi.md#listmailwebhooks) | **GET** /v1/teams/{teamId}/mail/webhooks | List mail webhooks and deliveries
*MailApi* | [**pauseMailExperiment**](docs/MailApi.md#pausemailexperiment) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/pause | Pause an experiment
*MailApi* | [**pauseMailMailbox**](docs/MailApi.md#pausemailmailbox) | **POST** /v1/teams/{teamId}/mail/deliverability/mailboxes/{mailboxId}/pause | Pause a mailbox
*MailApi* | [**preflightMailCadenceEnrollment**](docs/MailApi.md#preflightmailcadenceenrollment) | **POST** /v1/teams/{teamId}/mail/cadence-runs/preflight | Check cadence enrollment
*MailApi* | [**provisionMailMailbox**](docs/MailApi.md#provisionmailmailbox) | **POST** /v1/teams/{teamId}/mail/mailboxes/manual | Connect an SMTP/IMAP mailbox
*MailApi* | [**reconcileMailMailboxHealth**](docs/MailApi.md#reconcilemailmailboxhealth) | **POST** /v1/teams/{teamId}/mail/deliverability/mailboxes/{mailboxId}/reconcile | Reconcile mailbox health
*MailApi* | [**reconcileMailWebhook**](docs/MailApi.md#reconcilemailwebhook) | **POST** /v1/teams/{teamId}/mail/webhooks/{subscriptionId}/reconcile | Reconcile a mail webhook
*MailApi* | [**recordMailExperimentConversion**](docs/MailApi.md#recordmailexperimentconversion) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/conversions | Record an experiment conversion
*MailApi* | [**removeMailMailboxPoolMember**](docs/MailApi.md#removemailmailboxpoolmember) | **DELETE** /v1/teams/{teamId}/mail/deliverability/pools/{poolId}/members/{mailboxId} | Remove a mailbox pool member
*MailApi* | [**removeMailPortfolioTeam**](docs/MailApi.md#removemailportfolioteam) | **DELETE** /v1/teams/{teamId}/mail/portfolio/teams/{memberTeamId} | Remove a team from a portfolio
*MailApi* | [**replayMailWebhookDelivery**](docs/MailApi.md#replaymailwebhookdelivery) | **POST** /v1/teams/{teamId}/mail/webhooks/deliveries/{deliveryId}/replay | Replay a webhook delivery
*MailApi* | [**replyToMailInboxMessage**](docs/MailApi.md#replytomailinboxmessage) | **POST** /v1/teams/{teamId}/mail/inbox/{messageId}/reply | Queue an inbox reply
*MailApi* | [**resumeMailExperiment**](docs/MailApi.md#resumemailexperiment) | **POST** /v1/teams/{teamId}/mail/experiments/{experimentKey}/resume | Resume an experiment
*MailApi* | [**resumeMailMailbox**](docs/MailApi.md#resumemailmailbox) | **POST** /v1/teams/{teamId}/mail/deliverability/mailboxes/{mailboxId}/resume | Resume a mailbox
*MailApi* | [**retryMailMessage**](docs/MailApi.md#retrymailmessage) | **POST** /v1/teams/{teamId}/mail/messages/{messageId}/retry | Retry a message explicitly
*MailApi* | [**rotateMailWebhookSecret**](docs/MailApi.md#rotatemailwebhooksecret) | **POST** /v1/teams/{teamId}/mail/webhooks/{subscriptionId}/rotate-secret | Rotate a mail webhook secret
*MailApi* | [**saveMailCadence**](docs/MailApi.md#savemailcadence) | **POST** /v1/teams/{teamId}/mail/cadences | Save a cadence version
*MailApi* | [**saveMailReplyAutomation**](docs/MailApi.md#savemailreplyautomation) | **POST** /v1/teams/{teamId}/mail/reply-automations | Save a reply automation
*MailApi* | [**saveMailTemplate**](docs/MailApi.md#savemailtemplate) | **POST** /v1/teams/{teamId}/mail/templates | Save a message template
*MailApi* | [**setMailContactState**](docs/MailApi.md#setmailcontactstate) | **PUT** /v1/teams/{teamId}/mail/crm/states | Set a contact CRM state
*MailApi* | [**setMailMailboxPoolMember**](docs/MailApi.md#setmailmailboxpoolmember) | **PUT** /v1/teams/{teamId}/mail/deliverability/pools/{poolId}/members/{mailboxId} | Set a mailbox pool member
*MailApi* | [**setMailWebhookStatus**](docs/MailApi.md#setmailwebhookstatus) | **POST** /v1/teams/{teamId}/mail/webhooks/{subscriptionId}/status | Set a mail webhook status
*MailApi* | [**startMailOAuth**](docs/MailApi.md#startmailoauth) | **POST** /v1/teams/{teamId}/mail/oauth/begin | Start mailbox authorization
*MailApi* | [**updateMailCampaignDraft**](docs/MailApi.md#updatemailcampaigndraft) | **PATCH** /v1/teams/{teamId}/mail/campaigns/{campaignId} | Update a campaign draft
*MailApi* | [**updateMailInboxMessage**](docs/MailApi.md#updatemailinboxmessage) | **POST** /v1/teams/{teamId}/mail/inbox/{messageId} | Update an inbox message
*MailApi* | [**updateMailWebhook**](docs/MailApi.md#updatemailwebhook) | **PATCH** /v1/teams/{teamId}/mail/webhooks/{subscriptionId} | Update a mail webhook
*MailApi* | [**verifyMailTrackingDomain**](docs/MailApi.md#verifymailtrackingdomain) | **POST** /v1/teams/{teamId}/mail/tracking-domain/verify | Verify a tracking domain
*NamesApi* | [**listNamePatterns**](docs/NamesApi.md#listnamepatterns) | **GET** /v1/name/schemas | List supported email name patterns
*NamesApi* | [**verifyName**](docs/NamesApi.md#verifyname) | **GET** /v1/name/verify | Verify name-based email patterns
*ProductToolsApi* | [**executeProductTool**](docs/ProductToolsApi.md#executeproducttool) | **POST** /v1/product/tools/{tool} | Execute a product tool
*StatsApi* | [**getStats**](docs/StatsApi.md#getstats) | **GET** /v1/stats | Get public dataset statistics
*VerificationApi* | [**verifyBatch**](docs/VerificationApi.md#verifybatch) | **POST** /v1/verify/batch | Verify a batch of email addresses
*VerificationApi* | [**verifyEmail**](docs/VerificationApi.md#verifyemail) | **GET** /v1/verify | Verify an email address
*WebhooksApi* | [**createAutomationHook**](docs/WebhooksApi.md#createautomationhookoperation) | **POST** /v1/hooks | Create an automation webhook
*WebhooksApi* | [**createSegmentInstallation**](docs/WebhooksApi.md#createsegmentinstallationoperation) | **POST** /v1/origin-installations/segment | Create a Segment origin installation
*WebhooksApi* | [**deleteAutomationHook**](docs/WebhooksApi.md#deleteautomationhook) | **DELETE** /v1/hooks/{hookId} | Delete an automation webhook
*WebhooksApi* | [**deleteSegmentInstallation**](docs/WebhooksApi.md#deletesegmentinstallation) | **DELETE** /v1/origin-installations/segment/{installationId} | Delete a Segment origin installation


### Models

- [AirtableMappingOptionsResponse](docs/AirtableMappingOptionsResponse.md)
- [AirtableMappingOptionsResponseOptions](docs/AirtableMappingOptionsResponseOptions.md)
- [AirtableMappingOptionsResponseOptionsBasesInner](docs/AirtableMappingOptionsResponseOptionsBasesInner.md)
- [AirtableMappingOptionsResponseOptionsTablesInner](docs/AirtableMappingOptionsResponseOptionsTablesInner.md)
- [AirtableMappingOptionsResponseOptionsTablesInnerFieldsInner](docs/AirtableMappingOptionsResponseOptionsTablesInnerFieldsInner.md)
- [ApiError](docs/ApiError.md)
- [ApiKeyIdentity](docs/ApiKeyIdentity.md)
- [AutomationHookCreated](docs/AutomationHookCreated.md)
- [BatchVerificationError](docs/BatchVerificationError.md)
- [BatchVerificationItem](docs/BatchVerificationItem.md)
- [BatchVerificationRequest](docs/BatchVerificationRequest.md)
- [BatchVerificationRequestOnlyIfFree](docs/BatchVerificationRequestOnlyIfFree.md)
- [BatchVerificationResponse](docs/BatchVerificationResponse.md)
- [BindTypeformFormRequest](docs/BindTypeformFormRequest.md)
- [BindWebflowFormRequest](docs/BindWebflowFormRequest.md)
- [CapabilityDomainSearch](docs/CapabilityDomainSearch.md)
- [CapabilityDomainSearchContactsInner](docs/CapabilityDomainSearchContactsInner.md)
- [CapabilityEmailFound](docs/CapabilityEmailFound.md)
- [CapabilityEmailVerified](docs/CapabilityEmailVerified.md)
- [CapabilityEmailVerifiedDetails](docs/CapabilityEmailVerifiedDetails.md)
- [CodaTableInspectionResponse](docs/CodaTableInspectionResponse.md)
- [CodaTableInspectionResponseInspection](docs/CodaTableInspectionResponseInspection.md)
- [CompanyContextAddress](docs/CompanyContextAddress.md)
- [CompanyContextJob](docs/CompanyContextJob.md)
- [CompanyContextSource](docs/CompanyContextSource.md)
- [CompanyList](docs/CompanyList.md)
- [CompanyListResultsInner](docs/CompanyListResultsInner.md)
- [CompanyListResultsInnerAddressesInner](docs/CompanyListResultsInnerAddressesInner.md)
- [ConfigureAirtableMappingRequest](docs/ConfigureAirtableMappingRequest.md)
- [ConfigureCodaRequest](docs/ConfigureCodaRequest.md)
- [ConfigureCodaRequestMapping](docs/ConfigureCodaRequestMapping.md)
- [ConfigureCrmMappingRequest](docs/ConfigureCrmMappingRequest.md)
- [ConfigureCrmSyncRequest](docs/ConfigureCrmSyncRequest.md)
- [ConfigureCrmSyncRequestConfiguration](docs/ConfigureCrmSyncRequestConfiguration.md)
- [ConfigureCrmSyncRequestConfigurationHubspot](docs/ConfigureCrmSyncRequestConfigurationHubspot.md)
- [ConfigureCrmSyncRequestConfigurationHubspotDeal](docs/ConfigureCrmSyncRequestConfigurationHubspotDeal.md)
- [ConfigureCrmSyncRequestConfigurationPolicy](docs/ConfigureCrmSyncRequestConfigurationPolicy.md)
- [ConfigureFreshsalesRequest](docs/ConfigureFreshsalesRequest.md)
- [ConfigureNotificationRoutesRequest](docs/ConfigureNotificationRoutesRequest.md)
- [ConfigureSlackDestinationRequest](docs/ConfigureSlackDestinationRequest.md)
- [ConfigureTeamsWorkflowRequest](docs/ConfigureTeamsWorkflowRequest.md)
- [ConfigureTypeformFormRequest](docs/ConfigureTypeformFormRequest.md)
- [ConfigureWarehouseRequest](docs/ConfigureWarehouseRequest.md)
- [ConfigureWebflowFormRequest](docs/ConfigureWebflowFormRequest.md)
- [CreateAutomationHookRequest](docs/CreateAutomationHookRequest.md)
- [CreateLeadRequest](docs/CreateLeadRequest.md)
- [CreateLeadRequestCompany](docs/CreateLeadRequestCompany.md)
- [CreateLeadRequestPerson](docs/CreateLeadRequestPerson.md)
- [CreateLeadResponse](docs/CreateLeadResponse.md)
- [CreateLeadResponseLead](docs/CreateLeadResponseLead.md)
- [CreateSegmentInstallationRequest](docs/CreateSegmentInstallationRequest.md)
- [CrmMappingOptionsResponse](docs/CrmMappingOptionsResponse.md)
- [CrmMappingOptionsResponseOptions](docs/CrmMappingOptionsResponseOptions.md)
- [CrmMappingOptionsResponseOptionsObjectsInner](docs/CrmMappingOptionsResponseOptionsObjectsInner.md)
- [CrmRemoteField](docs/CrmRemoteField.md)
- [CrmSyncConfiguration](docs/CrmSyncConfiguration.md)
- [CrmSyncConfigurationHubspot](docs/CrmSyncConfigurationHubspot.md)
- [CrmSyncConfigurationHubspotDeal](docs/CrmSyncConfigurationHubspotDeal.md)
- [CrmSyncConfigurationPolicy](docs/CrmSyncConfigurationPolicy.md)
- [CrmSyncConfigurationResponse](docs/CrmSyncConfigurationResponse.md)
- [DeleteEmailResponse](docs/DeleteEmailResponse.md)
- [DeleteLeadResponse](docs/DeleteLeadResponse.md)
- [DomainCatchAll](docs/DomainCatchAll.md)
- [DomainCompanyContext](docs/DomainCompanyContext.md)
- [DomainCompanyContextCompany](docs/DomainCompanyContextCompany.md)
- [DomainCounts](docs/DomainCounts.md)
- [EmailMention](docs/EmailMention.md)
- [EmailMentionsPage](docs/EmailMentionsPage.md)
- [EmailNotFoundError](docs/EmailNotFoundError.md)
- [EmailNotFoundErrorError](docs/EmailNotFoundErrorError.md)
- [EmailPage](docs/EmailPage.md)
- [EmailPageResultsInner](docs/EmailPageResultsInner.md)
- [EmailPageResultsInnerSourcesInner](docs/EmailPageResultsInnerSourcesInner.md)
- [EmailRevealResponse](docs/EmailRevealResponse.md)
- [EmailRevealResponseProfile](docs/EmailRevealResponseProfile.md)
- [ExcelWorkbookInspectionResponse](docs/ExcelWorkbookInspectionResponse.md)
- [ExcelWorkbookInspectionResponseInspection](docs/ExcelWorkbookInspectionResponseInspection.md)
- [ExecuteIntegrationCapabilityRequest](docs/ExecuteIntegrationCapabilityRequest.md)
- [ExportLeadsRequest](docs/ExportLeadsRequest.md)
- [ExportLeadsRequestSelectionScopesInner](docs/ExportLeadsRequestSelectionScopesInner.md)
- [GetLeadResponse](docs/GetLeadResponse.md)
- [GetLeadResponseLead](docs/GetLeadResponseLead.md)
- [GetLeadResponseLeadCompany](docs/GetLeadResponseLeadCompany.md)
- [GetLeadResponseLeadSync](docs/GetLeadResponseLeadSync.md)
- [GetLeadResponseLeadVerification](docs/GetLeadResponseLeadVerification.md)
- [GoogleSheetInspectionResponse](docs/GoogleSheetInspectionResponse.md)
- [GoogleSheetInspectionResponseInspection](docs/GoogleSheetInspectionResponseInspection.md)
- [HubSpotConfigurationOptionsResponse](docs/HubSpotConfigurationOptionsResponse.md)
- [HubSpotConfigurationOptionsResponseOptions](docs/HubSpotConfigurationOptionsResponseOptions.md)
- [HubSpotConfigurationOptionsResponseOptionsOwnersInner](docs/HubSpotConfigurationOptionsResponseOptionsOwnersInner.md)
- [HubSpotConfigurationOptionsResponseOptionsPipelinesInner](docs/HubSpotConfigurationOptionsResponseOptionsPipelinesInner.md)
- [HubSpotConfigurationOptionsResponseOptionsPipelinesInnerStagesInner](docs/HubSpotConfigurationOptionsResponseOptionsPipelinesInnerStagesInner.md)
- [InsightAddress](docs/InsightAddress.md)
- [InsightAddressEntry](docs/InsightAddressEntry.md)
- [InsightAttribute](docs/InsightAttribute.md)
- [InsightErrorEvent](docs/InsightErrorEvent.md)
- [InsightEvidence](docs/InsightEvidence.md)
- [InsightFinalEvent](docs/InsightFinalEvent.md)
- [InsightGeo](docs/InsightGeo.md)
- [InsightIdentifier](docs/InsightIdentifier.md)
- [InsightJurisdiction](docs/InsightJurisdiction.md)
- [InsightMention](docs/InsightMention.md)
- [InsightMentionErrorEvent](docs/InsightMentionErrorEvent.md)
- [InsightMentionExtractedEvent](docs/InsightMentionExtractedEvent.md)
- [InsightMentionInsightEvent](docs/InsightMentionInsightEvent.md)
- [InsightOffice](docs/InsightOffice.md)
- [InsightOrganization](docs/InsightOrganization.md)
- [InsightPhone](docs/InsightPhone.md)
- [InsightPlatformDetectedEvent](docs/InsightPlatformDetectedEvent.md)
- [InsightPlatformProgressEvent](docs/InsightPlatformProgressEvent.md)
- [InsightPlatformScan](docs/InsightPlatformScan.md)
- [InsightPlatformScanEvent](docs/InsightPlatformScanEvent.md)
- [InsightRole](docs/InsightRole.md)
- [InsightSocialProfile](docs/InsightSocialProfile.md)
- [InsightSource](docs/InsightSource.md)
- [InsightStartedEvent](docs/InsightStartedEvent.md)
- [InsightsResponse](docs/InsightsResponse.md)
- [InspectCodaTableRequest](docs/InspectCodaTableRequest.md)
- [InspectExcelWorkbookRequest](docs/InspectExcelWorkbookRequest.md)
- [InspectGoogleSheetRequest](docs/InspectGoogleSheetRequest.md)
- [IntegrationCapabilityResponse](docs/IntegrationCapabilityResponse.md)
- [IntegrationCapabilityResponseOutput](docs/IntegrationCapabilityResponseOutput.md)
- [IntegrationCapabilityResponseOutputNonNull](docs/IntegrationCapabilityResponseOutputNonNull.md)
- [IntegrationConnection](docs/IntegrationConnection.md)
- [IntegrationConnectionHealth](docs/IntegrationConnectionHealth.md)
- [IntegrationConnectionList](docs/IntegrationConnectionList.md)
- [IntegrationConnectionResponse](docs/IntegrationConnectionResponse.md)
- [IntegrationConnectionStateResponse](docs/IntegrationConnectionStateResponse.md)
- [IntegrationConnectionTest](docs/IntegrationConnectionTest.md)
- [IntegrationConnectionTestResponse](docs/IntegrationConnectionTestResponse.md)
- [IntegrationFormConnectionResponse](docs/IntegrationFormConnectionResponse.md)
- [IntegrationJob](docs/IntegrationJob.md)
- [IntegrationJobCancellation](docs/IntegrationJobCancellation.md)
- [IntegrationJobCounters](docs/IntegrationJobCounters.md)
- [IntegrationJobPage](docs/IntegrationJobPage.md)
- [IntegrationJobResponse](docs/IntegrationJobResponse.md)
- [IntegrationLeadExportResponse](docs/IntegrationLeadExportResponse.md)
- [IntegrationOAuthStartResponse](docs/IntegrationOAuthStartResponse.md)
- [IntegrationProviderList](docs/IntegrationProviderList.md)
- [IntegrationProviderListProvidersInner](docs/IntegrationProviderListProvidersInner.md)
- [IntegrationProviderListProvidersInnerConnectability](docs/IntegrationProviderListProvidersInnerConnectability.md)
- [IntegrationProviderListProvidersInnerReadiness](docs/IntegrationProviderListProvidersInnerReadiness.md)
- [LeadExportInner](docs/LeadExportInner.md)
- [LeadExportInnerCompany](docs/LeadExportInnerCompany.md)
- [LeadExportInnerPerson](docs/LeadExportInnerPerson.md)
- [LeadExportTooLargeError](docs/LeadExportTooLargeError.md)
- [LeadPage](docs/LeadPage.md)
- [LeadPageResultsInner](docs/LeadPageResultsInner.md)
- [LeadPageResultsInnerCompany](docs/LeadPageResultsInnerCompany.md)
- [LinkMcpIdentityRequest](docs/LinkMcpIdentityRequest.md)
- [MailCadenceCampaignRecord](docs/MailCadenceCampaignRecord.md)
- [MailCadenceDefinition](docs/MailCadenceDefinition.md)
- [MailCadenceEnrollmentVariableGap](docs/MailCadenceEnrollmentVariableGap.md)
- [MailCadenceExperimentContext](docs/MailCadenceExperimentContext.md)
- [MailCadenceMessageExperiment](docs/MailCadenceMessageExperiment.md)
- [MailCadenceMessageExperimentVariant](docs/MailCadenceMessageExperimentVariant.md)
- [MailCadenceNode](docs/MailCadenceNode.md)
- [MailCadenceNodeAnyOf](docs/MailCadenceNodeAnyOf.md)
- [MailCadenceNodeAnyOf1](docs/MailCadenceNodeAnyOf1.md)
- [MailCadenceNodeAnyOf2](docs/MailCadenceNodeAnyOf2.md)
- [MailCadenceNodeAnyOf3](docs/MailCadenceNodeAnyOf3.md)
- [MailCadenceNodeAnyOf4](docs/MailCadenceNodeAnyOf4.md)
- [MailCadenceNodeAnyOf4AllOfCondition](docs/MailCadenceNodeAnyOf4AllOfCondition.md)
- [MailCadenceNodeAnyOf5](docs/MailCadenceNodeAnyOf5.md)
- [MailCadenceNodeAnyOf6](docs/MailCadenceNodeAnyOf6.md)
- [MailCadenceNodeBase](docs/MailCadenceNodeBase.md)
- [MailCadenceRunRecord](docs/MailCadenceRunRecord.md)
- [MailCadenceStopConditions](docs/MailCadenceStopConditions.md)
- [MailCadenceWorkflowExperiment](docs/MailCadenceWorkflowExperiment.md)
- [MailCadenceWorkflowExperimentVariant](docs/MailCadenceWorkflowExperimentVariant.md)
- [MailCampaignDraftRecord](docs/MailCampaignDraftRecord.md)
- [MailCampaignDraftStep](docs/MailCampaignDraftStep.md)
- [MailCampaignProgress](docs/MailCampaignProgress.md)
- [MailCampaignProgressMessageCounts](docs/MailCampaignProgressMessageCounts.md)
- [MailContactCrmState](docs/MailContactCrmState.md)
- [MailContactListSummaryRecord](docs/MailContactListSummaryRecord.md)
- [MailContactRecord](docs/MailContactRecord.md)
- [MailConversationEntry](docs/MailConversationEntry.md)
- [MailConversationEntryFrom](docs/MailConversationEntryFrom.md)
- [MailConversationEntryLastError](docs/MailConversationEntryLastError.md)
- [MailConversationEntryLastErrorAnyOf](docs/MailConversationEntryLastErrorAnyOf.md)
- [MailConversationEntryLastErrorAnyOf1](docs/MailConversationEntryLastErrorAnyOf1.md)
- [MailConversationEntryLastErrorAnyOf2](docs/MailConversationEntryLastErrorAnyOf2.md)
- [MailConversationThread](docs/MailConversationThread.md)
- [MailCrmTask](docs/MailCrmTask.md)
- [MailCrmTimelineEvent](docs/MailCrmTimelineEvent.md)
- [MailDeleteCampaignsByCampaignIdRequest](docs/MailDeleteCampaignsByCampaignIdRequest.md)
- [MailDeleteCampaignsByCampaignIdResponse200](docs/MailDeleteCampaignsByCampaignIdResponse200.md)
- [MailDeleteDeliverabilityPoolsByPoolIdMembersByMailboxIdResponse200](docs/MailDeleteDeliverabilityPoolsByPoolIdMembersByMailboxIdResponse200.md)
- [MailDeleteMailboxesByMailboxIdResponse200](docs/MailDeleteMailboxesByMailboxIdResponse200.md)
- [MailDeletePortfolioTeamsByMemberTeamIdResponse200](docs/MailDeletePortfolioTeamsByMemberTeamIdResponse200.md)
- [MailDeleteReplyAutomationsByAutomationIdResponse200](docs/MailDeleteReplyAutomationsByAutomationIdResponse200.md)
- [MailDeleteTrackingDomainResponse200](docs/MailDeleteTrackingDomainResponse200.md)
- [MailDeleteWebhooksBySubscriptionIdResponse200](docs/MailDeleteWebhooksBySubscriptionIdResponse200.md)
- [MailDomainHealthCheck](docs/MailDomainHealthCheck.md)
- [MailDomainHealthReport](docs/MailDomainHealthReport.md)
- [MailEvidenceField](docs/MailEvidenceField.md)
- [MailExperimentDecisionRecord](docs/MailExperimentDecisionRecord.md)
- [MailExperimentDefinitionRecord](docs/MailExperimentDefinitionRecord.md)
- [MailExperimentOutcomeRecord](docs/MailExperimentOutcomeRecord.md)
- [MailExperimentReport](docs/MailExperimentReport.md)
- [MailExperimentReportDecision](docs/MailExperimentReportDecision.md)
- [MailExperimentRevisionRecord](docs/MailExperimentRevisionRecord.md)
- [MailExperimentVariant](docs/MailExperimentVariant.md)
- [MailExperimentVariantReport](docs/MailExperimentVariantReport.md)
- [MailExperimentVariantReportConfidenceInterval95](docs/MailExperimentVariantReportConfidenceInterval95.md)
- [MailExperimentVariantReportGuardrails](docs/MailExperimentVariantReportGuardrails.md)
- [MailGetAnalyticsResponse200](docs/MailGetAnalyticsResponse200.md)
- [MailGetAudienceListsResponse200](docs/MailGetAudienceListsResponse200.md)
- [MailGetCadenceCampaignsResponse200](docs/MailGetCadenceCampaignsResponse200.md)
- [MailGetCadenceRunsResponse200](docs/MailGetCadenceRunsResponse200.md)
- [MailGetCadencesResponse200](docs/MailGetCadencesResponse200.md)
- [MailGetCampaignProgressResponse200](docs/MailGetCampaignProgressResponse200.md)
- [MailGetCampaignsByCampaignIdResponse200](docs/MailGetCampaignsByCampaignIdResponse200.md)
- [MailGetCampaignsResponse200](docs/MailGetCampaignsResponse200.md)
- [MailGetChannelsResponse200](docs/MailGetChannelsResponse200.md)
- [MailGetChannelsResponse200Email](docs/MailGetChannelsResponse200Email.md)
- [MailGetChannelsResponse200Execution](docs/MailGetChannelsResponse200Execution.md)
- [MailGetChannelsResponse200Sms](docs/MailGetChannelsResponse200Sms.md)
- [MailGetChannelsResponse200Whatsapp](docs/MailGetChannelsResponse200Whatsapp.md)
- [MailGetCrmStatesResponse200](docs/MailGetCrmStatesResponse200.md)
- [MailGetCrmTasksResponse200](docs/MailGetCrmTasksResponse200.md)
- [MailGetCrmTimelineResponse200](docs/MailGetCrmTimelineResponse200.md)
- [MailGetDeliverabilityResponse200](docs/MailGetDeliverabilityResponse200.md)
- [MailGetDeliverabilityResponse200PoolsInner](docs/MailGetDeliverabilityResponse200PoolsInner.md)
- [MailGetExperimentsByExperimentKeyReportResponse200](docs/MailGetExperimentsByExperimentKeyReportResponse200.md)
- [MailGetExperimentsOverviewResponse200](docs/MailGetExperimentsOverviewResponse200.md)
- [MailGetExperimentsResponse200](docs/MailGetExperimentsResponse200.md)
- [MailGetExperimentsResponse200ResultsInner](docs/MailGetExperimentsResponse200ResultsInner.md)
- [MailGetInboxResponse200](docs/MailGetInboxResponse200.md)
- [MailGetInboxThreadsResponse200](docs/MailGetInboxThreadsResponse200.md)
- [MailGetMailboxesResponse200](docs/MailGetMailboxesResponse200.md)
- [MailGetMessagesResponse200](docs/MailGetMessagesResponse200.md)
- [MailGetOverviewResponse200](docs/MailGetOverviewResponse200.md)
- [MailGetOverviewResponse200Inbox](docs/MailGetOverviewResponse200Inbox.md)
- [MailGetPortfolioOverviewResponse200](docs/MailGetPortfolioOverviewResponse200.md)
- [MailGetPortfolioResponse200](docs/MailGetPortfolioResponse200.md)
- [MailGetPortfolioResponse200AnyOf](docs/MailGetPortfolioResponse200AnyOf.md)
- [MailGetPortfolioResponse200AnyOf1](docs/MailGetPortfolioResponse200AnyOf1.md)
- [MailGetPortfolioResponse200Portfolio](docs/MailGetPortfolioResponse200Portfolio.md)
- [MailGetQueueResponse200](docs/MailGetQueueResponse200.md)
- [MailGetReplyAutomationsResponse200](docs/MailGetReplyAutomationsResponse200.md)
- [MailGetSignaturesResponse200](docs/MailGetSignaturesResponse200.md)
- [MailGetSuppressionsResponse200](docs/MailGetSuppressionsResponse200.md)
- [MailGetTemplatesResponse200](docs/MailGetTemplatesResponse200.md)
- [MailGetTrackingDomainResponse200](docs/MailGetTrackingDomainResponse200.md)
- [MailGetTrackingDomainResponse200Domain](docs/MailGetTrackingDomainResponse200Domain.md)
- [MailGetWebhooksResponse200](docs/MailGetWebhooksResponse200.md)
- [MailGetWebhooksResponse200SubscriptionsInner](docs/MailGetWebhooksResponse200SubscriptionsInner.md)
- [MailInboxMessageRecord](docs/MailInboxMessageRecord.md)
- [MailMailAddress](docs/MailMailAddress.md)
- [MailMailPortfolio](docs/MailMailPortfolio.md)
- [MailMailPortfolioOverviewRow](docs/MailMailPortfolioOverviewRow.md)
- [MailMailPortfolioSuppression](docs/MailMailPortfolioSuppression.md)
- [MailMailPortfolioTeam](docs/MailMailPortfolioTeam.md)
- [MailMailboxConnectionRecord](docs/MailMailboxConnectionRecord.md)
- [MailMailboxHealthRecord](docs/MailMailboxHealthRecord.md)
- [MailMailboxPoolMember](docs/MailMailboxPoolMember.md)
- [MailMailboxProviderKind](docs/MailMailboxProviderKind.md)
- [MailMailboxRecord](docs/MailMailboxRecord.md)
- [MailMessageAnalyticsOverview](docs/MailMessageAnalyticsOverview.md)
- [MailMessageAnalyticsOverviewDailyInner](docs/MailMessageAnalyticsOverviewDailyInner.md)
- [MailMessageAnalyticsOverviewMailboxesInner](docs/MailMessageAnalyticsOverviewMailboxesInner.md)
- [MailMessageAnalyticsOverviewVariantsInner](docs/MailMessageAnalyticsOverviewVariantsInner.md)
- [MailMessagePolicy](docs/MailMessagePolicy.md)
- [MailMessagePolicyInput](docs/MailMessagePolicyInput.md)
- [MailMessageRecord](docs/MailMessageRecord.md)
- [MailMessageTemplateVersion](docs/MailMessageTemplateVersion.md)
- [MailMessageTemplateVersionWhatsappApproval](docs/MailMessageTemplateVersionWhatsappApproval.md)
- [MailMessageVariantInput](docs/MailMessageVariantInput.md)
- [MailOperationalAnalyticsOverview](docs/MailOperationalAnalyticsOverview.md)
- [MailOperationalAnalyticsOverviewCadenceStepsInner](docs/MailOperationalAnalyticsOverviewCadenceStepsInner.md)
- [MailPatchCampaignsByCampaignIdRequest](docs/MailPatchCampaignsByCampaignIdRequest.md)
- [MailPatchCampaignsByCampaignIdRequestPolicy](docs/MailPatchCampaignsByCampaignIdRequestPolicy.md)
- [MailPatchCampaignsByCampaignIdRequestPolicyDomainQuotasInner](docs/MailPatchCampaignsByCampaignIdRequestPolicyDomainQuotasInner.md)
- [MailPatchCampaignsByCampaignIdRequestPolicySendingWindowsInner](docs/MailPatchCampaignsByCampaignIdRequestPolicySendingWindowsInner.md)
- [MailPatchCampaignsByCampaignIdRequestStepsInner](docs/MailPatchCampaignsByCampaignIdRequestStepsInner.md)
- [MailPatchCampaignsByCampaignIdRequestStepsInnerVariantsInner](docs/MailPatchCampaignsByCampaignIdRequestStepsInnerVariantsInner.md)
- [MailPatchCampaignsByCampaignIdResponse200](docs/MailPatchCampaignsByCampaignIdResponse200.md)
- [MailPatchWebhooksBySubscriptionIdRequest](docs/MailPatchWebhooksBySubscriptionIdRequest.md)
- [MailPatchWebhooksBySubscriptionIdResponse200](docs/MailPatchWebhooksBySubscriptionIdResponse200.md)
- [MailPhoneNumberValue](docs/MailPhoneNumberValue.md)
- [MailPostAnalyticsExportRequest](docs/MailPostAnalyticsExportRequest.md)
- [MailPostAnalyticsExportRequestAfter](docs/MailPostAnalyticsExportRequestAfter.md)
- [MailPostAnalyticsExportResponse200](docs/MailPostAnalyticsExportResponse200.md)
- [MailPostAnalyticsExportResponse200NextCursor](docs/MailPostAnalyticsExportResponse200NextCursor.md)
- [MailPostCadenceCampaignsByCampaignIdStateRequest](docs/MailPostCadenceCampaignsByCampaignIdStateRequest.md)
- [MailPostCadenceCampaignsByCampaignIdStateResponse200](docs/MailPostCadenceCampaignsByCampaignIdStateResponse200.md)
- [MailPostCadenceCampaignsByCampaignIdStateResponse200AnyOf](docs/MailPostCadenceCampaignsByCampaignIdStateResponse200AnyOf.md)
- [MailPostCadenceCampaignsByCampaignIdStateResponse200AnyOf1](docs/MailPostCadenceCampaignsByCampaignIdStateResponse200AnyOf1.md)
- [MailPostCadenceCampaignsRequest](docs/MailPostCadenceCampaignsRequest.md)
- [MailPostCadenceCampaignsResponse202](docs/MailPostCadenceCampaignsResponse202.md)
- [MailPostCadenceRunsByRunIdStateRequest](docs/MailPostCadenceRunsByRunIdStateRequest.md)
- [MailPostCadenceRunsByRunIdStateResponse200](docs/MailPostCadenceRunsByRunIdStateResponse200.md)
- [MailPostCadenceRunsPreflightRequest](docs/MailPostCadenceRunsPreflightRequest.md)
- [MailPostCadenceRunsPreflightResponse200](docs/MailPostCadenceRunsPreflightResponse200.md)
- [MailPostCadenceRunsRequest](docs/MailPostCadenceRunsRequest.md)
- [MailPostCadenceRunsResponse200](docs/MailPostCadenceRunsResponse200.md)
- [MailPostCadencesByCadenceIdCopyRequest](docs/MailPostCadencesByCadenceIdCopyRequest.md)
- [MailPostCadencesByCadenceIdCopyResponse200](docs/MailPostCadencesByCadenceIdCopyResponse200.md)
- [MailPostCadencesRequest](docs/MailPostCadencesRequest.md)
- [MailPostCadencesRequestNodesInner](docs/MailPostCadencesRequestNodesInner.md)
- [MailPostCadencesRequestNodesInnerAnyOf](docs/MailPostCadencesRequestNodesInnerAnyOf.md)
- [MailPostCadencesRequestNodesInnerAnyOf1](docs/MailPostCadencesRequestNodesInnerAnyOf1.md)
- [MailPostCadencesRequestNodesInnerAnyOf1Experiment](docs/MailPostCadencesRequestNodesInnerAnyOf1Experiment.md)
- [MailPostCadencesRequestNodesInnerAnyOf1ExperimentVariantsInner](docs/MailPostCadencesRequestNodesInnerAnyOf1ExperimentVariantsInner.md)
- [MailPostCadencesRequestNodesInnerAnyOf2](docs/MailPostCadencesRequestNodesInnerAnyOf2.md)
- [MailPostCadencesRequestNodesInnerAnyOf3](docs/MailPostCadencesRequestNodesInnerAnyOf3.md)
- [MailPostCadencesRequestNodesInnerAnyOf4](docs/MailPostCadencesRequestNodesInnerAnyOf4.md)
- [MailPostCadencesRequestNodesInnerAnyOf4Condition](docs/MailPostCadencesRequestNodesInnerAnyOf4Condition.md)
- [MailPostCadencesRequestNodesInnerAnyOf5](docs/MailPostCadencesRequestNodesInnerAnyOf5.md)
- [MailPostCadencesRequestNodesInnerAnyOf5Experiment](docs/MailPostCadencesRequestNodesInnerAnyOf5Experiment.md)
- [MailPostCadencesRequestNodesInnerAnyOf5ExperimentVariantsInner](docs/MailPostCadencesRequestNodesInnerAnyOf5ExperimentVariantsInner.md)
- [MailPostCadencesRequestNodesInnerAnyOf6](docs/MailPostCadencesRequestNodesInnerAnyOf6.md)
- [MailPostCadencesRequestStopConditions](docs/MailPostCadencesRequestStopConditions.md)
- [MailPostCadencesResponse200](docs/MailPostCadencesResponse200.md)
- [MailPostCampaignsByCampaignIdDuplicateResponse201](docs/MailPostCampaignsByCampaignIdDuplicateResponse201.md)
- [MailPostCampaignsByCampaignIdLaunchRequest](docs/MailPostCampaignsByCampaignIdLaunchRequest.md)
- [MailPostCampaignsByCampaignIdLaunchResponse200](docs/MailPostCampaignsByCampaignIdLaunchResponse200.md)
- [MailPostCampaignsByCampaignIdLaunchResponse200AnyOf](docs/MailPostCampaignsByCampaignIdLaunchResponse200AnyOf.md)
- [MailPostCampaignsByCampaignIdLaunchResponse200AnyOf1](docs/MailPostCampaignsByCampaignIdLaunchResponse200AnyOf1.md)
- [MailPostCampaignsByCampaignIdLaunchResponse200Campaign](docs/MailPostCampaignsByCampaignIdLaunchResponse200Campaign.md)
- [MailPostCampaignsByCampaignIdStateRequest](docs/MailPostCampaignsByCampaignIdStateRequest.md)
- [MailPostCampaignsByCampaignIdStateResponse200](docs/MailPostCampaignsByCampaignIdStateResponse200.md)
- [MailPostCampaignsRequest](docs/MailPostCampaignsRequest.md)
- [MailPostCampaignsResponse201](docs/MailPostCampaignsResponse201.md)
- [MailPostCrmClassifyReplyRequest](docs/MailPostCrmClassifyReplyRequest.md)
- [MailPostCrmClassifyReplyResponse200](docs/MailPostCrmClassifyReplyResponse200.md)
- [MailPostCrmContactsBatchRequest](docs/MailPostCrmContactsBatchRequest.md)
- [MailPostCrmContactsBatchResponse200](docs/MailPostCrmContactsBatchResponse200.md)
- [MailPostCrmNotesRequest](docs/MailPostCrmNotesRequest.md)
- [MailPostCrmNotesResponse200](docs/MailPostCrmNotesResponse200.md)
- [MailPostCrmNotesResponse200Event](docs/MailPostCrmNotesResponse200Event.md)
- [MailPostCrmNotesResponse200EventPayload](docs/MailPostCrmNotesResponse200EventPayload.md)
- [MailPostCrmStatesBatchRequest](docs/MailPostCrmStatesBatchRequest.md)
- [MailPostCrmStatesBatchResponse200](docs/MailPostCrmStatesBatchResponse200.md)
- [MailPostCrmTasksByTaskIdCompleteRequest](docs/MailPostCrmTasksByTaskIdCompleteRequest.md)
- [MailPostCrmTasksByTaskIdCompleteResponse200](docs/MailPostCrmTasksByTaskIdCompleteResponse200.md)
- [MailPostCrmTasksRequest](docs/MailPostCrmTasksRequest.md)
- [MailPostCrmTasksResponse201](docs/MailPostCrmTasksResponse201.md)
- [MailPostDeliverabilityDomainHealthRequest](docs/MailPostDeliverabilityDomainHealthRequest.md)
- [MailPostDeliverabilityDomainHealthResponse200](docs/MailPostDeliverabilityDomainHealthResponse200.md)
- [MailPostDeliverabilityMailboxesByMailboxIdPauseRequest](docs/MailPostDeliverabilityMailboxesByMailboxIdPauseRequest.md)
- [MailPostDeliverabilityMailboxesByMailboxIdPauseResponse200](docs/MailPostDeliverabilityMailboxesByMailboxIdPauseResponse200.md)
- [MailPostDeliverabilityMailboxesByMailboxIdReconcileResponse200](docs/MailPostDeliverabilityMailboxesByMailboxIdReconcileResponse200.md)
- [MailPostDeliverabilityMailboxesByMailboxIdRequest](docs/MailPostDeliverabilityMailboxesByMailboxIdRequest.md)
- [MailPostDeliverabilityMailboxesByMailboxIdResponse200](docs/MailPostDeliverabilityMailboxesByMailboxIdResponse200.md)
- [MailPostDeliverabilityMailboxesByMailboxIdResumeResponse200](docs/MailPostDeliverabilityMailboxesByMailboxIdResumeResponse200.md)
- [MailPostDeliverabilityPoolsRequest](docs/MailPostDeliverabilityPoolsRequest.md)
- [MailPostDeliverabilityPoolsResponse201](docs/MailPostDeliverabilityPoolsResponse201.md)
- [MailPostDeliverabilityPoolsResponse201Pool](docs/MailPostDeliverabilityPoolsResponse201Pool.md)
- [MailPostExperimentsByExperimentKeyArchiveResponse200](docs/MailPostExperimentsByExperimentKeyArchiveResponse200.md)
- [MailPostExperimentsByExperimentKeyConversionsRequest](docs/MailPostExperimentsByExperimentKeyConversionsRequest.md)
- [MailPostExperimentsByExperimentKeyConversionsResponse200](docs/MailPostExperimentsByExperimentKeyConversionsResponse200.md)
- [MailPostExperimentsByExperimentKeyDecideRequest](docs/MailPostExperimentsByExperimentKeyDecideRequest.md)
- [MailPostExperimentsByExperimentKeyDecideResponse200](docs/MailPostExperimentsByExperimentKeyDecideResponse200.md)
- [MailPostExperimentsByExperimentKeyPauseResponse200](docs/MailPostExperimentsByExperimentKeyPauseResponse200.md)
- [MailPostExperimentsByExperimentKeyResumeResponse200](docs/MailPostExperimentsByExperimentKeyResumeResponse200.md)
- [MailPostInboxByMessageIdReplyRequest](docs/MailPostInboxByMessageIdReplyRequest.md)
- [MailPostInboxByMessageIdReplyResponse200](docs/MailPostInboxByMessageIdReplyResponse200.md)
- [MailPostInboxByMessageIdRequest](docs/MailPostInboxByMessageIdRequest.md)
- [MailPostInboxByMessageIdResponse200](docs/MailPostInboxByMessageIdResponse200.md)
- [MailPostInboxByMessageIdResponse200Message](docs/MailPostInboxByMessageIdResponse200Message.md)
- [MailPostMailboxesManualRequest](docs/MailPostMailboxesManualRequest.md)
- [MailPostMailboxesManualRequestImap](docs/MailPostMailboxesManualRequestImap.md)
- [MailPostMailboxesManualRequestSmtp](docs/MailPostMailboxesManualRequestSmtp.md)
- [MailPostMailboxesManualResponse200](docs/MailPostMailboxesManualResponse200.md)
- [MailPostMessagesByMessageIdCancelResponse200](docs/MailPostMessagesByMessageIdCancelResponse200.md)
- [MailPostMessagesByMessageIdRetryResponse200](docs/MailPostMessagesByMessageIdRetryResponse200.md)
- [MailPostMessagesRequest](docs/MailPostMessagesRequest.md)
- [MailPostMessagesRequestTo](docs/MailPostMessagesRequestTo.md)
- [MailPostMessagesResponse201](docs/MailPostMessagesResponse201.md)
- [MailPostOauthBeginRequest](docs/MailPostOauthBeginRequest.md)
- [MailPostOauthBeginResponse200](docs/MailPostOauthBeginResponse200.md)
- [MailPostPortfolioExportResponse200](docs/MailPostPortfolioExportResponse200.md)
- [MailPostPortfolioRequest](docs/MailPostPortfolioRequest.md)
- [MailPostPortfolioResponse200](docs/MailPostPortfolioResponse200.md)
- [MailPostPortfolioSuppressionsRequest](docs/MailPostPortfolioSuppressionsRequest.md)
- [MailPostPortfolioSuppressionsRequestAnyOf](docs/MailPostPortfolioSuppressionsRequestAnyOf.md)
- [MailPostPortfolioSuppressionsRequestAnyOf1](docs/MailPostPortfolioSuppressionsRequestAnyOf1.md)
- [MailPostPortfolioSuppressionsResponse200](docs/MailPostPortfolioSuppressionsResponse200.md)
- [MailPostPortfolioTeamsRequest](docs/MailPostPortfolioTeamsRequest.md)
- [MailPostPortfolioTeamsResponse200](docs/MailPostPortfolioTeamsResponse200.md)
- [MailPostReplyAutomationsRequest](docs/MailPostReplyAutomationsRequest.md)
- [MailPostReplyAutomationsRequestActions](docs/MailPostReplyAutomationsRequestActions.md)
- [MailPostReplyAutomationsRequestActionsTask](docs/MailPostReplyAutomationsRequestActionsTask.md)
- [MailPostReplyAutomationsResponse200](docs/MailPostReplyAutomationsResponse200.md)
- [MailPostSuppressionsRequest](docs/MailPostSuppressionsRequest.md)
- [MailPostSuppressionsRequestAnyOf](docs/MailPostSuppressionsRequestAnyOf.md)
- [MailPostSuppressionsRequestAnyOf1](docs/MailPostSuppressionsRequestAnyOf1.md)
- [MailPostSuppressionsResponse200](docs/MailPostSuppressionsResponse200.md)
- [MailPostTemplatesByTemplateIdCopyRequest](docs/MailPostTemplatesByTemplateIdCopyRequest.md)
- [MailPostTemplatesByTemplateIdCopyResponse200](docs/MailPostTemplatesByTemplateIdCopyResponse200.md)
- [MailPostTemplatesRequest](docs/MailPostTemplatesRequest.md)
- [MailPostTemplatesRequestWhatsappApproval](docs/MailPostTemplatesRequestWhatsappApproval.md)
- [MailPostTemplatesResponse200](docs/MailPostTemplatesResponse200.md)
- [MailPostTrackingDomainRequest](docs/MailPostTrackingDomainRequest.md)
- [MailPostTrackingDomainResponse200](docs/MailPostTrackingDomainResponse200.md)
- [MailPostTrackingDomainVerifyResponse200](docs/MailPostTrackingDomainVerifyResponse200.md)
- [MailPostWebhooksBySubscriptionIdReconcileResponse200](docs/MailPostWebhooksBySubscriptionIdReconcileResponse200.md)
- [MailPostWebhooksBySubscriptionIdRotateSecretResponse200](docs/MailPostWebhooksBySubscriptionIdRotateSecretResponse200.md)
- [MailPostWebhooksBySubscriptionIdStatusRequest](docs/MailPostWebhooksBySubscriptionIdStatusRequest.md)
- [MailPostWebhooksBySubscriptionIdStatusResponse200](docs/MailPostWebhooksBySubscriptionIdStatusResponse200.md)
- [MailPostWebhooksDeliveriesByDeliveryIdReplayResponse200](docs/MailPostWebhooksDeliveriesByDeliveryIdReplayResponse200.md)
- [MailPostWebhooksRequest](docs/MailPostWebhooksRequest.md)
- [MailPostWebhooksResponse201](docs/MailPostWebhooksResponse201.md)
- [MailProviderFailure](docs/MailProviderFailure.md)
- [MailPutCrmStatesRequest](docs/MailPutCrmStatesRequest.md)
- [MailPutCrmStatesResponse200](docs/MailPutCrmStatesResponse200.md)
- [MailPutDeliverabilityPoolsByPoolIdMembersByMailboxIdRequest](docs/MailPutDeliverabilityPoolsByPoolIdMembersByMailboxIdRequest.md)
- [MailPutDeliverabilityPoolsByPoolIdMembersByMailboxIdResponse200](docs/MailPutDeliverabilityPoolsByPoolIdMembersByMailboxIdResponse200.md)
- [MailQueueSnapshot](docs/MailQueueSnapshot.md)
- [MailQuotaRule](docs/MailQuotaRule.md)
- [MailRenderedMessage](docs/MailRenderedMessage.md)
- [MailReplyAutomationRule](docs/MailReplyAutomationRule.md)
- [MailReplyAutomationRuleActions](docs/MailReplyAutomationRuleActions.md)
- [MailReplyAutomationRuleActionsTask](docs/MailReplyAutomationRuleActionsTask.md)
- [MailReplyClassificationResult](docs/MailReplyClassificationResult.md)
- [MailSendingWindow](docs/MailSendingWindow.md)
- [MailSequenceRunRecord](docs/MailSequenceRunRecord.md)
- [MailSignatureCandidate](docs/MailSignatureCandidate.md)
- [MailSignatureCandidateFields](docs/MailSignatureCandidateFields.md)
- [MailSignatureCandidateFieldsPhonesInner](docs/MailSignatureCandidateFieldsPhonesInner.md)
- [MailStoredImapSettings](docs/MailStoredImapSettings.md)
- [MailStoredSmtpSettings](docs/MailStoredSmtpSettings.md)
- [MailSuppressionRecord](docs/MailSuppressionRecord.md)
- [MailTrackingDomainRecord](docs/MailTrackingDomainRecord.md)
- [MailWebhookDelivery](docs/MailWebhookDelivery.md)
- [MailWebhookEventSnapshot](docs/MailWebhookEventSnapshot.md)
- [McpIdentity](docs/McpIdentity.md)
- [McpIdentityList](docs/McpIdentityList.md)
- [McpIdentityResponse](docs/McpIdentityResponse.md)
- [NamePattern](docs/NamePattern.md)
- [NamePatternsResponse](docs/NamePatternsResponse.md)
- [NameVerificationEmptyFinal](docs/NameVerificationEmptyFinal.md)
- [NameVerificationItem](docs/NameVerificationItem.md)
- [NameVerificationResponse](docs/NameVerificationResponse.md)
- [PersonInsight](docs/PersonInsight.md)
- [PreviewSheetWorkflowRequest](docs/PreviewSheetWorkflowRequest.md)
- [ProductAccountInfoExecution](docs/ProductAccountInfoExecution.md)
- [ProductAccountInfoOutput](docs/ProductAccountInfoOutput.md)
- [ProductCombinedEnrichExecution](docs/ProductCombinedEnrichExecution.md)
- [ProductCombinedEnrichInput](docs/ProductCombinedEnrichInput.md)
- [ProductCombinedEnrichOutput](docs/ProductCombinedEnrichOutput.md)
- [ProductCompaniesListExecution](docs/ProductCompaniesListExecution.md)
- [ProductCompaniesListInput](docs/ProductCompaniesListInput.md)
- [ProductCompaniesListOutput](docs/ProductCompaniesListOutput.md)
- [ProductCompany](docs/ProductCompany.md)
- [ProductCompanyDeleteExecution](docs/ProductCompanyDeleteExecution.md)
- [ProductCompanyDeleteInput](docs/ProductCompanyDeleteInput.md)
- [ProductCompanyDeleteOutput](docs/ProductCompanyDeleteOutput.md)
- [ProductCompanyEnrichExecution](docs/ProductCompanyEnrichExecution.md)
- [ProductCompanyEnrichInput](docs/ProductCompanyEnrichInput.md)
- [ProductCompanyList](docs/ProductCompanyList.md)
- [ProductCompanyListAddExecution](docs/ProductCompanyListAddExecution.md)
- [ProductCompanyListAddInput](docs/ProductCompanyListAddInput.md)
- [ProductCompanyListAddOutput](docs/ProductCompanyListAddOutput.md)
- [ProductCompanyListCreateExecution](docs/ProductCompanyListCreateExecution.md)
- [ProductCompanyListCreateInput](docs/ProductCompanyListCreateInput.md)
- [ProductCompanyListRemoveExecution](docs/ProductCompanyListRemoveExecution.md)
- [ProductCompanyListRemoveInput](docs/ProductCompanyListRemoveInput.md)
- [ProductCompanyListRemoveOutput](docs/ProductCompanyListRemoveOutput.md)
- [ProductCompanyListsListExecution](docs/ProductCompanyListsListExecution.md)
- [ProductCompanyListsListOutput](docs/ProductCompanyListsListOutput.md)
- [ProductCompanySummary](docs/ProductCompanySummary.md)
- [ProductCompanyTrackExecution](docs/ProductCompanyTrackExecution.md)
- [ProductCompanyTrackInput](docs/ProductCompanyTrackInput.md)
- [ProductCompanyTrackOutput](docs/ProductCompanyTrackOutput.md)
- [ProductCompanyUpdateExecution](docs/ProductCompanyUpdateExecution.md)
- [ProductCompanyUpdateInput](docs/ProductCompanyUpdateInput.md)
- [ProductCompanyUpdateOutput](docs/ProductCompanyUpdateOutput.md)
- [ProductConnectedApp](docs/ProductConnectedApp.md)
- [ProductConnectedAppPushExecution](docs/ProductConnectedAppPushExecution.md)
- [ProductConnectedAppPushInput](docs/ProductConnectedAppPushInput.md)
- [ProductConnectedAppPushOutput](docs/ProductConnectedAppPushOutput.md)
- [ProductConnectedAppsExecution](docs/ProductConnectedAppsExecution.md)
- [ProductConnectedAppsOutput](docs/ProductConnectedAppsOutput.md)
- [ProductCustomAttribute](docs/ProductCustomAttribute.md)
- [ProductCustomAttributeCreateExecution](docs/ProductCustomAttributeCreateExecution.md)
- [ProductCustomAttributeCreateInput](docs/ProductCustomAttributeCreateInput.md)
- [ProductCustomAttributesListExecution](docs/ProductCustomAttributesListExecution.md)
- [ProductCustomAttributesListOutput](docs/ProductCustomAttributesListOutput.md)
- [ProductDatedRecipient](docs/ProductDatedRecipient.md)
- [ProductDiscoverCompaniesExecution](docs/ProductDiscoverCompaniesExecution.md)
- [ProductDiscoverCompaniesInput](docs/ProductDiscoverCompaniesInput.md)
- [ProductDiscoverCompaniesOutput](docs/ProductDiscoverCompaniesOutput.md)
- [ProductDiscoverPeopleExecution](docs/ProductDiscoverPeopleExecution.md)
- [ProductDiscoverPeopleInput](docs/ProductDiscoverPeopleInput.md)
- [ProductDiscoverPeopleOutput](docs/ProductDiscoverPeopleOutput.md)
- [ProductDomainFinderExecution](docs/ProductDomainFinderExecution.md)
- [ProductDomainFinderInput](docs/ProductDomainFinderInput.md)
- [ProductDomainFinderOutput](docs/ProductDomainFinderOutput.md)
- [ProductEmailCountExecution](docs/ProductEmailCountExecution.md)
- [ProductEmailCountInput](docs/ProductEmailCountInput.md)
- [ProductEmailCountOutput](docs/ProductEmailCountOutput.md)
- [ProductLead](docs/ProductLead.md)
- [ProductLeadBulkDeleteExecution](docs/ProductLeadBulkDeleteExecution.md)
- [ProductLeadBulkDeleteInput](docs/ProductLeadBulkDeleteInput.md)
- [ProductLeadBulkDeleteOutput](docs/ProductLeadBulkDeleteOutput.md)
- [ProductLeadCreateExecution](docs/ProductLeadCreateExecution.md)
- [ProductLeadCreateInput](docs/ProductLeadCreateInput.md)
- [ProductLeadDeleteExecution](docs/ProductLeadDeleteExecution.md)
- [ProductLeadDeleteInput](docs/ProductLeadDeleteInput.md)
- [ProductLeadDeleteOutput](docs/ProductLeadDeleteOutput.md)
- [ProductLeadEnrichExecution](docs/ProductLeadEnrichExecution.md)
- [ProductLeadEnrichInput](docs/ProductLeadEnrichInput.md)
- [ProductLeadGetExecution](docs/ProductLeadGetExecution.md)
- [ProductLeadGetInput](docs/ProductLeadGetInput.md)
- [ProductLeadList](docs/ProductLeadList.md)
- [ProductLeadListAddLeadExecution](docs/ProductLeadListAddLeadExecution.md)
- [ProductLeadListAddLeadInput](docs/ProductLeadListAddLeadInput.md)
- [ProductLeadListAddLeadOutput](docs/ProductLeadListAddLeadOutput.md)
- [ProductLeadListCreateExecution](docs/ProductLeadListCreateExecution.md)
- [ProductLeadListCreateInput](docs/ProductLeadListCreateInput.md)
- [ProductLeadListDeleteExecution](docs/ProductLeadListDeleteExecution.md)
- [ProductLeadListDeleteInput](docs/ProductLeadListDeleteInput.md)
- [ProductLeadListDeleteOutput](docs/ProductLeadListDeleteOutput.md)
- [ProductLeadListRemoveLeadExecution](docs/ProductLeadListRemoveLeadExecution.md)
- [ProductLeadListRemoveLeadInput](docs/ProductLeadListRemoveLeadInput.md)
- [ProductLeadListRemoveLeadOutput](docs/ProductLeadListRemoveLeadOutput.md)
- [ProductLeadListUpdateExecution](docs/ProductLeadListUpdateExecution.md)
- [ProductLeadListUpdateInput](docs/ProductLeadListUpdateInput.md)
- [ProductLeadListsListExecution](docs/ProductLeadListsListExecution.md)
- [ProductLeadListsListOutput](docs/ProductLeadListsListOutput.md)
- [ProductLeadTagAssignExecution](docs/ProductLeadTagAssignExecution.md)
- [ProductLeadTagAssignInput](docs/ProductLeadTagAssignInput.md)
- [ProductLeadTagAssignOutput](docs/ProductLeadTagAssignOutput.md)
- [ProductLeadTagCreateExecution](docs/ProductLeadTagCreateExecution.md)
- [ProductLeadTagCreateInput](docs/ProductLeadTagCreateInput.md)
- [ProductLeadTagRemoveExecution](docs/ProductLeadTagRemoveExecution.md)
- [ProductLeadTagRemoveInput](docs/ProductLeadTagRemoveInput.md)
- [ProductLeadTagRemoveOutput](docs/ProductLeadTagRemoveOutput.md)
- [ProductLeadTagsListExecution](docs/ProductLeadTagsListExecution.md)
- [ProductLeadTagsListOutput](docs/ProductLeadTagsListOutput.md)
- [ProductLeadUpdateExecution](docs/ProductLeadUpdateExecution.md)
- [ProductLeadUpdateInput](docs/ProductLeadUpdateInput.md)
- [ProductLeadUpsertExecution](docs/ProductLeadUpsertExecution.md)
- [ProductLeadUpsertInput](docs/ProductLeadUpsertInput.md)
- [ProductLeadWithAttributes](docs/ProductLeadWithAttributes.md)
- [ProductLeadsListExecution](docs/ProductLeadsListExecution.md)
- [ProductLeadsListInput](docs/ProductLeadsListInput.md)
- [ProductLeadsListOutput](docs/ProductLeadsListOutput.md)
- [ProductNamedResource](docs/ProductNamedResource.md)
- [ProductPerson](docs/ProductPerson.md)
- [ProductPersonEnrichExecution](docs/ProductPersonEnrichExecution.md)
- [ProductPersonEnrichInput](docs/ProductPersonEnrichInput.md)
- [ProductPersonSummary](docs/ProductPersonSummary.md)
- [ProductRecipient](docs/ProductRecipient.md)
- [ProductSavedSearchesListExecution](docs/ProductSavedSearchesListExecution.md)
- [ProductSavedSearchesListOutput](docs/ProductSavedSearchesListOutput.md)
- [ProductSequence](docs/ProductSequence.md)
- [ProductSequenceRecipientAddExecution](docs/ProductSequenceRecipientAddExecution.md)
- [ProductSequenceRecipientAddInput](docs/ProductSequenceRecipientAddInput.md)
- [ProductSequenceRecipientAddOutput](docs/ProductSequenceRecipientAddOutput.md)
- [ProductSequenceRecipientCancelExecution](docs/ProductSequenceRecipientCancelExecution.md)
- [ProductSequenceRecipientCancelInput](docs/ProductSequenceRecipientCancelInput.md)
- [ProductSequenceRecipientsAddExecution](docs/ProductSequenceRecipientsAddExecution.md)
- [ProductSequenceRecipientsAddInput](docs/ProductSequenceRecipientsAddInput.md)
- [ProductSequenceRecipientsAddInputRecipientsInner](docs/ProductSequenceRecipientsAddInputRecipientsInner.md)
- [ProductSequenceRecipientsAddOutput](docs/ProductSequenceRecipientsAddOutput.md)
- [ProductSequenceRecipientsListExecution](docs/ProductSequenceRecipientsListExecution.md)
- [ProductSequenceRecipientsListInput](docs/ProductSequenceRecipientsListInput.md)
- [ProductSequenceRecipientsListOutput](docs/ProductSequenceRecipientsListOutput.md)
- [ProductSequenceStartExecution](docs/ProductSequenceStartExecution.md)
- [ProductSequenceStartInput](docs/ProductSequenceStartInput.md)
- [ProductSequenceStartOutput](docs/ProductSequenceStartOutput.md)
- [ProductSequencesListExecution](docs/ProductSequencesListExecution.md)
- [ProductSequencesListOutput](docs/ProductSequencesListOutput.md)
- [ProductTeamMember](docs/ProductTeamMember.md)
- [ProductTeamMembersExecution](docs/ProductTeamMembersExecution.md)
- [ProductTeamMembersOutput](docs/ProductTeamMembersOutput.md)
- [ProductToolExecution](docs/ProductToolExecution.md)
- [ProductToolRequest](docs/ProductToolRequest.md)
- [ProductToolRequestInput](docs/ProductToolRequestInput.md)
- [ProductTrackedCompany](docs/ProductTrackedCompany.md)
- [ProductUsageExecution](docs/ProductUsageExecution.md)
- [ProductUsageHistoryExecution](docs/ProductUsageHistoryExecution.md)
- [ProductUsageHistoryInput](docs/ProductUsageHistoryInput.md)
- [ProductUsageHistoryOutput](docs/ProductUsageHistoryOutput.md)
- [ProductUsageOutput](docs/ProductUsageOutput.md)
- [ProductUsageTransaction](docs/ProductUsageTransaction.md)
- [PublicStats](docs/PublicStats.md)
- [QueueIntegrationLeadExportRequest](docs/QueueIntegrationLeadExportRequest.md)
- [QueueIntegrationLeadExportRequestSelectionScopesInner](docs/QueueIntegrationLeadExportRequestSelectionScopesInner.md)
- [QueueNotificationTestRequest](docs/QueueNotificationTestRequest.md)
- [QueuedIntegrationJob](docs/QueuedIntegrationJob.md)
- [QueuedIntegrationJobResponse](docs/QueuedIntegrationJobResponse.md)
- [QueuedIntegrationJobStreamPosition](docs/QueuedIntegrationJobStreamPosition.md)
- [RotateCodaCredentialRequest](docs/RotateCodaCredentialRequest.md)
- [RotateFreshsalesCredentialRequest](docs/RotateFreshsalesCredentialRequest.md)
- [RunSheetWorkflowRequest](docs/RunSheetWorkflowRequest.md)
- [SaveSheetWorkflowRequest](docs/SaveSheetWorkflowRequest.md)
- [SegmentInstallationCreated](docs/SegmentInstallationCreated.md)
- [SheetWorkflow](docs/SheetWorkflow.md)
- [SheetWorkflowDeleted](docs/SheetWorkflowDeleted.md)
- [SheetWorkflowList](docs/SheetWorkflowList.md)
- [SheetWorkflowPreview](docs/SheetWorkflowPreview.md)
- [SheetWorkflowPreviewRowsInner](docs/SheetWorkflowPreviewRowsInner.md)
- [SheetWorkflowResponse](docs/SheetWorkflowResponse.md)
- [SheetWorkflowStateResponse](docs/SheetWorkflowStateResponse.md)
- [SheetWorkflowValidation](docs/SheetWorkflowValidation.md)
- [StartAttioOAuthRequest](docs/StartAttioOAuthRequest.md)
- [StartGoogleSheetsOAuthRequest](docs/StartGoogleSheetsOAuthRequest.md)
- [StartIntegrationOAuthRequest](docs/StartIntegrationOAuthRequest.md)
- [UpdateIntegrationConnectionStateRequest](docs/UpdateIntegrationConnectionStateRequest.md)
- [UpdateLeadRequest](docs/UpdateLeadRequest.md)
- [UpdateLeadRequestCompany](docs/UpdateLeadRequestCompany.md)
- [UpdateLeadRequestPerson](docs/UpdateLeadRequestPerson.md)
- [UpdateLeadResponse](docs/UpdateLeadResponse.md)
- [UpdateLeadResponseLead](docs/UpdateLeadResponseLead.md)
- [UpdateSheetWorkflowStateRequest](docs/UpdateSheetWorkflowStateRequest.md)
- [VerificationFinal](docs/VerificationFinal.md)
- [VerificationProgress](docs/VerificationProgress.md)
- [VerificationResponse](docs/VerificationResponse.md)
- [VerificationResult](docs/VerificationResult.md)
- [VerificationStage](docs/VerificationStage.md)
- [VerificationStreamError](docs/VerificationStreamError.md)

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
- Package version: `0.4.0-beta.1`
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
