"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useUser } from "@clerk/nextjs";

export const AppStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const { fetchUserInfo } = useAppStore();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    fetchUserInfo(isSignedIn, isLoaded);
  }, [fetchUserInfo, isSignedIn, isLoaded]);

  return <>{children}</>;
};
