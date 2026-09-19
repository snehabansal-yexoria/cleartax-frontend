/**
 * Shared vocabulary for the transaction review queue.
 *
 * "unreviewed" is the queue and nothing else: a transaction only lands there
 * when a client explicitly presses "Submit to accountant". Everything else —
 * every accountant upload, and the client's own "Review & submit" saves — is
 * born "active" and never enters review. Keeping the predicate in one place
 * stops each list re-deriving that rule slightly differently.
 */

/** True when the transaction is waiting on accountant sign-off. */
export function isAwaitingReview(reviewStatus: string | null | undefined): boolean {
  return reviewStatus === "unreviewed";
}

/**
 * True for a placeholder created by "Submit to accountant" whose document has
 * not been extracted yet — its amount and category are stand-ins until the
 * accountant opens it and the extraction runs.
 */
export function isAwaitingExtraction(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return metadata?.extraction_pending === true;
}

export const REVIEW_QUEUE_LABEL = "To Be Reviewed";
export const AWAITING_EXTRACTION_LABEL = "Awaiting extraction";
