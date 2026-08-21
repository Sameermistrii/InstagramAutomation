/**
 * Shared keys and shape for the CSV import handoff. The import page stages
 * rows in localStorage, then the campaign builder consumes them one at a time.
 */
export const IMPORT_QUEUE_KEY = "unisin-import-queue";
export const IMPORT_ACCOUNT_KEY = "unisin-import-account";

export interface ImportRow {
  name: string;
  keywords: string[];
  dmMessage: string;
  publicReply: string;
  trackedUrl: string;
  openingDmMessage: string;
  openingDmButtonLabel: string;
}
