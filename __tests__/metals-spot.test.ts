import { describe, it, expect, vi } from "vitest";

describe("getSpotFilsPerGram (mocked fetch)", () => {
  it("calls Metals.dev API and returns fils/gram + timestamp", async () => {
    // Mock the global fetch before importing the module
    const mockSpot = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ metals: { gold: 2500.50 } }),
    });
    vi.stubGlobal("fetch", mockSpot);

    // Set API key for test
    process.env.METALS_DEV_API_KEY = "test-key";

    const { getSpotFilsPerGram } = await import("@/lib/integrations/metals");
    const result = await getSpotFilsPerGram("gold");

    // 2500.50 USD/troy_oz * 3.673 AED/USD / 31.1034768 g/troy_oz = AED/g
    // = (2500.50 * 3.673) / 31.1034768 = ~295.2805 AED/g
    // * 100 = ~29528 fils/g
    expect(result.spotFilsPerGram).toBeGreaterThan(0);
    expect(result.spotFilsPerGram).toBe(29528);
    expect(result.fetchedAt).toBeTruthy();
    expect(mockSpot).toHaveBeenCalledWith(
      expect.stringContaining("api.metals.dev"),
      expect.any(Object),
    );

    vi.unstubAllGlobals();
  });
});
