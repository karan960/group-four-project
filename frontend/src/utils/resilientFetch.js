import axios from 'axios';
import { buildCacheKey, getCacheEntry, isFresh, setCacheEntry } from './smartCache';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryingRequest = async (requestConfig, retries = 2) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await axios(requestConfig);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep((attempt + 1) * 250);
      }
    }
  }
  throw lastError;
};

export const fetchWithCacheSWR = async ({
  url,
  method = 'get',
  params,
  headers,
  ttlMs = 30000,
  retries = 2,
  backgroundRefresh = true,
  onFreshData
}) => {
  const cacheKey = buildCacheKey(method, url, params);
  const cached = await getCacheEntry(cacheKey);

  if (cached && isFresh(cached)) {
    if (backgroundRefresh) {
      retryingRequest({ url, method, params, headers }, retries)
        .then(async (response) => {
          await setCacheEntry(cacheKey, response.data, ttlMs);
          if (typeof onFreshData === 'function') {
            onFreshData(response.data, { fromCache: false });
          }
        })
        .catch(() => {
          // Keep showing fresh-enough cache on background failure.
        });
    }

    return {
      data: cached.value,
      meta: { fromCache: true, stale: false }
    };
  }

  try {
    const response = await retryingRequest({ url, method, params, headers }, retries);
    await setCacheEntry(cacheKey, response.data, ttlMs);
    return {
      data: response.data,
      meta: { fromCache: false, stale: false }
    };
  } catch (error) {
    if (cached?.value) {
      return {
        data: cached.value,
        meta: { fromCache: true, stale: true, fallback: true },
        error
      };
    }

    throw error;
  }
};

export const prefetchWithCache = async ({
  url,
  method = 'get',
  params,
  headers,
  ttlMs = 30000,
  retries = 1
}) => {
  try {
    const response = await retryingRequest({ url, method, params, headers }, retries);
    const cacheKey = buildCacheKey(method, url, params);
    await setCacheEntry(cacheKey, response.data, ttlMs);
    return true;
  } catch {
    return false;
  }
};
