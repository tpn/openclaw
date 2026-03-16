import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthProfileStore } from "./auth-profiles/types.js";

const mocks = vi.hoisted(() => ({
  readCodexCliCredentialsCached: vi.fn(),
  readQwenCliCredentialsCached: vi.fn(),
  readMiniMaxCliCredentialsCached: vi.fn(),
}));

vi.mock("./cli-credentials.js", () => ({
  readCodexCliCredentialsCached: mocks.readCodexCliCredentialsCached,
  readQwenCliCredentialsCached: mocks.readQwenCliCredentialsCached,
  readMiniMaxCliCredentialsCached: mocks.readMiniMaxCliCredentialsCached,
}));

const { syncExternalCliCredentials } = await import("./auth-profiles/external-cli-sync.js");

function createStore(profiles: AuthProfileStore["profiles"] = {}): AuthProfileStore {
  return {
    version: 1,
    profiles: { ...profiles },
  };
}

describe("syncExternalCliCredentials", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("syncs Codex CLI credentials into openai-codex:default when missing", () => {
    const now = Date.now();
    mocks.readCodexCliCredentialsCached.mockReturnValueOnce({
      type: "oauth",
      provider: "openai-codex",
      access: "codex-access",
      refresh: "codex-refresh",
      expires: now + 60 * 60 * 1000,
      accountId: "acct_123",
    });
    mocks.readQwenCliCredentialsCached.mockReturnValueOnce(null);
    mocks.readMiniMaxCliCredentialsCached.mockReturnValueOnce(null);

    const store = createStore();

    expect(syncExternalCliCredentials(store)).toBe(true);
    expect(store.profiles["openai-codex:default"]).toMatchObject({
      type: "oauth",
      provider: "openai-codex",
      access: "codex-access",
      refresh: "codex-refresh",
      accountId: "acct_123",
    });
  });

  it("replaces stale openai-codex:default credentials from Codex CLI", () => {
    const now = Date.now();
    mocks.readCodexCliCredentialsCached.mockReturnValueOnce({
      type: "oauth",
      provider: "openai-codex",
      access: "fresh-access",
      refresh: "fresh-refresh",
      expires: now + 60 * 60 * 1000,
    });
    mocks.readQwenCliCredentialsCached.mockReturnValueOnce(null);
    mocks.readMiniMaxCliCredentialsCached.mockReturnValueOnce(null);

    const store = createStore({
      "openai-codex:default": {
        type: "oauth",
        provider: "openai-codex",
        access: "stale-access",
        refresh: "stale-refresh",
        expires: now - 60_000,
      },
    });

    expect(syncExternalCliCredentials(store)).toBe(true);
    expect(store.profiles["openai-codex:default"]).toMatchObject({
      access: "fresh-access",
      refresh: "fresh-refresh",
    });
  });

  it("keeps a fresh openai-codex:default profile without consulting Codex CLI", () => {
    const now = Date.now();
    const store = createStore({
      "openai-codex:default": {
        type: "oauth",
        provider: "openai-codex",
        access: "existing-access",
        refresh: "existing-refresh",
        expires: now + 2 * 60 * 60 * 1000,
      },
    });

    expect(syncExternalCliCredentials(store)).toBe(false);
    expect(mocks.readCodexCliCredentialsCached).not.toHaveBeenCalled();
    expect(store.profiles["openai-codex:default"]).toMatchObject({
      access: "existing-access",
      refresh: "existing-refresh",
    });
  });
});
