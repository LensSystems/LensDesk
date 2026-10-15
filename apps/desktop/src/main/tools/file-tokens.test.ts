import { describe, expect, it, vi } from "vitest";
import { createFileTokens } from "./file-tokens.ts";

describe("file tokens", () => {
  it("requires the granting tool and mode, logs denied access and revokes a tool", () => {
    const log = vi.fn();
    let sequence = 0;
    const tokens = createFileTokens({ log, createId: () => `token-${++sequence}` });
    const readToken = tokens.grant("tool-a", "/private/file", "read");
    expect(() => tokens.resolve("tool-b", readToken, "read", "files.readText")).toThrow(
      expect.objectContaining({ code: "E_PATH_NOT_GRANTED" }),
    );
    expect(() => tokens.resolve("tool-a", readToken, "write", "files.writeText")).toThrow(
      expect.objectContaining({ code: "E_PATH_NOT_GRANTED" }),
    );
    expect(() => tokens.resolve("tool-a", "missing", "read", "files.readBytes")).toThrow();
    expect(log).toHaveBeenCalledWith("tool-b", "files.readText");
    expect(tokens.resolve("tool-a", readToken, "read")).toBe("/private/file");
    tokens.revoke("tool-a");
    expect(() => tokens.resolve("tool-a", readToken, "read")).toThrow();
  });
});
