// Generated typed alternatives retained by the Reacon input-union adapter.
import { ProductDiscoverCompaniesInput, ProductDiscoverCompaniesInputFromJSON, ProductDiscoverCompaniesInputToJSON } from './ProductDiscoverCompaniesInput.js';
import { ProductDiscoverPeopleInput, ProductDiscoverPeopleInputFromJSON, ProductDiscoverPeopleInputToJSON } from './ProductDiscoverPeopleInput.js';
import { ProductDomainFinderInput, ProductDomainFinderInputFromJSON, ProductDomainFinderInputToJSON } from './ProductDomainFinderInput.js';
import { ProductEmailCountInput, ProductEmailCountInputFromJSON, ProductEmailCountInputToJSON } from './ProductEmailCountInput.js';
import { ProductPersonEnrichInput, ProductPersonEnrichInputFromJSON, ProductPersonEnrichInputToJSON } from './ProductPersonEnrichInput.js';
import { ProductLeadsListInput, ProductLeadsListInputFromJSON, ProductLeadsListInputToJSON } from './ProductLeadsListInput.js';
import { ProductLeadGetInput, ProductLeadGetInputFromJSON, ProductLeadGetInputToJSON } from './ProductLeadGetInput.js';
import { ProductLeadCreateInput, ProductLeadCreateInputFromJSON, ProductLeadCreateInputToJSON } from './ProductLeadCreateInput.js';
import { ProductLeadUpdateInput, ProductLeadUpdateInputFromJSON, ProductLeadUpdateInputToJSON } from './ProductLeadUpdateInput.js';
import { ProductLeadDeleteInput, ProductLeadDeleteInputFromJSON, ProductLeadDeleteInputToJSON } from './ProductLeadDeleteInput.js';
import { ProductLeadBulkDeleteInput, ProductLeadBulkDeleteInputFromJSON, ProductLeadBulkDeleteInputToJSON } from './ProductLeadBulkDeleteInput.js';
import { ProductLeadTagCreateInput, ProductLeadTagCreateInputFromJSON, ProductLeadTagCreateInputToJSON } from './ProductLeadTagCreateInput.js';
import { ProductLeadTagAssignInput, ProductLeadTagAssignInputFromJSON, ProductLeadTagAssignInputToJSON } from './ProductLeadTagAssignInput.js';
import { ProductCustomAttributeCreateInput, ProductCustomAttributeCreateInputFromJSON, ProductCustomAttributeCreateInputToJSON } from './ProductCustomAttributeCreateInput.js';
import { ProductLeadListUpdateInput, ProductLeadListUpdateInputFromJSON, ProductLeadListUpdateInputToJSON } from './ProductLeadListUpdateInput.js';
import { ProductLeadListDeleteInput, ProductLeadListDeleteInputFromJSON, ProductLeadListDeleteInputToJSON } from './ProductLeadListDeleteInput.js';
import { ProductLeadListAddLeadInput, ProductLeadListAddLeadInputFromJSON, ProductLeadListAddLeadInputToJSON } from './ProductLeadListAddLeadInput.js';
import { ProductCompaniesListInput, ProductCompaniesListInputFromJSON, ProductCompaniesListInputToJSON } from './ProductCompaniesListInput.js';
import { ProductCompanyTrackInput, ProductCompanyTrackInputFromJSON, ProductCompanyTrackInputToJSON } from './ProductCompanyTrackInput.js';
import { ProductCompanyUpdateInput, ProductCompanyUpdateInputFromJSON, ProductCompanyUpdateInputToJSON } from './ProductCompanyUpdateInput.js';
import { ProductCompanyDeleteInput, ProductCompanyDeleteInputFromJSON, ProductCompanyDeleteInputToJSON } from './ProductCompanyDeleteInput.js';
import { ProductCompanyListAddInput, ProductCompanyListAddInputFromJSON, ProductCompanyListAddInputToJSON } from './ProductCompanyListAddInput.js';
import { ProductSequenceRecipientsListInput, ProductSequenceRecipientsListInputFromJSON, ProductSequenceRecipientsListInputToJSON } from './ProductSequenceRecipientsListInput.js';
import { ProductSequenceRecipientsAddInput, ProductSequenceRecipientsAddInputFromJSON, ProductSequenceRecipientsAddInputToJSON } from './ProductSequenceRecipientsAddInput.js';
import { ProductSequenceRecipientAddInput, ProductSequenceRecipientAddInputFromJSON, ProductSequenceRecipientAddInputToJSON } from './ProductSequenceRecipientAddInput.js';
import { ProductSequenceRecipientCancelInput, ProductSequenceRecipientCancelInputFromJSON, ProductSequenceRecipientCancelInputToJSON } from './ProductSequenceRecipientCancelInput.js';
import { ProductSequenceStartInput, ProductSequenceStartInputFromJSON, ProductSequenceStartInputToJSON } from './ProductSequenceStartInput.js';
import { ProductConnectedAppPushInput, ProductConnectedAppPushInputFromJSON, ProductConnectedAppPushInputToJSON } from './ProductConnectedAppPushInput.js';
export type ProductToolRequestInput = ProductDiscoverCompaniesInput | ProductDiscoverPeopleInput | ProductDomainFinderInput | ProductEmailCountInput | ProductPersonEnrichInput | ProductLeadsListInput | ProductLeadGetInput | ProductLeadCreateInput | ProductLeadUpdateInput | ProductLeadDeleteInput | ProductLeadBulkDeleteInput | ProductLeadTagCreateInput | ProductLeadTagAssignInput | ProductCustomAttributeCreateInput | ProductLeadListUpdateInput | ProductLeadListDeleteInput | ProductLeadListAddLeadInput | ProductCompaniesListInput | ProductCompanyTrackInput | ProductCompanyUpdateInput | ProductCompanyDeleteInput | ProductCompanyListAddInput | ProductSequenceRecipientsListInput | ProductSequenceRecipientsAddInput | ProductSequenceRecipientAddInput | ProductSequenceRecipientCancelInput | ProductSequenceStartInput | ProductConnectedAppPushInput | Record<string, never>;
const alternatives = [
  { keys: ["industry","limit","location","query"], required: [], read: ProductDiscoverCompaniesInputFromJSON, write: ProductDiscoverCompaniesInputToJSON },
  { keys: ["domain","jobTitle","limit","query"], required: [], read: ProductDiscoverPeopleInputFromJSON, write: ProductDiscoverPeopleInputToJSON },
  { keys: ["company"], required: ["company"], read: ProductDomainFinderInputFromJSON, write: ProductDomainFinderInputToJSON },
  { keys: ["domain"], required: ["domain"], read: ProductEmailCountInputFromJSON, write: ProductEmailCountInputToJSON },
  { keys: ["email"], required: ["email"], read: ProductPersonEnrichInputFromJSON, write: ProductPersonEnrichInputToJSON },
  { keys: ["limit","listId","offset"], required: [], read: ProductLeadsListInputFromJSON, write: ProductLeadsListInputToJSON },
  { keys: ["leadId"], required: ["leadId"], read: ProductLeadGetInputFromJSON, write: ProductLeadGetInputToJSON },
  { keys: ["attributes","company","email","firstName","idempotencyKey","lastName","position"], required: ["email","idempotencyKey"], read: ProductLeadCreateInputFromJSON, write: ProductLeadCreateInputToJSON },
  { keys: ["attributes","company","firstName","idempotencyKey","lastName","leadId","position"], required: ["leadId","idempotencyKey"], read: ProductLeadUpdateInputFromJSON, write: ProductLeadUpdateInputToJSON },
  { keys: ["idempotencyKey","leadId"], required: ["leadId","idempotencyKey"], read: ProductLeadDeleteInputFromJSON, write: ProductLeadDeleteInputToJSON },
  { keys: ["idempotencyKey","leadIds"], required: ["leadIds","idempotencyKey"], read: ProductLeadBulkDeleteInputFromJSON, write: ProductLeadBulkDeleteInputToJSON },
  { keys: ["idempotencyKey","name"], required: ["name","idempotencyKey"], read: ProductLeadTagCreateInputFromJSON, write: ProductLeadTagCreateInputToJSON },
  { keys: ["idempotencyKey","leadId","tagId"], required: ["leadId","tagId","idempotencyKey"], read: ProductLeadTagAssignInputFromJSON, write: ProductLeadTagAssignInputToJSON },
  { keys: ["idempotencyKey","key","name"], required: ["name","key","idempotencyKey"], read: ProductCustomAttributeCreateInputFromJSON, write: ProductCustomAttributeCreateInputToJSON },
  { keys: ["idempotencyKey","listId","name"], required: ["listId","name","idempotencyKey"], read: ProductLeadListUpdateInputFromJSON, write: ProductLeadListUpdateInputToJSON },
  { keys: ["idempotencyKey","listId"], required: ["listId","idempotencyKey"], read: ProductLeadListDeleteInputFromJSON, write: ProductLeadListDeleteInputToJSON },
  { keys: ["idempotencyKey","leadId","listId"], required: ["listId","leadId","idempotencyKey"], read: ProductLeadListAddLeadInputFromJSON, write: ProductLeadListAddLeadInputToJSON },
  { keys: ["limit","offset"], required: [], read: ProductCompaniesListInputFromJSON, write: ProductCompaniesListInputToJSON },
  { keys: ["domain","idempotencyKey","name"], required: ["domain","idempotencyKey"], read: ProductCompanyTrackInputFromJSON, write: ProductCompanyTrackInputToJSON },
  { keys: ["companyId","employeeRange","idempotencyKey","industry","name"], required: ["companyId","idempotencyKey"], read: ProductCompanyUpdateInputFromJSON, write: ProductCompanyUpdateInputToJSON },
  { keys: ["companyId","idempotencyKey"], required: ["companyId","idempotencyKey"], read: ProductCompanyDeleteInputFromJSON, write: ProductCompanyDeleteInputToJSON },
  { keys: ["companyId","idempotencyKey","listId"], required: ["listId","companyId","idempotencyKey"], read: ProductCompanyListAddInputFromJSON, write: ProductCompanyListAddInputToJSON },
  { keys: ["sequenceId"], required: ["sequenceId"], read: ProductSequenceRecipientsListInputFromJSON, write: ProductSequenceRecipientsListInputToJSON },
  { keys: ["idempotencyKey","recipients","sequenceId"], required: ["sequenceId","recipients","idempotencyKey"], read: ProductSequenceRecipientsAddInputFromJSON, write: ProductSequenceRecipientsAddInputToJSON },
  { keys: ["email","idempotencyKey","leadId","sequenceId"], required: ["sequenceId","email","idempotencyKey"], read: ProductSequenceRecipientAddInputFromJSON, write: ProductSequenceRecipientAddInputToJSON },
  { keys: ["idempotencyKey","recipientId"], required: ["recipientId","idempotencyKey"], read: ProductSequenceRecipientCancelInputFromJSON, write: ProductSequenceRecipientCancelInputToJSON },
  { keys: ["idempotencyKey","sequenceId"], required: ["sequenceId","idempotencyKey"], read: ProductSequenceStartInputFromJSON, write: ProductSequenceStartInputToJSON },
  { keys: ["connectionId","idempotencyKey","leadIds"], required: ["connectionId","leadIds","idempotencyKey"], read: ProductConnectedAppPushInputFromJSON, write: ProductConnectedAppPushInputToJSON },
];
function select(value: any) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Product tool input must be an object");
  const keys = Object.keys(value).filter(key => value[key] !== undefined);
  if (!keys.length) return null;
  const branch = alternatives.find(branch => keys.every(key => branch.keys.includes(key)) && branch.required.every(key => value[key] !== undefined));
  if (!branch) throw new TypeError("Product tool input does not match a declared object shape");
  return branch;
}
export function instanceOfProductToolRequestInput(value: object): value is ProductToolRequestInput { try { select(value); return true; } catch { return false; } }
export function ProductToolRequestInputFromJSON(json: any): ProductToolRequestInput { const branch = select(json); return branch ? branch.read(json) : {}; }
export function ProductToolRequestInputFromJSONTyped(json: any, ignoreDiscriminator: boolean): ProductToolRequestInput { return ProductToolRequestInputFromJSON(json); }
export function ProductToolRequestInputToJSON(value: any): any { if (value === undefined) return undefined; const branch = select(value); return branch ? branch.write(value) : {}; }
export function ProductToolRequestInputToJSONTyped(value?: ProductToolRequestInput | null, ignoreDiscriminator: boolean = false): any { return ProductToolRequestInputToJSON(value); }
