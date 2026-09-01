import {
  OPPORTUNITY_SIGNAL_COST_KEYS,
  OPPORTUNITY_SIGNAL_CURRENCY,
  OPPORTUNITY_SIGNAL_FX_NOT_REQUIRED_REASON,
  OPPORTUNITY_SIGNAL_INPUT_SCHEMA,
  OPPORTUNITY_SIGNAL_MAX_LIFETIME_MS,
  OPPORTUNITY_SIGNAL_MAX_MINOR_UNITS,
  OPPORTUNITY_SIGNAL_OPERATION,
  OPPORTUNITY_SIGNAL_NOT_APPLICABLE_REASONS,
  OPPORTUNITY_SIGNAL_PROVIDER_RESULT_SCHEMA,
  type OpportunitySignalInputV1,
  type OpportunitySignalProviderContextV1,
  type OpportunitySignalProviderResultV1,
  type OpportunitySignalProviderV1,
  type OpportunitySignalReasonCode,
} from "../contracts/opportunity-signal-v1";
import {
  calculateConservativeEconomics,
  validIntegerRange,
} from "./economics";
import { meetsPrivateFixturePolicy } from "./policy";

const REASON_ORDER: readonly OpportunitySignalReasonCode[] = [
  "invalid_input",
  "rights_not_eligible",
  "candidate_expired",
  "valuation_expired",
  "cost_quote_expired",
  "unknown_cost",
  "fx_missing",
  "fx_expired",
  "asset_mismatch",
  "insufficient_evidence",
  "numeric_overflow",
  "private_policy_threshold_not_met",
  "private_policy_threshold_met",
];

const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;
const CANDIDATE_REF = /^ctcg_cand_[A-Za-z0-9]{22}$/;
const NOT_APPLICABLE_REASONS = new Set(
  OPPORTUNITY_SIGNAL_NOT_APPLICABLE_REASONS,
);

