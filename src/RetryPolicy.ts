// Generated from the reviewed Reacon retry policy.
export const maximumMaxRetries = 3;
export const retryableStatuses: number[] = [429,502,503,504];
const routes = ["^/v1/whoami$","^/v1/domains/[^/]+/counts$","^/v1/teams/[^/]+/leads$"].map(pattern => new RegExp(pattern));
export function auditedRead(method: string, url: string): boolean {
  return method.toUpperCase() === 'GET' && routes.some(route => route.test(new URL(url).pathname));
}
