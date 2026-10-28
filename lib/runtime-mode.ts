/** Send Instagram replies inside the web app instead of a separate worker. */
export function isInlineProcessing(): boolean {
  return process.env.DM_PROCESS_MODE === "inline" || !process.env.REDIS_URL;
}
