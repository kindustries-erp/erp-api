/**
 * Sleep helper — reusable across portal/import flows to prevent rate-limiting.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
