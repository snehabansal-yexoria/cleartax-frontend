/**
 * The `<img src>` for a property's stored image, or null when there is none.
 *
 * `property.imageUrl` holds the raw S3 key ("uploads/…jpg") once uploaded.
 * A raw key is not a URL — used as `src` it resolves relative to the page and
 * 404s — so keys go through GET /api/documents/download?key=, which reads the
 * idToken cookie (an <img> sends no Authorization header) and redirects to a
 * presigned S3 URL. Absolute and root-relative URLs pass through untouched.
 */
export function propertyImageSrc(imageUrl: string | null | undefined): string | null {
  const value = (imageUrl ?? "").trim();
  if (!value || value === "null" || value === "undefined") return null;
  if (value.startsWith("http") || value.startsWith("/") || value.startsWith("blob:") || value.startsWith("data:")) {
    return value;
  }
  return `/api/documents/download?key=${encodeURIComponent(value)}`;
}
