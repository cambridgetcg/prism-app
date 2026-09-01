import {
  OPPORTUNITY_SIGNAL_EVIDENCE_SCHEMA,
  OPPORTUNITY_SIGNAL_INPUT_SCHEMA,
  OPPORTUNITY_SIGNAL_OPERATION,
  type OpportunitySignalEvidenceEnvelopeV1,
  type OpportunitySignalInputV1,
  type OpportunitySignalIntegerRange,
} from "../contracts/opportunity-signal-v1";

export interface OpportunityFixtureOptions {
  readonly askingPriceMinor?: number;
  readonly grossExitMinor?: OpportunitySignalIntegerRange;
  readonly confidence?: OpportunitySignalInputV1["valuation"]["confidence"];
  readonly rightsEligible?: boolean;
  readonly rightsExpiresAt?: string;
  readonly outboundShippingUnknown?: boolean;
}

const EVALUATED_AT = "2026-09-01T12:00:00.000Z";
const EVIDENCE = Object.freeze({
  source_stated_at: "2026-09-01T11:55:00.000Z",
  retrieved_at: "2026-09-01T11:56:00.000Z",
  expires_at: "2026-09-01T12:05:00.000Z",
});

function exactCost(amount: number) {
  return {
    state: "known" as const,
    amount_minor: { low: amount, midpoint: amount, high: amount },
    evidence: { ...EVIDENCE },
  };
}

/**
 * Fixed representative input; it does not read any source or application
 * data. Current public canonical vectors: evidence 2,196 bytes and full
 * request 2,586 bytes. Their SHA-256 values are pinned in this fixture/tests.
 */
export function createOpportunitySignalFixture(
  options: OpportunityFixtureOptions = {},
): OpportunitySignalInputV1 {
  return {
    schema: OPPORTUNITY_SIGNAL_INPUT_SCHEMA,
    evaluated_at: EVALUATED_AT,
    candidate: {
      candidate_ref: "ctcg_cand_AbCdEfGhIjKlMnOpQrStUv",
      asset: {
        sku: "op-op01-001-en",
        condition: "near_mint",
        finish: "normal",
      },
      quantity: 1,
      asking_price_minor: options.askingPriceMinor ?? 2_000,
      observed_at: "2026-09-01T11:55:00.000Z",
      retrieved_at: "2026-09-01T11:56:00.000Z",
      expires_at: "2026-09-01T12:05:00.000Z",
    },
    valuation: {
      asset: {
        sku: "op-op01-001-en",
        condition: "near_mint",
        finish: "normal",
      },
      estimated_gross_exit_minor: options.grossExitMinor ?? {
        low: 4_000,
        midpoint: 4_200,
        high: 4_400,
      },
      evidence: { ...EVIDENCE },
      basis: "aggregate_reference",
      confidence: options.confidence ?? "medium",
      evidence_flags: ["aggregate_not_trade_tape"],
      // Unknown is evidence-honest and remains unknown at public projection.
      liquidity: { band: "unknown" },
    },
    costs: {
      buyer_fee: exactCost(100),
      inbound_shipping: exactCost(200),
      acquisition_tax_and_duty: { state: "not_applicable", reason: "not_due" },
      seller_fee: {
        state: "estimated",
        amount_minor: { low: 400, midpoint: 420, high: 440 },
        evidence: { ...EVIDENCE },
      },
      payment_processing: {
        state: "estimated",
        amount_minor: { low: 100, midpoint: 105, high: 110 },
        evidence: { ...EVIDENCE },
      },
      outbound_shipping: options.outboundShippingUnknown
        ? { state: "unknown" }
        : {
            state: "estimated",
            amount_minor: { low: 250, midpoint: 275, high: 300 },
            evidence: { ...EVIDENCE },
          },
      disposal_tax_and_duty: { state: "not_applicable", reason: "not_due" },
    },
    currency_normalization: {
      currency: "GBP",
      state: "not_required",
      reason: "all_inputs_native_gbp",
    },
    release_eligibility: {
      operation: OPPORTUNITY_SIGNAL_OPERATION,
      eligible: options.rightsEligible ?? true,
      evaluated_at: "2026-09-01T11:59:00.000Z",
      expires_at:
        options.rightsExpiresAt ?? "2026-09-01T12:05:00.000Z",
      policy_digest:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      evidence_bundle_digest:
        "sha256:23646a4e942e7aefa9012cc90860244628af84096794bd1082c6fea13088c3c2",
    },
  };
}

/** Exact synthetic envelope used to bind fixture evidence before rights. */
export function createOpportunitySignalEvidenceFixture(
  input: OpportunitySignalInputV1 = createOpportunitySignalFixture(),
): OpportunitySignalEvidenceEnvelopeV1 {
  return {
    schema: OPPORTUNITY_SIGNAL_EVIDENCE_SCHEMA,
    evaluated_at: input.evaluated_at,
    candidate: input.candidate,
    valuation: input.valuation,
    costs: input.costs,
    currency_normalization: input.currency_normalization,
  };
}
