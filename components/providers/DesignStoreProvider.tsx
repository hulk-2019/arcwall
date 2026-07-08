"use client";

import { useRef, useEffect } from "react";
import { DesignStoreContext, createDesignStore, DesignStore } from "@/store/useDesignStore";
import { getDictionaries } from "@/services/api";

export const DesignStoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const storeRef = useRef<DesignStore>();

  if (!storeRef.current) {
    storeRef.current = createDesignStore();
  }

  useEffect(() => {
    getDictionaries(["model", "aspect_ratio"])
      .then((json) => {
        const dictionaries: Array<{ category: string; key: string }> = json?.data ?? [];
        const models = dictionaries.filter((item) => item.category === "model");
        const aspectRatios = dictionaries.filter((item) => item.category === "aspect_ratio");

        if (models.length > 0) {
          storeRef.current?.getState().setModel(models[0].key);
        }

        if (aspectRatios.length > 0) {
          const preferred = aspectRatios.find((item) => item.key === "9:16");
          storeRef.current?.getState().setAspectRatio(preferred?.key || aspectRatios[0].key);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <DesignStoreContext.Provider value={storeRef.current}>
      {children}
    </DesignStoreContext.Provider>
  );
};
