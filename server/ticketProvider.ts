import type { TicketLock, TicketProduct, TicketSlot, TicketVoucher } from "../src/types";
import { getConfiguredTicketProvider, validateTicketProviderConfig, type RuntimeEnv } from "./runtimeConfig";
import type { AuthUser } from "./repositories";

export type TicketOptions = {
  products: TicketProduct[];
  slots: TicketSlot[];
};

export type TicketLockInput = {
  productId: string;
  slotId: string;
  visitDate: string;
  quantity: number;
};

export type TicketConfirmInput = {
  lockId: string;
  orderId: string;
};

export type TicketVerifyInput = {
  voucherCode: string;
  visitDate?: string;
  slotId?: string;
};

export type TicketProvider = {
  name: string;
  getOptions(poiId: string, visitDate?: string): TicketOptions;
  lock(input: TicketLockInput, actor: AuthUser): TicketLock;
  release(lockId: string, actor?: AuthUser): TicketLock;
  confirm(input: TicketConfirmInput, actor: AuthUser): TicketLock;
  verify(input: TicketVerifyInput, actor: AuthUser): TicketVoucher;
};

export function createTicketProvider(
  sandboxProvider: TicketProvider,
  env: RuntimeEnv = process.env,
  failClosed: (message: string, code?: string) => never
): TicketProvider {
  const provider = getConfiguredTicketProvider(env);
  if (provider === "sandbox") return sandboxProvider;

  const failures = validateTicketProviderConfig(env, false).filter((issue) => issue.severity === "fail");
  if (failures.length) {
    return createFailClosedTicketProvider(provider, () => failClosed(failures.map((issue) => issue.message).join(" "), "ticket_provider_misconfigured"));
  }

  return createFailClosedTicketProvider(provider, () => failClosed(
    `TICKET_PROVIDER=${provider} is configured, but no real ticket adapter has been implemented for this provider.`,
    "ticket_provider_not_implemented"
  ));
}

function createFailClosedTicketProvider(name: string, fail: () => never): TicketProvider {
  return {
    name,
    getOptions: fail,
    lock: fail,
    release: fail,
    confirm: fail,
    verify: fail
  };
}
