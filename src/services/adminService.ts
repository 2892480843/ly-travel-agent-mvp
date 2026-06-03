export type OperationResult = {
  ok: boolean;
  message: string;
};

export type AdminFilterState = {
  keyword: string;
  scenic: string;
  status: string;
  date?: string;
};

const ALL_SCENIC = "全部景区";
const ALL_STATUS = "全部状态";
const ALL_KEYWORDS = "全部关键词";

type FilterScopeOptions = {
  includeDate?: boolean;
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

export function filterReviewRows(rows: string[][], filters: AdminFilterState) {
  const keyword = filters.keyword.trim().toLowerCase();
  const scenicKeyword = normalizeScenicFilter(filters.scenic);
  const status = filters.status === ALL_STATUS ? "" : filters.status;

  return rows.filter((row) => {
    const keywordMatched = !keyword || row.some((cell) => cell.toLowerCase().includes(keyword));
    const scenicMatched = !scenicKeyword || row.slice(0, 4).some((cell) => cell.includes(scenicKeyword));
    const statusMatched = !status || row[4] === status;
    return keywordMatched && scenicMatched && statusMatched;
  });
}

export function filterAdminRows(rows: string[][], filters: AdminFilterState) {
  const keyword = filters.keyword.trim().toLowerCase();
  const scenicKeyword = normalizeScenicFilter(filters.scenic);
  const status = filters.status === ALL_STATUS ? "" : filters.status;

  return rows.filter((row) => {
    const keywordMatched = !keyword || row.some((cell) => cell.toLowerCase().includes(keyword));
    const scenicMatched = !scenicKeyword || row.some((cell) => cell.includes(scenicKeyword));
    const statusMatched = !status || row.some((cell) => cell === status || cell.includes(status));
    return keywordMatched && scenicMatched && statusMatched;
  });
}

export function describeAdminFilterScope(filters: AdminFilterState, options: FilterScopeOptions = {}) {
  const parts = getAdminFilterParts(filters, options);
  return parts.join(" / ");
}

export function hasActiveAdminFilters(filters: AdminFilterState, options: FilterScopeOptions = {}) {
  return getAdminFilterParts(filters, options).some((part) => ![ALL_KEYWORDS, ALL_SCENIC, ALL_STATUS].includes(part));
}

function normalizeScenicFilter(scenic: string) {
  if (!scenic || scenic === ALL_SCENIC) return "";
  return scenic.replace(/(省)?博物馆$/, "");
}

function getAdminFilterParts(filters: AdminFilterState, options: FilterScopeOptions) {
  const keyword = filters.keyword.trim();
  const parts = [keyword ? `关键词「${keyword}」` : ALL_KEYWORDS, filters.scenic || ALL_SCENIC, filters.status || ALL_STATUS];
  if (options.includeDate && filters.date) parts.push(filters.date);
  return parts;
}
