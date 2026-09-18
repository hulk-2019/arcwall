export type HeaderNavItem = {
  key: string;
  title: string;
  url: string;
  auth?: boolean;
};

const WORKBENCH_PATHS = ["/my-works", "/published", "/favorites", "/trash"];

export function isHeaderNavActive(pathname: string, item: HeaderNavItem): boolean {
  if (item.url === "/") {
    return pathname === "/";
  }

  if (item.key === "workbench") {
    return WORKBENCH_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }

  return pathname === item.url || pathname.startsWith(`${item.url}/`);
}

export function resolveHeaderNavHref(
  item: HeaderNavItem,
  user: unknown | null | undefined,
): string {
  if (item.auth && user === null) {
    return `/sign-in?redirect_url=${encodeURIComponent(item.url)}`;
  }

  return item.url;
}
