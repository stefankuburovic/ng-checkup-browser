/** The key under which a tab's last report is kept for the report tab, in session storage. */
export function reportKey(tabId: number): string {
  return `report:${tabId}`;
}
