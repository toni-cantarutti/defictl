import { describe, expect, test } from "bun:test";

import { fetchHyperliquidFundingHistory } from "../src/hyperliquid/api";

function buildJsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
  });
}

describe("fetchHyperliquidFundingHistory", () => {
  test("paginates through multiple funding-history pages", async () => {
    const originalFetch = globalThis.fetch;
    const requestPayloads: unknown[] = [];
    let callCount = 0;

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (_url: string | URL | Request, init?: RequestInit) => {
        requestPayloads.push(JSON.parse(String(init?.body)));
        callCount += 1;

        if (callCount === 1) {
          return buildJsonResponse([
            {
              coin: "xyz:EUR",
              fundingRate: "0.0001",
              premium: "0",
              time: 1_000,
            },
            {
              coin: "xyz:EUR",
              fundingRate: "0.0002",
              premium: "0",
              time: 2_000,
            },
          ]);
        }

        if (callCount === 2) {
          return buildJsonResponse([
            {
              coin: "xyz:EUR",
              fundingRate: "0.0003",
              premium: "0",
              time: 3_000,
            },
          ]);
        }

        return buildJsonResponse([]);
      },
      writable: true,
    });

    try {
      const fundingHistory = await fetchHyperliquidFundingHistory("xyz:EUR", 500, 5_000);

      expect(fundingHistory.map((entry) => entry.time)).toEqual([1_000, 2_000, 3_000]);
      expect(requestPayloads).toEqual([
        {
          coin: "xyz:EUR",
          endTime: 5_000,
          startTime: 500,
          type: "fundingHistory",
        },
        {
          coin: "xyz:EUR",
          endTime: 5_000,
          startTime: 2_001,
          type: "fundingHistory",
        },
        {
          coin: "xyz:EUR",
          endTime: 5_000,
          startTime: 3_001,
          type: "fundingHistory",
        },
      ]);
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: originalFetch,
        writable: true,
      });
    }
  });
});
