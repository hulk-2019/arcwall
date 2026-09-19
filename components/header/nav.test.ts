import { describe, expect, it } from "vitest";
import { isHeaderNavActive, resolveHeaderNavHref, type HeaderNavItem } from "./nav";

const home: HeaderNavItem = { key: "home", title: "首页", url: "/" };
const canvas: HeaderNavItem = {
  key: "canvas",
  title: "AI画布",
  url: "/canvas",
  auth: true,
};
const workbench: HeaderNavItem = {
  key: "workbench",
  title: "工作台",
  url: "/my-works",
  auth: true,
};
const pricing: HeaderNavItem = { key: "pricing", title: "套餐", url: "/pricing" };

describe("isHeaderNavActive", () => {
  it("marks home active only on the homepage", () => {
    expect(isHeaderNavActive("/", home)).toBe(true);
    expect(isHeaderNavActive("/canvas", home)).toBe(false);
    expect(isHeaderNavActive("/my-works", home)).toBe(false);
  });

  it("marks canvas active on the list and project routes", () => {
    expect(isHeaderNavActive("/canvas", canvas)).toBe(true);
    expect(isHeaderNavActive("/canvas/12", canvas)).toBe(true);
    expect(isHeaderNavActive("/my-works", canvas)).toBe(false);
  });

  it("marks workbench active across workbench pages", () => {
    expect(isHeaderNavActive("/my-works", workbench)).toBe(true);
    expect(isHeaderNavActive("/published", workbench)).toBe(true);
    expect(isHeaderNavActive("/favorites", workbench)).toBe(true);
    expect(isHeaderNavActive("/trash", workbench)).toBe(true);
    expect(isHeaderNavActive("/billing", workbench)).toBe(false);
    expect(isHeaderNavActive("/pricing", workbench)).toBe(false);
  });

  it("marks pricing active on the plans page", () => {
    expect(isHeaderNavActive("/pricing", pricing)).toBe(true);
    expect(isHeaderNavActive("/billing", pricing)).toBe(false);
  });
});

describe("resolveHeaderNavHref", () => {
  it("sends signed-out users to sign-in for auth-required items", () => {
    expect(resolveHeaderNavHref(canvas, null)).toBe(
      "/sign-in?redirect_url=%2Fcanvas",
    );
    expect(resolveHeaderNavHref(workbench, null)).toBe(
      "/sign-in?redirect_url=%2Fmy-works",
    );
  });

  it("keeps public and signed-in destinations unchanged", () => {
    expect(resolveHeaderNavHref(home, null)).toBe("/");
    expect(resolveHeaderNavHref(pricing, null)).toBe("/pricing");
    expect(resolveHeaderNavHref(canvas, { id: 1 })).toBe("/canvas");
    expect(resolveHeaderNavHref(canvas, undefined)).toBe("/canvas");
  });
});
