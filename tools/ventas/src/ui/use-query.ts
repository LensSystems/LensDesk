import { useEffect, useState } from "react";
import type { z } from "zod";
import { parseQueryResult } from "../shared/query-result.ts";
import type { ReadQuery } from "./types.ts";
export function useQuery<T extends z.ZodType>(
  read: ReadQuery,
  method: string,
  params: unknown,
  schema: T,
  version = 0,
) {
  const [reload, setReload] = useState(0),
    key = JSON.stringify([params, version, reload]);
  const [state, setState] = useState<{
    key: string;
    value: z.output<T> | null;
    issue: string | null;
    loading: boolean;
  }>({ key: "", value: null, issue: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState({ key, value: null, issue: null, loading: true });
    void read(method, JSON.parse(key)[0])
      .then((raw) => {
        const result = parseQueryResult(schema, raw);
        if (!alive) return;
        setState({
          key,
          value: result.kind === "ok" ? result.value : null,
          issue: result.kind === "rejected" ? result.issue.code : null,
          loading: false,
        });
      })
      .catch((error) => {
        if (alive)
          setState({
            key,
            value: null,
            issue:
              typeof error === "object" && error && "code" in error
                ? String(error.code)
                : "E_INTERNAL",
            loading: false,
          });
      });
    return () => {
      alive = false;
    };
  }, [read, method, key, schema]);
  return {
    value: state.key === key ? state.value : null,
    issue: state.key === key ? state.issue : null,
    loading: state.key !== key || state.loading,
    retry: () => setReload((n) => n + 1),
  };
}
