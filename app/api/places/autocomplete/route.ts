import { NextResponse } from "next/server";
import { getRequestToken } from "@/src/lib/coreApiProxy";
import { verifyToken } from "@/src/lib/verifyToken";

// Server-side proxy for Google Places Autocomplete (New). The Google Maps
// API key never leaves the server — the browser only ever talks to this route.
// See: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
const PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";

// Only the fields we actually render, to keep the upstream response lean.
const FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
].join(",");

type PlacePrediction = {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

export async function GET(req: Request) {
  // Gate on a valid Cognito token so the proxy can't be used as an anonymous
  // (billable) relay to Google. Token comes from the Authorization header or
  // the idToken cookie, mirroring the other API routes.
  const token = getRequestToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const claims = await verifyToken(token);
  if (!claims) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error(
      "GET /api/places/autocomplete: GOOGLE_MAPS_API_KEY is not set",
    );
    return NextResponse.json(
      { error: "Location search is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  // Autocomplete only becomes useful after a few characters; short-circuit to
  // avoid burning quota on 1-2 char queries.
  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }
  const sessionToken = url.searchParams.get("session")?.trim();

  // Bias results to the product's market (Australia) by default; override via
  // GOOGLE_PLACES_REGION (comma-separated ISO 3166-1 country codes, e.g. "au,nz").
  const regionCodes = (process.env.GOOGLE_PLACES_REGION ?? "au")
    .split(",")
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);

  const requestBody: Record<string, unknown> = {
    input: query,
    ...(regionCodes.length ? { includedRegionCodes: regionCodes } : {}),
    ...(sessionToken ? { sessionToken } : {}),
  };

  try {
    const res = await fetch(PLACES_AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("GET /api/places/autocomplete upstream error", {
        status: res.status,
        detail: detail.slice(0, 500),
      });
      return NextResponse.json(
        { error: "Location search failed." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      suggestions?: Array<{ placePrediction?: PlacePrediction }>;
    };

    const suggestions = (data.suggestions ?? [])
      .map((entry) => entry.placePrediction)
      .filter(
        (prediction): prediction is PlacePrediction =>
          Boolean(prediction?.placeId && prediction?.text?.text),
      )
      .map((prediction) => ({
        placeId: prediction.placeId as string,
        description: prediction.text?.text as string,
        mainText: prediction.structuredFormat?.mainText?.text ?? "",
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("GET /api/places/autocomplete unexpected error", error);
    return NextResponse.json(
      { error: "Location search failed." },
      { status: 502 },
    );
  }
}
