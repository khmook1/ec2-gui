import axios, {
  isAxiosError,
  type AxiosRequestConfig,
  type Method,
} from "axios";
import type { ApiError } from "@/types/app";
import { getApiBaseUrl } from "@/lib/env";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  headers?: AxiosRequestConfig["headers"];
  signal?: AbortSignal;
}

const httpClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith("/") ? path : `/${path}`;

  try {
    const response = await httpClient.request<T>({
      baseURL: getApiBaseUrl().replace(/\/$/, ""),
      method: method.toLowerCase() as Method,
      url,
      data: body,
      headers: options.headers,
      signal: options.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const apiError: ApiError = {
        message: `API request failed: ${error.response.status} ${error.response.statusText}`,
        status: error.response.status,
      };
      throw apiError;
    }
    throw error;
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};
