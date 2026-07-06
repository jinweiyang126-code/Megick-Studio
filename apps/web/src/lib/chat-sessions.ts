import { apiGet } from "@/lib/api-client";
import type { ChatSession, PaginatedResult } from "@/routes/-dashboard-types";

export const CHAT_LIST_DEFAULT_PAGE_SIZE = 30;
export const CHAT_LIST_MAX_PAGE_SIZE = 100;

export async function fetchChatSessions(options?: {
  page?: number;
  pageSize?: number;
}) {
  return apiGet<PaginatedResult<ChatSession>>("/api/chats", {
    query: {
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? CHAT_LIST_DEFAULT_PAGE_SIZE,
    },
  });
}

export async function fetchAllChatSessions(options?: {
  pageSize?: number;
  maxPages?: number;
}) {
  const pageSize = Math.min(
    options?.pageSize ?? CHAT_LIST_MAX_PAGE_SIZE,
    CHAT_LIST_MAX_PAGE_SIZE,
  );
  const maxPages = options?.maxPages ?? 10;
  const items: ChatSession[] = [];
  let page = 1;
  let total = 0;

  while (page <= maxPages) {
    const result = await fetchChatSessions({ page, pageSize });
    items.push(...result.items);
    total = result.total;
    if (!result.hasNextPage) break;
    page += 1;
  }

  return { items, total };
}
