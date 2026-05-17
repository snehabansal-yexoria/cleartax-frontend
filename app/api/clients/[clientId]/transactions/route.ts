import { NextResponse } from "next/server";
import {
  listCoreEntities,
  listCoreTransactionsByClientPage,
  listCoreTransactionsByEntity,
  type CoreTransactionListItem,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ clientId: string }> };

function getPagination(req: Request) {
  const params = new URL(req.url).searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(params.get("pageSize") || params.get("page_size") || 9)),
  );
  return { page, pageSize };
}

function paginateItems(
  items: CoreTransactionListItem[],
  pagination: { page: number; pageSize: number },
) {
  const sortedItems = [...items].sort((a, b) =>
    b.invoiceDate.localeCompare(a.invoiceDate),
  );
  const start = (pagination.page - 1) * pagination.pageSize;
  const end = start + pagination.pageSize;

  return {
    items: sortedItems.slice(start, end),
    total: sortedItems.length,
  };
}

async function listClientTransactionsFromEntities(
  token: string,
  clientId: string,
) {
  const entities = await listCoreEntities(token, { clientId });
  const responses = await Promise.all(
    entities.map(async (entity) => {
      try {
        return await listCoreTransactionsByEntity(token, entity.id);
      } catch (error) {
        console.error("Failed to load client entity transactions", {
          clientId,
          entityId: entity.id,
          message: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    }),
  );

  return responses.flat();
}

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;
  const pagination = getPagination(req);
  try {
    try {
      const result = await listCoreTransactionsByClientPage(
        token,
        clientId,
        pagination,
      );
      const total = result.total ?? result.items.length;
      const shouldSlice =
        result.total == null || result.items.length > pagination.pageSize;
      const items = shouldSlice
        ? result.items.slice(
            (pagination.page - 1) * pagination.pageSize,
            pagination.page * pagination.pageSize,
          )
        : result.items;

      if (total > 0 || items.length > 0) {
        return NextResponse.json({
          items,
          total,
          unfilteredTotal: total,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
      }
    } catch (error) {
      console.error("Failed to load direct client transactions", {
        clientId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const fallbackItems = await listClientTransactionsFromEntities(
      token,
      clientId,
    );
    const fallbackPage = paginateItems(fallbackItems, pagination);
    return NextResponse.json({
      items: fallbackPage.items,
      total: fallbackPage.total,
      unfilteredTotal: fallbackPage.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/clients/${clientId}/transactions`,
      error,
    );
  }
}
