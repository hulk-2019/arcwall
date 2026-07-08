import Cookies from "js-cookie";

const ARCWALL_SERVICE_URL =
  process.env.NEXT_PUBLIC_ARCWALL_SERVICE_URL || "http://localhost:3001";

function toServiceUrl(url: string): string {
  if (/^https?:\/\//.test(url)) {
    return url;
  }

  const servicePath = url.startsWith("/api/")
    ? url.replace(/^\/api/, "")
    : url;

  return `${ARCWALL_SERVICE_URL}${servicePath}`;
}

function getAuthToken(): string | undefined {
  return Cookies.get("arcwall-access-token") || Cookies.get("arcwall-token");
}

export function setAuthToken(token: string) {
  Cookies.set("arcwall-access-token", token, { expires: 7, sameSite: "lax" });
}

export function clearAuthToken() {
  Cookies.remove("arcwall-access-token");
  Cookies.remove("arcwall-token");
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

export async function fetcher<T = any>(url: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const token = getAuthToken();
  const headers: HeadersInit = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    "Arcwall-Language": Cookies.get("arcwall-language") ?? "zh",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options?.headers,
  };

  const response = await fetch(toServiceUrl(url), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.message) errorMessage = parsed.message;
    } catch {}
    throw new Error(errorMessage);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// Auth
export const login = (data: { email: string; password: string }) =>
  fetcher("/auth/login", { method: "POST", body: JSON.stringify(data) });
export const register = (data: { email: string; password: string; nickname?: string }) =>
  fetcher("/auth/register", { method: "POST", body: JSON.stringify(data) });
export const forgotPassword = (data: { email: string }) =>
  fetcher("/auth/forgot-password", { method: "POST", body: JSON.stringify(data) });
export const resetPassword = (data: { token: string; password: string }) =>
  fetcher("/auth/reset-password", { method: "POST", body: JSON.stringify(data) });

// User & Redeem Codes
export const generateRedeemCode = () => fetcher("/api/protected/redeem-code/generate", { method: "POST" });
export const useRedeemCode = (code: string) => fetcher("/api/protected/redeem-code/use", { method: "POST", body: JSON.stringify({ code }) });
export const getCredits = () => fetcher("/api/get-user-credits", { method: "POST", body: "{}" });

// Wallpapers & Favorites
export const toggleFavorite = (data: { wallpaperId: number }) => fetcher("/api/protected/favorite", { method: "POST", body: JSON.stringify(data) });
export const batchUnfavorite = (data: { wallpaperIds: number[] }) => fetcher("/api/protected/favorite/batch-unfavorite", { method: "POST", body: JSON.stringify(data) });
export const getMyWorks = (params: any) => {
  return fetcher("/api/protected/my-works", { method: "POST", body: JSON.stringify(params) });
};
export const genWallpaper = (data: any) => fetcher("/api/protected/gen-wallpaper", { method: "POST", body: JSON.stringify(data) });
export const deleteMyWork = (id: number) => fetcher("/api/protected/my-works/delete", { method: "POST", body: JSON.stringify({ id }) });
export const batchDeleteMyWorks = (ids: number[]) => fetcher("/api/protected/my-works/batch-delete", { method: "POST", body: JSON.stringify({ ids }) });
export const publishWallpaper = (data: { wallpaperId?: number, wallpaperIds?: number[] }) => fetcher("/api/protected/publish-wallpaper", { method: "POST", body: JSON.stringify(data) });
export const unpublishWallpaper = (params: { wallpaperId?: number, systemWallpaperId?: number, wallpaperIds?: number[], systemWallpaperIds?: number[] }) => fetcher("/api/protected/unpublish-wallpaper", { method: "POST", body: JSON.stringify(params) });
export const getWallpaperUrls = (data: { wallpaperId?: number, systemWallpaperId?: number, type: string }) => fetcher("/api/protected/wallpaper-urls", { method: "POST", body: JSON.stringify(data) });

// Generation status SSE
export interface GenStatusCallbacks {
  onUpdate: (wallpapers: any[]) => void;
  onDone: () => void;
  onError?: (err: Error) => void;
}

export function subscribeGenStatus(callbacks: GenStatusCallbacks): () => void {
  const { onUpdate, onDone, onError } = callbacks;
  const token = getAuthToken();
  const streamUrl = new URL(
    toServiceUrl("/api/protected/generating-tasks/stream"),
  );
  if (token) {
    streamUrl.searchParams.set("token", token);
  }
  const es = new EventSource(streamUrl.toString());

  es.addEventListener("status_update", (e) => {
    try {
      const data = JSON.parse(e.data);
      onUpdate(data.wallpapers ?? []);
    } catch {}
  });

  es.addEventListener("done", () => {
    es.close();
    onDone();
  });

  es.addEventListener("error", (e: any) => {
    es.close();
    onError?.(new Error(e.data ?? "SSE connection error"));
  });

  es.onerror = () => {
    es.close();
    onError?.(new Error("SSE connection lost"));
  };

  return () => es.close();
}

// Trash
export const getTrash = (params: any) => {
  return fetcher("/api/protected/trash", { method: "POST", body: JSON.stringify(params) });
};
export const restoreTrash = (id: number) => fetcher("/api/protected/trash/restore", { method: "POST", body: JSON.stringify({ id }) });
export const deleteTrash = (id: number) => fetcher("/api/protected/trash/delete", { method: "POST", body: JSON.stringify({ id }) });
export const clearTrash = () => fetcher("/api/protected/trash/clear", { method: "POST" });

// Public Wallpapers
export const getWallpapers = (params: any) => {
  return fetcher("/api/get-wallpapers", { method: "POST", body: JSON.stringify(params) });
};

// Transactions
export const getTransactions = (type: string, page: number, limit: number) => fetcher(`/api/protected/transactions?type=${type}&page=${page}&limit=${limit}`);

// Dictionaries
export const getDictionaries = (categories: string[]) => fetcher("/api/dictionaries", { method: "POST", body: JSON.stringify({ categories }) });

// Models / Generate
export const getSignedUrl = (data: any) => fetcher("/api/signed-url", { method: "POST", body: JSON.stringify(data) });
export const optimizePrompt = (data: any) => fetcher("/api/protected/optimize-prompt", { method: "POST", body: JSON.stringify(data) });
export const uploadImage = (formData: FormData) => fetcher("/api/upload", { 
  method: "POST", 
  body: formData,
});
