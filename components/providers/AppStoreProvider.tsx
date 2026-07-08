"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { hasAuthToken } from "@/services/api";

export const AppStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const { fetchUserInfo } = useAppStore();

  useEffect(() => {
    fetchUserInfo(hasAuthToken(), true);
  }, [fetchUserInfo]);

  return <>{children}</>;
};