function instant(timestamp: string): number | null {
  const milliseconds = Date.parse(timestamp);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function timestampAfter(milliseconds: number): string {
  const value = new Date(milliseconds).toISOString();
  if (value.length !== 24) {
    throw new Error("Opportunity input cannot produce a v1 expiry.");
  }
  return value;
}

function canonicalReasons(
  reasons: Iterable<OpportunitySignalReasonCode>,
): readonly OpportunitySignalReasonCode[] {
  const values = new Set(reasons);
  return Object.freeze(REASON_ORDER.filter((reason) => values.has(reason)));
}

function sameAsset(input: OpportunitySignalInputV1): boolean {
  const candidate = input.candidate.asset;
  const valuation = input.valuation.asset;
  return (
    candidate.sku === valuation.sku &&
    candidate.condition === valuation.condition &&
    candidate.finish === valuation.finish
  );
}

function integerInContractRange(value: number, positive = false): boolean {
  return (
    Number.isSafeInteger(value) &&
    !Object.is(value, -0) &&
    value >= (positive ? 1 : 0) &&
    value <= OPPORTUNITY_SIGNAL_MAX_MINOR_UNITS
  );
}

interface PreflightResult {
  readonly evaluatedMs: number;
  readonly activeExpiresAt: string | null;
  readonly reasonCodes: readonly OpportunitySignalReasonCode[];
}

function preflight(input: OpportunitySignalInputV1): PreflightResult {
  const evaluatedMs = instant(input.evaluated_at);
  if (evaluatedMs === null) {
    // The public kingdom-109 parser owns malformed input handling. Throwing a
    // generic error lets that projector return a redacted invalid_input result
    // without reflecting the malformed value.
    throw new Error("Opportunity provider received an invalid v1 input.");
  }

  const reasons: OpportunitySignalReasonCode[] = [];
  const expiryCandidates = [evaluatedMs + OPPORTUNITY_SIGNAL_MAX_LIFETIME_MS];
  const candidateExpiry = instant(input.candidate.expires_at);
  const valuationExpiry = instant(input.valuation.evidence.expires_at);
  const rightsEvaluated = instant(input.release_eligibility.evaluated_at);
  const rightsExpiry = instant(input.release_eligibility.expires_at);

  if (
    input.schema !== OPPORTUNITY_SIGNAL_INPUT_SCHEMA ||
    !CANDIDATE_REF.test(input.candidate.candidate_ref) ||
    input.candidate.quantity !== 1 ||
    !integerInContractRange(input.candidate.asking_price_minor, true) ||
    !validIntegerRange(input.valuation.estimated_gross_exit_minor) ||
    input.currency_normalization.currency !== OPPORTUNITY_SIGNAL_CURRENCY ||
    input.release_eligibility.operation !== OPPORTUNITY_SIGNAL_OPERATION ||
    !SHA256_DIGEST.test(input.release_eligibility.policy_digest) ||
    !SHA256_DIGEST.test(input.release_eligibility.evidence_bundle_digest) ||
    (input.currency_normalization.state === "not_required" &&
      input.currency_normalization.reason !==
        OPPORTUNITY_SIGNAL_FX_NOT_REQUIRED_REASON) ||
    candidateExpiry === null ||
    valuationExpiry === null ||
    rightsEvaluated === null ||
    rightsExpiry === null ||
    rightsEvaluated > evaluatedMs
  ) {
    reasons.push("invalid_input");
  }

  if (
    !input.release_eligibility.eligible ||
    rightsExpiry === null ||
    rightsExpiry <= evaluatedMs
  ) {
    reasons.push("rights_not_eligible");
  } else {
    expiryCandidates.push(rightsExpiry);
  }

  if (candidateExpiry === null) {
    reasons.push("invalid_input");
  } else if (candidateExpiry <= evaluatedMs) {
    reasons.push("candidate_expired");
  } else {
    expiryCandidates.push(candidateExpiry);
  }

  if (valuationExpiry === null) {
    reasons.push("invalid_input");
  } else if (valuationExpiry <= evaluatedMs) {
    reasons.push("valuation_expired");
  } else {
    expiryCandidates.push(valuationExpiry);
  }

  for (const key of OPPORTUNITY_SIGNAL_COST_KEYS) {
    const cost = input.costs[key];
    if (cost.state === "unknown") {
      reasons.push("unknown_cost");
      continue;
    }
    if (cost.state === "not_applicable") {
      if (!NOT_APPLICABLE_REASONS.has(cost.reason)) {
        reasons.push("invalid_input");
      }
      continue;
    }
    if (cost.state !== "known" && cost.state !== "estimated") {
      reasons.push("invalid_input");
      continue;
    }
    if (!validIntegerRange(cost.amount_minor)) {
      reasons.push("invalid_input");
      continue;
    }
    const costExpiry = instant(cost.evidence.expires_at);
    if (costExpiry === null) {
      reasons.push("invalid_input");
    } else if (costExpiry <= evaluatedMs) {
      reasons.push("cost_quote_expired");
    } else {
      expiryCandidates.push(costExpiry);
    }
  }

  if (input.currency_normalization.state === "unknown") {
    reasons.push("fx_missing");
  } else if (input.currency_normalization.state !== "not_required") {
    const fxExpiry = instant(input.currency_normalization.evidence.expires_at);
    if (fxExpiry === null) {
      reasons.push("invalid_input");
    } else if (fxExpiry <= evaluatedMs) {
      reasons.push("fx_expired");
    } else {
      expiryCandidates.push(fxExpiry);
    }
    if (input.currency_normalization.state === "estimated") {
      reasons.push("insufficient_evidence");
    }
  }

  if (!sameAsset(input)) reasons.push("asset_mismatch");
  if (input.valuation.confidence === "low") {
    reasons.push("insufficient_evidence");
  }

  if (input.valuation.liquidity.band !== "unknown") {
    const liquidityExpiry = instant(input.valuation.liquidity.evidence.expires_at);
    if (liquidityExpiry === null) {
      reasons.push("invalid_input");
    } else if (liquidityExpiry <= evaluatedMs) {
      reasons.push("insufficient_evidence");
    } else {
      expiryCandidates.push(liquidityExpiry);
    }
  }

  const earliestExpiry = Math.min(...expiryCandidates);
  const activeExpiresAt =
    Number.isSafeInteger(earliestExpiry) && earliestExpiry > evaluatedMs
      ? timestampAfter(earliestExpiry)
      : null;
  if (activeExpiresAt === null) reasons.push("numeric_overflow");

  return Object.freeze({
    evaluatedMs,
    activeExpiresAt,
    reasonCodes: canonicalReasons(reasons),
  });
}

function failureExpiry(evaluatedMs: number): string {
  return timestampAfter(evaluatedMs + OPPORTUNITY_SIGNAL_MAX_LIFETIME_MS);
}

function unavailable(
  input: OpportunitySignalInputV1,
  context: OpportunitySignalProviderContextV1,
  evaluatedMs: number,
  reasonCodes: readonly OpportunitySignalReasonCode[],
  activeExpiresAt: string | null = null,
): OpportunitySignalProviderResultV1 {
  return Object.freeze({
    schema: OPPORTUNITY_SIGNAL_PROVIDER_RESULT_SCHEMA,
    candidate_ref: input.candidate.candidate_ref,
    evaluated_at: input.evaluated_at,
    request_digest: context.request_digest,
    expires_at: activeExpiresAt ?? failureExpiry(evaluatedMs),
    classification: "unavailable",
    reason_codes: canonicalReasons(reasonCodes),
  });
}

/**
 * Deterministic fixture-only private provider. It performs no I/O and returns
 * only the exact kingdom-109 provider-result seam. Public projection remains
 * the responsibility of @cambridge-tcg/opportunity-signal.
 */
export function evaluateFixtureOpportunitySignalV1(
  input: OpportunitySignalInputV1,
  context: OpportunitySignalProviderContextV1,
): OpportunitySignalProviderResultV1 {
  if (!SHA256_DIGEST.test(context.request_digest)) {
    // The public orchestrator supplies the digest. A malformed private call
    // cannot produce a contract-valid binding echo, so it throws generically
    // for the public layer to redact as invalid_input.
    throw new Error("Opportunity provider received an invalid v1 context.");
  }

  const checked = preflight(input);
  if (checked.reasonCodes.length > 0) {
    return unavailable(
      input,
      context,
      checked.evaluatedMs,
      checked.reasonCodes,
      checked.activeExpiresAt,
    );
  }

  let economics;
  try {
    economics = calculateConservativeEconomics(input);
  } catch {
    return unavailable(
      input,
      context,
      checked.evaluatedMs,
      ["invalid_input"],
      checked.activeExpiresAt,
    );
  }

  const qualifies = meetsPrivateFixturePolicy(
    economics,
    input.valuation.confidence,
    input.valuation.liquidity.band,
  );
  if (!qualifies) {
    return Object.freeze({
      schema: OPPORTUNITY_SIGNAL_PROVIDER_RESULT_SCHEMA,
      candidate_ref: input.candidate.candidate_ref,
      evaluated_at: input.evaluated_at,
      request_digest: context.request_digest,
      expires_at: checked.activeExpiresAt!,
      classification: "not_qualified",
      reason_codes: Object.freeze([
        "private_policy_threshold_not_met",
      ] as const),
    });
  }

  return Object.freeze({
    schema: OPPORTUNITY_SIGNAL_PROVIDER_RESULT_SCHEMA,
    candidate_ref: input.candidate.candidate_ref,
    evaluated_at: input.evaluated_at,
    request_digest: context.request_digest,
    expires_at: checked.activeExpiresAt!,
    classification: "potential_deal",
    reason_codes: Object.freeze(["private_policy_threshold_met"] as const),
  });
}

/** Adapter matching the public asynchronous provider interface, without I/O. */
export const fixtureOpportunityProviderV1: OpportunitySignalProviderV1 =
  Object.freeze({
    evaluate(
      input: OpportunitySignalInputV1,
      context: OpportunitySignalProviderContextV1,
    ): Promise<unknown> {
      return Promise.resolve(evaluateFixtureOpportunitySignalV1(input, context));
    },
  });
