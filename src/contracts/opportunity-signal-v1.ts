/**
 * LOCAL MIRROR — opportunity-signal/v1
 *
 * Canonical public repository:
 * https://github.com/cambridgetcg/Cambridge-TCG-monorepo.git
 *
 * Package path: packages/opportunity-signal
 * Source commit: 629a7ddbc0a55c68f22f509916b2bd86a84367f1
 * Package tree: 333dee9912a51ad95bb4a965b3e3e03a49a35bb8
 * Mission: kingdom-109
 *
 * The immutable source and package tree above plus the schema identifiers
 * below are the compatibility pin. A mutable branch or sibling-worktree path
 * is not a release pin. Keep this mirror deliberately small and replace it
 * with the published public package when one exists. Do not extend the
 * provider result locally.
 */

export const OPPORTUNITY_SIGNAL_INPUT_SCHEMA =
  "cambridgetcg.opportunity-signal-input/1" as const;

export const OPPORTUNITY_SIGNAL_EVIDENCE_SCHEMA =
  "cambridgetcg.opportunity-signal-evidence/1" as const;

export const OPPORTUNITY_SIGNAL_PROVIDER_RESULT_SCHEMA =
  "cambridgetcg.opportunity-signal-provider-result/1" as const;

/** Owned and projected by the public kingdom-109 package, not by PRISM. */
export const OPPORTUNITY_SIGNAL_PUBLIC_OUTPUT_SCHEMA =
  "cambridgetcg.opportunity-signal/1" as const;

export const OPPORTUNITY_SIGNAL_CURRENCY = "GBP" as const;
export const OPPORTUNITY_SIGNAL_OPERATION =
  "subscriber_derived_signal" as const;
export const OPPORTUNITY_SIGNAL_MAX_MINOR_UNITS = 100_000_000_000 as const;
export const OPPORTUNITY_SIGNAL_MAX_LIFETIME_MS = 60_000 as const;

export const OPPORTUNITY_SIGNAL_COST_KEYS = [
  "buyer_fee",
  "inbound_shipping",
  "acquisition_tax_and_duty",
  "seller_fee",
  "payment_processing",
  "outbound_shipping",
  "disposal_tax_and_duty",
] as const;

export const OPPORTUNITY_SIGNAL_NOT_APPLICABLE_REASONS = [
  "included_elsewhere",
  "not_charged",
  "not_due",
] as const;

export const OPPORTUNITY_SIGNAL_FX_NOT_REQUIRED_REASON =
  "all_inputs_native_gbp" as const;

export type OpportunitySignalTimestamp = string;
export type OpportunitySignalSha256Digest = `sha256:${string}`;
export type OpportunitySignalCondition =
  | "mint"
  | "near_mint"
  | "excellent"
  | "good"
  | "light_played"
  | "played"
  | "poor";
export type OpportunitySignalFinish = "normal" | "foil";
export type OpportunitySignalValuationBasis =
  | "aggregate_reference"
  | "completed_sales"
  | "mixed";
/** Evidence-quality band; never a probability of profit. */
export type OpportunitySignalConfidence = "low" | "medium" | "high";
export type OpportunitySignalLiquidityBand =
  | "unknown"
  | "low"
  | "medium"
  | "high";
export type OpportunitySignalEvidenceFlag =
  | "aggregate_not_trade_tape"
  | "short_history"
  | "sparse_history"
  | "interpolated_input";
export type OpportunitySignalCostKey =
  (typeof OPPORTUNITY_SIGNAL_COST_KEYS)[number];
export type OpportunitySignalNotApplicableReason =
  (typeof OPPORTUNITY_SIGNAL_NOT_APPLICABLE_REASONS)[number];
export type OpportunitySignalClassification =
  | "potential_deal"
  | "not_qualified"
  | "unavailable";
export type OpportunitySignalReasonCode =
  | "invalid_input"
  | "rights_not_eligible"
  | "candidate_expired"
  | "valuation_expired"
  | "cost_quote_expired"
  | "unknown_cost"
  | "fx_missing"
  | "fx_expired"
  | "asset_mismatch"
  | "insufficient_evidence"
  | "numeric_overflow"
  | "private_policy_threshold_not_met"
  | "private_policy_threshold_met";

export interface OpportunitySignalIntegerRange {
  readonly low: number;
  readonly midpoint: number;
  readonly high: number;
}

export interface OpportunitySignalAssetV1 {
  readonly sku: string;
  readonly condition: OpportunitySignalCondition;
  readonly finish: OpportunitySignalFinish;
}

export interface OpportunitySignalTimedEvidenceV1 {
  readonly source_stated_at: OpportunitySignalTimestamp;
  readonly retrieved_at: OpportunitySignalTimestamp;
  readonly expires_at: OpportunitySignalTimestamp;
}

