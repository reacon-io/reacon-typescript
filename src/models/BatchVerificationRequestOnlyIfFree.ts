// Copyright Reacon contributors. Licensed under Apache-2.0.
/** A boolean or the literal string 'true' or 'false'. Preserves the JSON scalar type. */
export type BatchVerificationRequestOnlyIfFree = boolean | 'true' | 'false';

export function instanceOfBatchVerificationRequestOnlyIfFree(value: unknown): value is BatchVerificationRequestOnlyIfFree {
    return typeof value === 'boolean' || value === 'true' || value === 'false';
}

function validate(value: unknown): BatchVerificationRequestOnlyIfFree {
    if (!instanceOfBatchVerificationRequestOnlyIfFree(value)) throw new TypeError("Expected a boolean or the string true or false");
    return value;
}

export function BatchVerificationRequestOnlyIfFreeFromJSON(json: unknown): BatchVerificationRequestOnlyIfFree {
    return validate(json);
}
export function BatchVerificationRequestOnlyIfFreeFromJSONTyped(json: unknown, _ignoreDiscriminator: boolean): BatchVerificationRequestOnlyIfFree {
    return validate(json);
}
export function BatchVerificationRequestOnlyIfFreeToJSON(value?: BatchVerificationRequestOnlyIfFree): BatchVerificationRequestOnlyIfFree | undefined {
    return value === undefined ? undefined : validate(value);
}
export function BatchVerificationRequestOnlyIfFreeToJSONTyped(value?: BatchVerificationRequestOnlyIfFree, _ignoreDiscriminator: boolean = false): BatchVerificationRequestOnlyIfFree | undefined {
    return BatchVerificationRequestOnlyIfFreeToJSON(value);
}
