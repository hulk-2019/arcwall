import { createStore, useStore } from 'zustand';
import { createContext, useContext } from 'react';

export interface DesignState {
  prompt: string;
  model: string;
  aspectRatio: string;
  imgUrl: string | null;
  imgPath: string[] | null;
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setAspectRatio: (ratio: string) => void;
  setImgUrl: (url: string | null) => void;
  setImgPath: (path: string[] | null) => void;
}

export type DesignStore = ReturnType<typeof createDesignStore>;

export const createDesignStore = (initProps?: Partial<DesignState>) => {
  return createStore<DesignState>()((set) => ({
    prompt: "",
    model: "",
    aspectRatio: "",
    imgUrl: null,
    imgPath: null,
    ...initProps,
    setPrompt: (prompt) => set({ prompt }),
    setModel: (model) => set({ model }),
    setAspectRatio: (aspectRatio) => set({ aspectRatio }),
    setImgUrl: (imgUrl) => set({ imgUrl }),
    setImgPath: (imgPath) => set({ imgPath }),
  }));
};

export const DesignStoreContext = createContext<DesignStore | null>(null);

export function useDesignStore<T>(selector: (state: DesignState) => T): T;
export function useDesignStore(): DesignState;
export function useDesignStore<T>(selector?: (state: DesignState) => T) {
  const store = useContext(DesignStoreContext);
  if (!store) {
    throw new Error('Missing DesignStoreProvider in the component tree');
  }
  return useStore(store, selector || ((state) => state as unknown as T));
}
