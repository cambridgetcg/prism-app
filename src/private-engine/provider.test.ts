import assert from "node:assert/strict";
import { describe, it } from "node:test";
import contractPin from "../contracts/opportunity-signal-v1.pin.json";
import {
  OPPORTUNITY_SIGNAL_EVIDENCE_SCHEMA,
  OPPORTUNITY_SIGNAL_INPUT_SCHEMA,
  OPPORTUNITY_SIGNAL_PROVIDER_RESULT_SCHEMA,
  OPPORTUNITY_SIGNAL_PUBLIC_OUTPUT_SCHEMA,
  type OpportunitySignalInputV1,
  type OpportunitySignalProviderContextV1,
  type OpportunitySignalReasonCode,
} from "../contracts/opportunity-signal-v1";
import { calculateConservativeEconomics } from "./economics";
import {
  createOpportunitySignalEvidenceFixture,
  createOpportunitySignalFixture,
} from "./fixtures";
import {
  evaluateFixtureOpportunitySignalV1,
  fixtureOpportunityProviderV1,
} from "./provider";
import goldenVector from "./opportunity-signal-v1.golden.json";

const REQUEST_DIGEST = goldenVector.request
  .digest as OpportunitySignalProviderContextV1["request_digest"];
const PROVIDER_CONTEXT: OpportunitySignalProviderContextV1 = Object.freeze({
  request_digest: REQUEST_DIGEST,
});
const PROVIDER_RESULT_KEYS = [
  "candidate_ref",
  "classification",
  "evaluated_at",
  "expires_at",
  "reason_codes",
  "request_digest",
  "schema",
];

function evaluate(input: OpportunitySignalInputV1) {
  return evaluateFixtureOpportunitySignalV1(input, PROVIDER_CONTEXT);
}

function notApplicableCosts(
  input: OpportunitySignalInputV1,
): OpportunitySignalInputV1["costs"] {
  return Object.fromEntries(
    Object.keys(input.costs).map((key) => [
      key,
      { state: "not_applicable", reason: "not_charged" },
    ]),
  ) as OpportunitySignalInputV1["costs"];
}

