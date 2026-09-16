import { useEffect } from "react";
import { useListSearch } from "@/providers/ListSearchProvider";

export function useListSearchStats(total: number, visible: number) {
  const { query, setStats } = useListSearch();

  useEffect(() => {
    if (!query.trim()) {
      setStats(null);
      return;
    }

    setStats({ total, visible });

    return () => {
      setStats(null);
    };
  }, [query, setStats, total, visible]);
}
