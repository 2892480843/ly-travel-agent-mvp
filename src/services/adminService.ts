export type OperationResult = {
  ok: boolean;
  message: string;
};

export function validateRequired(fields: Record<string, string>): OperationResult {
  const missing = Object.entries(fields).find(([, value]) => value.trim().length === 0);
  if (missing) return { ok: false, message: `${missing[0]}不能为空` };
  return { ok: true, message: "校验通过" };
}

export function nextPublishStatus(status: string) {
  if (status.includes("进行中")) return "已下架";
  if (status.includes("待上线") || status.includes("已下架")) return "进行中";
  return status;
}
