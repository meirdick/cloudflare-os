import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeAuthCode } from "../src/github-api";
import { getOAuthBaseUrl, webhookOrigin, type Env } from "../src/github-env";

const withOrigin = (WEBHOOK_ORIGIN?: string) => ({ WEBHOOK_ORIGIN }) as Env;

describe("webhookOrigin", () => {
  it("leaves GitHub hooks off until a deployment sets it", () => {
    expect(webhookOrigin(withOrigin())).toBeUndefined();
  });

  it("accepts an https origin, with or without a trailing slash", () => {
    expect(webhookOrigin(withOrigin("https://gadgets.example.com"))).toBe("https://gadgets.example.com");
    expect(webhookOrigin(withOrigin("https://Gadgets.Example.com/"))).toBe("https://gadgets.example.com");
  });

  it.each([
    "http://gadgets.example.com",
    "https://gadgets.example.com/gatekeeper/github",
    "https://user:secret@gadgets.example.com",
    "gadgets.example.com",
  ])("refuses %s, which webhooks would not reach safely", origin => {
    expect(() => webhookOrigin(withOrigin(origin))).toThrow("WEBHOOK_ORIGIN must be an https origin");
  });
});

describe("getOAuthBaseUrl", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("defaults to GitHub", () => {
    expect(getOAuthBaseUrl({} as Env)).toBe("https://github.com");
  });

  it("takes a deployment's authorization server, without a trailing slash", () => {
    const env = { OAUTH_BASE_URL: "https://os.example.com/gatekeeper/keyring/" } as Env;
    expect(getOAuthBaseUrl(env)).toBe("https://os.example.com/gatekeeper/keyring");
  });

  it("sends the code exchange to that server", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({ access_token: "gho_n", token_type: "bearer", scope: "repo,read:user" }));
    vi.stubGlobal("fetch", fetch);

    const grant = await exchangeAuthCode("code", "client", "secret",
      "https://os.example.com/gatekeeper/github/oauth", "https://os.example.com/gatekeeper/keyring");

    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://os.example.com/gatekeeper/keyring/login/oauth/access_token");
    expect(grant).toEqual({ accessToken: "gho_n", scopes: ["repo", "read:user"] });
  });
});
