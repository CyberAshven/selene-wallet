import { describe, it, expect } from "vitest";
import { clsx } from "./clsx";

describe("clsx.js", () => {
  it("handles single string", () => {
    expect(clsx("foo")).toBe("foo");
  });

  it("joins multiple strings", () => {
    expect(clsx("foo", "bar")).toBe("foo bar");
  });

  it("filters falsy values", () => {
    expect(clsx("foo", false, null, undefined, 0, "", "bar")).toBe("foo bar");
  });

  it("handles object with truthy values", () => {
    expect(clsx({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("handles arrays", () => {
    expect(clsx(["foo", "bar"])).toBe("foo bar");
  });

  it("handles nested arrays", () => {
    expect(clsx(["foo", ["bar", "baz"]])).toBe("foo bar baz");
  });

  it("handles mixed types", () => {
    expect(clsx("foo", { bar: true }, ["baz"])).toBe("foo bar baz");
  });

  it("returns empty string for no arguments", () => {
    expect(clsx()).toBe("");
  });

  it("returns empty string for all falsy", () => {
    expect(clsx(false, null, undefined)).toBe("");
  });

  it("handles numbers", () => {
    expect(clsx(1, 2)).toBe("1 2");
  });
});
