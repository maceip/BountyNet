/** Dev defaults to localhost; production builds default to the public gateway unless overridden. */
export const DEFAULT_GATEWAY =
  import.meta.env.VITE_GATEWAY_URL?.trim() ||
  (import.meta.env.DEV ? "http://127.0.0.1:8090" : "https://gateway.stare.network");

export function loadGatewayBase(): string {
  try {
    return localStorage.getItem("bountynet.gateway") ?? DEFAULT_GATEWAY;
  } catch {
    return DEFAULT_GATEWAY;
  }
}

export function persistGatewayBase(next: string): void {
  try {
    localStorage.setItem("bountynet.gateway", next);
  } catch {
    /* ignore */
  }
}

export function gatewayFetchPath(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
