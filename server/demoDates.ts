const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toDateInput(new Date());
}

export function addDaysISO(days: number): string {
  return toDateInput(new Date(Date.now() + days * DAY_MS));
}

export function upcomingDatesISO(count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDaysISO(index));
}
