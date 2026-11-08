import { useState } from "react";
export function useOffset(key: string) {
  const [page, setPage] = useState({ key, offset: 0 });
  return [
    page.key === key ? page.offset : 0,
    (offset: number) => setPage({ key, offset }),
  ] as const;
}
