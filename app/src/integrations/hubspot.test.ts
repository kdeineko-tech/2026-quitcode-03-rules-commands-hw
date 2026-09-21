import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { hubspot, toHubspotProperties } from "./hubspot.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Тарас Тестовий",
  email: "taras@studio-nova.example.test",
  phone: "+380 (00) 000-00-01",
  source: "referral",
  budgetUsd: 2500,
  createdAt: "2026-09-10T10:15:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "fake-hubspot-token-0000");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hubspot", () => {
  it("формує властивості контакту з email і телефоном", () => {
    expect(toHubspotProperties(lead)).toEqual({
      email: lead.email,
      firstname: lead.name,
      phone: lead.phone,
      lifecyclestage: "lead",
    });
  });

  it("повертає помилку, якщо не задано HUBSPOT_ACCESS_TOKEN", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "");
    await expect(hubspot.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HUBSPOT_ACCESS_TOKEN",
    });
  });

  it("створює контакт у HubSpot і повертає ok", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"id":"contact_001"}', { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(hubspot.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
    expect(init?.headers).toMatchObject({ authorization: "Bearer fake-hubspot-token-0000" });
    expect(JSON.parse(String(init?.body))).toEqual({ properties: toHubspotProperties(lead) });
  });

  it("повертає помилку, якщо HubSpot відповів помилкою", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"status":"error","message":"invalid email"}', { status: 400 })),
    );

    await expect(hubspot.send(lead)).resolves.toEqual({
      ok: false,
      error: "POST https://api.hubapi.com/crm/v3/objects/contacts failed: HTTP 400",
    });
  });
});
