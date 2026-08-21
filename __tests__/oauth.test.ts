import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createOAuthState,
  decryptToken,
  encryptToken,
  getAuthorizationUrl,
  verifyOAuthState,
} from "../lib/meta/oauth";

beforeEach(() => {
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret-with-enough-length");
  vi.stubEnv(
    "ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  );
});

describe("OAuth state and token encryption", () => {
  it("round-trips encrypted tokens", () => {
    const encrypted = encryptToken("long-lived-token");
    expect(encrypted).not.toBe("long-lived-token");
    expect(decryptToken(encrypted)).toBe("long-lived-token");
  });

  it("signs and verifies Instagram OAuth state", () => {
    const state = createOAuthState("workspace_123");
    expect(verifyOAuthState(state)?.workspaceId).toBe("workspace_123");
  });

  it("rejects tampered OAuth state", () => {
    const state = createOAuthState("workspace_123");
    expect(verifyOAuthState(`${state}tampered`)).toBeNull();
  });

  it("builds Instagram Business Login authorize URL, not Facebook Login", () => {
    vi.stubEnv("INSTAGRAM_APP_ID", "1003342969405666");
    const url = getAuthorizationUrl(
      "https://instagram-automation-roan.vercel.app/api/instagram/callback",
      "signed-state"
    );
    expect(url.startsWith("https://www.instagram.com/oauth/authorize?")).toBe(
      true
    );
    expect(url).toContain("client_id=1003342969405666");
    expect(url).toContain("enable_fb_login=0");
    expect(url).not.toContain("facebook.com");
    expect(url).not.toContain("api.instagram.com/oauth/authorize");
  });
});
