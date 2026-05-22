/**
 * src/hooks/useApi.js
 *
 * WHY A CUSTOM HOOK?
 * ------------------
 * Every page does:
 *   const [data, setData] = useState(null)
 *   const [loading, setLoading] = useState(true)
 *   const [error, setError] = useState("")
 *   useEffect(() => { api.get(...).then(...).catch(...) }, [])
 *
 * That's 15 lines of boilerplate per page. This hook reduces it to 1 line:
 *   const { data, loading, error, refetch } = useApi("/users")
 *
 * LESSON: When you see the same pattern 3+ times, extract it.
 * This is called the "Don't Repeat Yourself" (DRY) principle.
 */

import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";

export function useApi(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, options);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}