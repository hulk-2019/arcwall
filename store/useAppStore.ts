import { create } from 'zustand';
import { User } from "@/types/user";
import { toast } from "sonner";
import { fetcher } from "@/services/api";

interface AppState {
  user: User | null | undefined;
  setUser: (user: User | null | undefined) => void;
  fetchUserInfo: (isSignedIn: boolean | undefined, isLoaded: boolean) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  user: undefined,
  setUser: (user) => set({ user }),
  fetchUserInfo: async (isSignedIn, isLoaded) => {
    // 如果 Clerk 状态还在加载中，不执行任何操作
    if (!isLoaded) {
      return;
    }

    // 如果用户未登录，直接设置为 null，不调用 API
    if (!isSignedIn) {
      set({ user: null });
      return;
    }

    // 用户已登录，调用 API 获取用户信息
    try {
      const res = await fetcher("/api/get-user-info", { method: "POST", body: "{}" });

      if (res.code === 0 && res.data) {
        set({ user: res.data });
      } else {
        set({ user: null });
      }
    } catch (e) {
      set({ user: null });

      console.log("get user info failed: ", e);
      // 使用默认英文错误信息
      toast.error("Get user info failed");
    }
  },
}));
