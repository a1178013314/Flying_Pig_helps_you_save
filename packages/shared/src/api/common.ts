export interface ApiResponse<T> {
  data: T;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export function normalizePageQuery(query: PageQuery = {}): Required<PageQuery> {
  const page = Math.max(DEFAULT_PAGE, Math.trunc(query.page ?? DEFAULT_PAGE));
  const pageSize = Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}
