import type { OperationResult, OperationScope } from "../types";
import { apiUrl, recordOperation } from "./apiClient";

export type OperationEventDetail = {
  message: string;
  status: "pending" | "completed" | "queued" | "failed";
  result?: OperationResult;
};

type OperationInput = {
  scope?: OperationScope;
  type?: string;
  label: string;
  metadata?: unknown;
  openDownload?: boolean;
};

export function triggerOperation(input: OperationInput) {
  dispatchOperation({
    message: `${input.label}处理中...`,
    status: "pending"
  });

  void recordOperation(input)
    .then((result) => {
      dispatchOperation({
        message: result.message,
        status: result.status,
        result
      });
      if (input.openDownload && result.downloadUrl) {
        window.open(apiUrl(result.downloadUrl), "_blank", "noopener,noreferrer");
      }
    })
    .catch((error) => {
      dispatchOperation({
        message: error instanceof Error ? error.message : `${input.label}处理失败`,
        status: "failed"
      });
    });
}

export function dispatchOperation(detail: OperationEventDetail) {
  window.dispatchEvent(new CustomEvent<OperationEventDetail>("ly:operation-result", { detail }));
}
