"use client";

import {
  AWAITING_EXTRACTION_LABEL,
  REVIEW_QUEUE_LABEL,
} from "@/src/lib/reviewStatus";

/**
 * Marks a transaction row the client has sent to their accountant.
 *
 * "Awaiting extraction" is the stronger of the two signals — it means the
 * amount on the row is a $0 placeholder because the document has not been read
 * yet — so it wins when both apply.
 */
export function ReviewStatusBadge({
  awaitingReview,
  awaitingExtraction,
  style,
}: {
  awaitingReview: boolean;
  awaitingExtraction: boolean;
  style?: React.CSSProperties;
}) {
  if (!awaitingReview && !awaitingExtraction) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "flex-start",
        marginTop: "4px",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        background: awaitingExtraction
          ? "rgba(196, 106, 76, 0.12)"
          : "rgba(122, 92, 250, 0.10)",
        color: awaitingExtraction ? "#C46A4C" : "#7A5CFA",
        ...style,
      }}
    >
      {awaitingExtraction ? AWAITING_EXTRACTION_LABEL : REVIEW_QUEUE_LABEL}
    </span>
  );
}

/** Header pill: "3 To Be Reviewed". Renders nothing at zero. */
export function ReviewQueueCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      style={{
        marginLeft: "8px",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        background: "rgba(122, 92, 250, 0.10)",
        color: "#7A5CFA",
      }}
    >
      {count} {REVIEW_QUEUE_LABEL}
    </span>
  );
}
