"use client";

import { useRef } from "react";
import { DesignStoreContext, createDesignStore, DesignStore } from "@/store/useDesignStore";

export const DesignStoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const storeRef = useRef<DesignStore>();

  if (!storeRef.current) {
    storeRef.current = createDesignStore();
  }

  return (
    <DesignStoreContext.Provider value={storeRef.current}>
      {children}
    </DesignStoreContext.Provider>
  );
};
