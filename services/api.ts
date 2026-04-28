export async function fetcher<T = any>(url: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...options?.headers,
  };

  const response = await fetch(url, {
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

// User & Redeem Codes
export const generateRedeemCode = () => fetcher("/api/protected/redeem-code/generate", { method: "POST" });
export const useRedeemCode = (code: string) => fetcher("/api/protected/redeem-code/use", { method: "POST", body: JSON.stringify({ code }) });

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