describe("fixture opportunity provider v1", () => {
  it("pins all four kingdom-109 schema identifiers", () => {
    assert.deepEqual(contractPin, {
      repository:
        "https://github.com/cambridgetcg/Cambridge-TCG-monorepo.git",
      commit: "042aa9085150d5ad3e80a3bf3595439b24bf81f7",
      package_path: "packages/opportunity-signal",
      package_tree: "cb287cf64c70454035b535e2ff088a779dc16c62",
      schemas: {
        input: "cambridgetcg.opportunity-signal-input/1",
        evidence: "cambridgetcg.opportunity-signal-evidence/1",
        provider_result:
          "cambridgetcg.opportunity-signal-provider-result/1",
        public_output: "cambridgetcg.opportunity-signal/1",
      },
    });
    assert.equal(
      OPPORTUNITY_SIGNAL_INPUT_SCHEMA,
      "cambridgetcg.opportunity-signal-input/1",
    );
    assert.equal(
      OPPORTUNITY_SIGNAL_EVIDENCE_SCHEMA,
      "cambridgetcg.opportunity-signal-evidence/1",
    );
    assert.equal(
      OPPORTUNITY_SIGNAL_PROVIDER_RESULT_SCHEMA,
      "cambridgetcg.opportunity-signal-provider-result/1",
    );
    assert.equal(
      OPPORTUNITY_SIGNAL_PUBLIC_OUTPUT_SCHEMA,
      "cambridgetcg.opportunity-signal/1",
    );
    assert.equal(
      createOpportunitySignalEvidenceFixture().schema,
      OPPORTUNITY_SIGNAL_EVIDENCE_SCHEMA,
    );
    assert.equal(
      createOpportunitySignalFixture().release_eligibility
        .evidence_bundle_digest,
      goldenVector.evidence.digest,
    );
    assert.equal(goldenVector.evidence.canonical_bytes, 2_196);
    assert.equal(goldenVector.request.canonical_bytes, 2_586);
  });

  it("keeps exact BigInt economics private and emits classification plus binding only", () => {
    const input = createOpportunitySignalFixture();
    const economics = calculateConservativeEconomics(input);
    const result = evaluate(input);

    assert.deepEqual(economics.net_spread_minor, {
      low: 850n,
      midpoint: 1_100n,
      high: 1_350n,
    });
    assert.deepEqual(economics.margin_bps, {
      low: 3_695n,
      midpoint: 4_782n,
      high: 5_869n,
    });
    assert.deepEqual(result, goldenVector.expected_provider_result);
    assert.ok(!Object.hasOwn(result, "estimate"));
  });

  it("returns no economics when the private threshold is not met", () => {
    const result = evaluate(
      createOpportunitySignalFixture({
        grossExitMinor: { low: 3_200, midpoint: 3_400, high: 3_600 },
      }),
    );

    assert.equal(result.classification, "not_qualified");
    assert.ok(!Object.hasOwn(result, "estimate"));
    assert.deepEqual(result.reason_codes, [
      "private_policy_threshold_not_met",
    ]);
  });

  it("retains losses as signed, floor-rounded economics before not qualifying", () => {
    const input = createOpportunitySignalFixture({
      grossExitMinor: { low: 1_000, midpoint: 1_200, high: 1_400 },
    });
    const economics = calculateConservativeEconomics(input);
    const result = evaluate(input);

    assert.deepEqual(economics.net_spread_minor, {
      low: -2_150n,
      midpoint: -1_900n,
      high: -1_650n,
    });
    assert.deepEqual(economics.margin_bps, {
      low: -9_348n,
      midpoint: -8_261n,
      high: -7_174n,
    });
    assert.equal(result.classification, "not_qualified");
    assert.ok(!Object.hasOwn(result, "estimate"));
  });

  it("keeps signed margin bounds ordered when acquisition costs vary", () => {
    const fixture = createOpportunitySignalFixture({
      askingPriceMinor: 1_000,
      grossExitMinor: { low: 100, midpoint: 100, high: 100 },
    });
    const input: OpportunitySignalInputV1 = {
      ...fixture,
      costs: {
        buyer_fee: {
          state: "estimated",
          amount_minor: { low: 0, midpoint: 500, high: 1_000 },
          evidence: fixture.valuation.evidence,
        },
        inbound_shipping: {
          state: "not_applicable",
          reason: "not_charged",
        },
        acquisition_tax_and_duty: {
          state: "not_applicable",
          reason: "not_due",
        },
        seller_fee: {
          state: "known",
          amount_minor: { low: 2_000, midpoint: 2_000, high: 2_000 },
          evidence: fixture.valuation.evidence,
        },
        payment_processing: {
          state: "not_applicable",
          reason: "not_charged",
        },
        outbound_shipping: {
          state: "not_applicable",
          reason: "not_charged",
        },
        disposal_tax_and_duty: {
          state: "not_applicable",
          reason: "not_due",
        },
      },
    };

    const economics = calculateConservativeEconomics(input);
    const result = evaluate(input);

    assert.deepEqual(economics.acquisition_minor, {
      low: 1_000n,
      midpoint: 1_500n,
      high: 2_000n,
    });
    assert.deepEqual(economics.net_spread_minor, {
      low: -3_900n,
      midpoint: -3_400n,
      high: -2_900n,
    });
    assert.deepEqual(economics.margin_bps, {
      low: -29_000n,
      midpoint: -22_667n,
      high: -19_500n,
    });
    assert.ok(economics.margin_bps.low <= economics.margin_bps.midpoint);
    assert.ok(economics.margin_bps.midpoint <= economics.margin_bps.high);
    assert.equal(result.classification, "not_qualified");
  });

  it("keeps signed margin bounds ordered across a zero-crossing interval", () => {
    const fixture = createOpportunitySignalFixture({
      askingPriceMinor: 1_000,
      grossExitMinor: { low: 100, midpoint: 3_000, high: 5_000 },
    });
    const input: OpportunitySignalInputV1 = {
      ...fixture,
      costs: {
        ...notApplicableCosts(fixture),
        buyer_fee: {
          state: "estimated",
          amount_minor: { low: 0, midpoint: 500, high: 1_000 },
          evidence: fixture.valuation.evidence,
        },
      },
    };

    const economics = calculateConservativeEconomics(input);

    assert.deepEqual(economics.margin_bps, {
      low: -9_500n,
      midpoint: 10_000n,
      high: 40_000n,
    });
    assert.ok(economics.margin_bps.low <= economics.margin_bps.midpoint);
    assert.ok(economics.margin_bps.midpoint <= economics.margin_bps.high);
  });

  it("fails closed when any enumerated transaction cost is unknown", () => {
    const result = evaluate(
      createOpportunitySignalFixture({ outboundShippingUnknown: true }),
    );

    assert.equal(result.classification, "unavailable");
    assert.ok(!Object.hasOwn(result, "estimate"));
    assert.deepEqual(result.reason_codes, ["unknown_cost"]);
  });

  it("fails closed when rights are ineligible or expired", () => {
    for (const options of [
      { rightsEligible: false },
      { rightsExpiresAt: "2026-09-01T12:00:00.000Z" },
    ] as const) {
      const result = evaluate(createOpportunitySignalFixture(options));

      assert.equal(result.classification, "unavailable");
      assert.ok(!Object.hasOwn(result, "estimate"));
      assert.ok(result.reason_codes.includes("rights_not_eligible"));
    }
  });

  it("fails closed on candidate, valuation, and cost expiry", () => {
    const fixture = createOpportunitySignalFixture();
    const cases: readonly [
      OpportunitySignalInputV1,
      "candidate_expired" | "valuation_expired" | "cost_quote_expired",
    ][] = [
      [
        {
          ...fixture,
          candidate: {
            ...fixture.candidate,
            expires_at: fixture.evaluated_at,
          },
        },
        "candidate_expired",
      ],
      [
        {
          ...fixture,
          valuation: {
            ...fixture.valuation,
            evidence: {
              ...fixture.valuation.evidence,
              expires_at: fixture.evaluated_at,
            },
          },
        },
        "valuation_expired",
      ],
      [
        {
          ...fixture,
          costs: {
            ...fixture.costs,
            buyer_fee: {
              state: "known",
              amount_minor: { low: 100, midpoint: 100, high: 100 },
              evidence: {
                ...fixture.valuation.evidence,
                expires_at: fixture.evaluated_at,
              },
            },
          },
        },
        "cost_quote_expired",
      ],
    ];

    for (const [input, reason] of cases) {
      const result = evaluate(input);
      assert.equal(result.classification, "unavailable");
      assert.ok(result.reason_codes.includes(reason));
    }
  });

  it("fails closed on missing/estimated FX, asset mismatch, and stale liquidity", () => {
    const fixture = createOpportunitySignalFixture();
    const inputs: readonly [
      OpportunitySignalInputV1,
      OpportunitySignalReasonCode,
    ][] = [
      [
        {
          ...fixture,
          currency_normalization: {
            currency: "GBP",
            state: "unknown",
            evidence: fixture.valuation.evidence,
          },
        },
        "fx_missing",
      ],
      [
        {
          ...fixture,
          currency_normalization: {
            currency: "GBP",
            state: "estimated",
            evidence: fixture.valuation.evidence,
          },
        },
        "insufficient_evidence",
      ],
      [
        {
          ...fixture,
          valuation: {
            ...fixture.valuation,
            asset: { ...fixture.valuation.asset, sku: "op-op01-002-en" },
          },
        },
        "asset_mismatch",
      ],
      [
        {
          ...fixture,
          valuation: {
            ...fixture.valuation,
            liquidity: {
              band: "low",
              evidence: {
                ...fixture.valuation.evidence,
                expires_at: fixture.evaluated_at,
              },
            },
          },
        },
        "insufficient_evidence",
      ],
    ];

    for (const [input, reason] of inputs) {
      const result = evaluate(input);
      assert.equal(result.classification, "unavailable");
      assert.ok(result.reason_codes.includes(reason));
    }
  });

  it("keeps multiple fail-closed reasons unique and canonically ordered", () => {
    const result = evaluate(
      createOpportunitySignalFixture({
        rightsEligible: false,
        outboundShippingUnknown: true,
      }),
    );

    assert.deepEqual(result.reason_codes, [
      "rights_not_eligible",
      "unknown_cost",
    ]);
  });

  it("treats low confidence as insufficient evidence, not a probability", () => {
    const result = evaluate(
      createOpportunitySignalFixture({ confidence: "low" }),
    );

    assert.equal(result.classification, "unavailable");
    assert.deepEqual(result.reason_codes, ["insufficient_evidence"]);
    assert.ok(!Object.hasOwn(result, "probability"));
    assert.ok(!Object.hasOwn(result, "confidence"));
  });

  it("preserves unknown liquidity by neither inventing nor exporting a band", () => {
    const input = createOpportunitySignalFixture();
    assert.deepEqual(input.valuation.liquidity, { band: "unknown" });

    const result = evaluate(input);

    assert.deepEqual(input.valuation.liquidity, { band: "unknown" });
    assert.equal(result.classification, "potential_deal");
    assert.ok(!Object.hasOwn(result, "liquidity"));
  });

  it("keeps very large exact economics internal instead of serializing them", () => {
    const fixture = createOpportunitySignalFixture({
      askingPriceMinor: 1,
      grossExitMinor: {
        low: 100_000_000_000,
        midpoint: 100_000_000_000,
        high: 100_000_000_000,
      },
    });
    const input: OpportunitySignalInputV1 = {
      ...fixture,
      costs: notApplicableCosts(fixture),
    };

    const economics = calculateConservativeEconomics(input);
    const result = evaluate(input);

    assert.ok(economics.margin_bps.high > 100_000_000_000n);
    assert.equal(result.classification, "potential_deal");
    assert.ok(!Object.hasOwn(result, "estimate"));
  });

  it("rejects negative zero at the integer-money boundary", () => {
    const result = evaluate(
      createOpportunitySignalFixture({ askingPriceMinor: -0 }),
    );

    assert.equal(result.classification, "unavailable");
    assert.deepEqual(result.reason_codes, ["invalid_input"]);
  });

  it("echoes the exact request digest and rejects malformed digest context", () => {
    const input = createOpportunitySignalFixture();
    assert.equal(evaluate(input).request_digest, REQUEST_DIGEST);

    assert.throws(
      () =>
        evaluateFixtureOpportunitySignalV1(input, {
          request_digest: "sha256:not-a-digest",
        }),
      /invalid v1 context/,
    );
  });

  it("returns only the exact public-safe provider seam and no engine internals", async () => {
    const result = await fixtureOpportunityProviderV1.evaluate(
      createOpportunitySignalFixture(),
      PROVIDER_CONTEXT,
    );
    assert.equal(typeof result, "object");
    assert.deepEqual(Object.keys(result as object).sort(), PROVIDER_RESULT_KEYS);

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "estimate",
      "estimated_gross_exit_minor",
      "estimated_net_transaction_spread_minor",
      "estimated_margin_bps",
      "fair_value",
      "feature",
      "weight",
      "minimum_spread",
      "minimum_margin",
      "policy_digest",
      "evidence_bundle_digest",
      "source_stated_at",
      "debug",
    ]) {
      assert.ok(!serialized.includes(forbidden));
    }
  });
});
