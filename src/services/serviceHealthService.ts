export type ProviderMode = "live" | "sandbox" | "fallback";

export type ServiceHealth = {
  reachable: boolean;
  providers?: Partial<Record<"map" | "ai" | "payment" | "ticket", ProviderMode>>;
};

export const LOCAL_FALLBACK_EVENT = "ly:local-fallback";

const fallbackScopes = new Set<string>();

/**
 * Called by api clients whenever a request fails and local demo data stands
 * in. In live mode the shell turns these into a visible warning banner.
 */
export function reportLocalFallback(scope: string) {
  if (fallbackScopes.has(scope)) return;
  fallbackScopes.add(scope);
  window.dispatchEvent(new CustomEvent(LOCAL_FALLBACK_EVENT, { detail: { scopes: [...fallbackScopes] } }));
}

export function getLocalFallbackScopes(): string[] {
  return [...fallbackScopes];
}

export async function fetchServiceHealth(healthUrl: string): Promise<ServiceHealth> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(healthUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`health ${response.status}`);
      const payload = await response.json() as { providers?: ServiceHealth["providers"] };
      return { reachable: true, providers: payload.providers };
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    return { reachable: false };
  }
}