export interface OpportunitySignalCandidateV1 {
  readonly candidate_ref: string;
  readonly asset: OpportunitySignalAssetV1;
  readonly quantity: 1;
  /** Already-normalized GBP minor units. */
  readonly asking_price_minor: number;
  readonly observed_at: OpportunitySignalTimestamp;
  readonly retrieved_at: OpportunitySignalTimestamp;
  readonly expires_at: OpportunitySignalTimestamp;
}

export type OpportunitySignalLiquidityV1 =
  | { readonly band: "unknown" }
  | {
      readonly band: Exclude<OpportunitySignalLiquidityBand, "unknown">;
      readonly evidence: OpportunitySignalTimedEvidenceV1;
    };

export interface OpportunitySignalValuationV1 {
  readonly asset: OpportunitySignalAssetV1;
  /** Private input only; never returned by this provider. */
  readonly estimated_gross_exit_minor: OpportunitySignalIntegerRange;
  readonly evidence: OpportunitySignalTimedEvidenceV1;
  readonly basis: OpportunitySignalValuationBasis;
  readonly confidence: OpportunitySignalConfidence;
  readonly evidence_flags: readonly OpportunitySignalEvidenceFlag[];
  readonly liquidity: OpportunitySignalLiquidityV1;
}

export type OpportunitySignalCostStateV1 =
  | { readonly state: "unknown" }
  | {
      readonly state: "not_applicable";
      readonly reason: OpportunitySignalNotApplicableReason;
    }
  | {
      readonly state: "known" | "estimated";
      readonly amount_minor: OpportunitySignalIntegerRange;
      readonly evidence: OpportunitySignalTimedEvidenceV1;
    };

export type OpportunitySignalCostsV1 = Readonly<
  Record<OpportunitySignalCostKey, OpportunitySignalCostStateV1>
>;

export type OpportunitySignalCurrencyNormalizationV1 =
  | {
      readonly currency: typeof OPPORTUNITY_SIGNAL_CURRENCY;
      readonly state: "not_required";
      readonly reason: typeof OPPORTUNITY_SIGNAL_FX_NOT_REQUIRED_REASON;
    }
  | {
      readonly currency: typeof OPPORTUNITY_SIGNAL_CURRENCY;
      readonly state: "quoted" | "estimated" | "unknown";
      readonly evidence: OpportunitySignalTimedEvidenceV1;
    };

export interface OpportunitySignalReleaseEligibilityV1 {
  readonly operation: typeof OPPORTUNITY_SIGNAL_OPERATION;
  readonly eligible: boolean;
  readonly evaluated_at: OpportunitySignalTimestamp;
  readonly expires_at: OpportunitySignalTimestamp;
  readonly policy_digest: OpportunitySignalSha256Digest;
  readonly evidence_bundle_digest: OpportunitySignalSha256Digest;
}

export interface OpportunitySignalEvidenceEnvelopeV1 {
  readonly schema: typeof OPPORTUNITY_SIGNAL_EVIDENCE_SCHEMA;
  readonly evaluated_at: OpportunitySignalTimestamp;
  readonly candidate: OpportunitySignalCandidateV1;
  readonly valuation: OpportunitySignalValuationV1;
  readonly costs: OpportunitySignalCostsV1;
  readonly currency_normalization: OpportunitySignalCurrencyNormalizationV1;
}

export interface OpportunitySignalInputV1 {
  readonly schema: typeof OPPORTUNITY_SIGNAL_INPUT_SCHEMA;
  readonly evaluated_at: OpportunitySignalTimestamp;
  readonly candidate: OpportunitySignalCandidateV1;
  readonly valuation: OpportunitySignalValuationV1;
  readonly costs: OpportunitySignalCostsV1;
  readonly currency_normalization: OpportunitySignalCurrencyNormalizationV1;
  readonly release_eligibility: OpportunitySignalReleaseEligibilityV1;
}

export interface OpportunitySignalProviderContextV1 {
  readonly request_digest: OpportunitySignalSha256Digest;
}

/** The complete and only object PRISM may return across the private seam. */
export interface OpportunitySignalProviderResultV1 {
  readonly schema: typeof OPPORTUNITY_SIGNAL_PROVIDER_RESULT_SCHEMA;
  readonly candidate_ref: string;
  readonly evaluated_at: OpportunitySignalTimestamp;
  readonly request_digest: OpportunitySignalSha256Digest;
  readonly expires_at: OpportunitySignalTimestamp;
  readonly classification: OpportunitySignalClassification;
  readonly reason_codes: readonly OpportunitySignalReasonCode[];
}

export interface OpportunitySignalProviderV1 {
  evaluate(
    input: OpportunitySignalInputV1,
    context: OpportunitySignalProviderContextV1,
  ): Promise<unknown>;
}
