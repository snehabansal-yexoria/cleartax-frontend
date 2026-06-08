import { NextResponse } from "next/server";
import {
  createCoreProperty,
  getCoreEntity,
  listCoreProperties,
} from "@/src/lib/coreApi";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  if (id.startsWith("demo-")) {
    const demoProperties: Record<string, any[]> = {
      "demo-ent-1": [
        {
          id: "demo-prop-1",
          entityId: "demo-ent-1",
          name: "24 Darling Street",
          propertyType: "residential",
          locationText: "South Yarra, VIC",
          estimatedMarketValue: 1200000,
          purchaseAmount: 950000,
          purchaseDate: "2020-03-12",
          hasDepreciationSchedule: true,
          status: "rented",
          imageUrl: "/house_darling_st.png",
          loanDetails: { loanAmount: 680000 },
          reconciled: false
        },
        {
          id: "demo-prop-2",
          entityId: "demo-ent-1",
          name: "12 Church Ave",
          propertyType: "residential",
          locationText: "Mascot, NSW",
          estimatedMarketValue: 1200000,
          purchaseAmount: 880000,
          purchaseDate: "2021-06-25",
          hasDepreciationSchedule: false,
          status: "rented",
          imageUrl: "/house_church_ave.png",
          loanDetails: { loanAmount: 370000 },
          reconciled: false
        }
      ],
      "demo-entity-1": [
        {
          id: "demo-prop-1",
          entityId: "demo-entity-1",
          name: "24 Darling Street",
          propertyType: "residential",
          locationText: "South Yarra, VIC",
          estimatedMarketValue: 1200000,
          purchaseAmount: 950000,
          purchaseDate: "2020-03-12",
          hasDepreciationSchedule: true,
          status: "rented",
          imageUrl: "/house_darling_st.png",
          loanDetails: { loanAmount: 680000 },
          reconciled: false
        },
        {
          id: "demo-prop-2",
          entityId: "demo-entity-1",
          name: "12 Church Ave",
          propertyType: "residential",
          locationText: "Mascot, NSW",
          estimatedMarketValue: 1200000,
          purchaseAmount: 880000,
          purchaseDate: "2021-06-25",
          hasDepreciationSchedule: false,
          status: "rented",
          imageUrl: "/house_church_ave.png",
          loanDetails: { loanAmount: 370000 },
          reconciled: false
        }
      ],
      "demo-ent-2": [
        {
          id: "demo-prop-3",
          entityId: "demo-ent-2",
          name: "8 Harbour Road",
          propertyType: "residential",
          locationText: "Noosa Heads, QLD",
          estimatedMarketValue: 850000,
          purchaseAmount: 710000,
          purchaseDate: "2019-11-04",
          hasDepreciationSchedule: true,
          status: "available for rent",
          imageUrl: "/house_harbour_rd.png",
          loanDetails: { loanAmount: 280000 },
          reconciled: false
        }
      ],
      "demo-entity-2": [
        {
          id: "demo-prop-3",
          entityId: "demo-entity-2",
          name: "8 Harbour Road",
          propertyType: "residential",
          locationText: "Noosa Heads, QLD",
          estimatedMarketValue: 850000,
          purchaseAmount: 710000,
          purchaseDate: "2019-11-04",
          hasDepreciationSchedule: true,
          status: "available for rent",
          imageUrl: "/house_harbour_rd.png",
          loanDetails: { loanAmount: 280000 },
          reconciled: false
        }
      ],
      "demo-ent-3": []
    };
    return NextResponse.json({ items: demoProperties[id] || [] });
  }

  try {
    const items = await listCoreProperties(token, id);
    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list properties";
    console.error(`GET /api/entities/${id}/properties error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  if (id.startsWith("demo-")) {
    return NextResponse.json({
      id: "demo-new-prop",
      entityId: id,
      name: "Mocked Property",
      propertyType: "residential",
      locationText: "Mocked Location",
      estimatedMarketValue: 100000,
      purchaseAmount: 80000,
      purchaseDate: "2023-01-01",
      hasDepreciationSchedule: false,
      status: "rented",
      imageUrl: null,
      loanDetails: null,
      reconciled: false,
    }, { status: 201 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const requestBody = body as Record<string, unknown>;
    const entity = await getCoreEntity(token, id);
    if (entity.entityType !== "individual") {
      delete requestBody.owners;
    }

    const property = await createCoreProperty(
      token,
      id,
      requestBody,
    );
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create property";
    console.error(`POST /api/entities/${id}/properties error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
