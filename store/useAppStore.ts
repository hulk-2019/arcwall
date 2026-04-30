import { create } from 'zustand';
import { User } from "@/types/user";
import { toast } from "sonner";
import { fetcher } from "@/services/api";

interface AppState {
  user: User | null | undefined;
  setUser: (user: User | null | undefined) => void;
  fetchUserInfo: (isSignedIn: boolean | undefined, isLoaded: boolean) => Promise<void>;
  fetchUserCredits: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: undefined,
  setUser: (user) => set({ user }),
  fetchUserInfo: async (isSignedIn, isLoaded) => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      set({ user: null });
      return;
    }

    try {
      const res = await fetcher("/api/get-user-info", { method: "POST", body: "{}" });

      if (res.code === 0 && res.data) {
        set({ user: res.data });
        // credits 已从 get-user-info 中移除，单独拉取
        const creditsRes = await fetcher("/api/get-user-credits", { method: "POST", body: "{}" });
        if (creditsRes.code === 0 && creditsRes.data) {
          set((state) => ({ user: state.user ? { ...state.user, credits: creditsRes.data } : state.user }));
        }
      } else {
        set({ user: null });
      }
    } catch (e) {
      set({ user: null });

      console.log("get user info failed: ", e);
      toast.error("Get user info failed");
    }
  },
  fetchUserCredits: async () => {
    const currentUser = get().user;
    if (!currentUser) return;

    try {
      const res = await fetcher("/api/get-user-credits", { method: "POST", body: "{}" });
      if (res.code === 0 && res.data) {
        set({ user: { ...currentUser, credits: res.data } });
      }
    } catch (e) {
      console.log("get user credits failed: ", e);
    }
  },
}));
