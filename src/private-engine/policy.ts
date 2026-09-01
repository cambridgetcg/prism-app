import type {
  OpportunitySignalConfidence,
  OpportunitySignalLiquidityBand,
} from "../contracts/opportunity-signal-v1";
import type { ConservativeEconomics } from "./economics";

/*
 * Fixture policy only. These thresholds are intentionally private and must
 * never be copied into a provider result, public explanation, or client code.
 * They are deterministic test policy, not a calibrated profitability model.
 */
const MINIMUM_CONSERVATIVE_SPREAD_MINOR = 750n;
const BASE_MINIMUM_MARGIN_BPS = 1_000n;
const MEDIUM_CONFIDENCE_MARGIN_BUFFER_BPS = 500n;
const LIQUIDITY_MARGIN_BUFFER_BPS: Readonly<
  Record<OpportunitySignalLiquidityBand, bigint>
> = Object.freeze({
  unknown: 1_000n,
  low: 1_500n,
  medium: 250n,
  high: 0n,
});

export function meetsPrivateFixturePolicy(
  economics: ConservativeEconomics,
  confidence: OpportunitySignalConfidence,
  liquidity: OpportunitySignalLiquidityBand,
): boolean {
  if (confidence === "low") return false;

  const confidenceBuffer =
    confidence === "medium" ? MEDIUM_CONFIDENCE_MARGIN_BUFFER_BPS : 0n;
  const requiredMargin =
    BASE_MINIMUM_MARGIN_BPS +
    confidenceBuffer +
    LIQUIDITY_MARGIN_BUFFER_BPS[liquidity];

  return (
    economics.net_spread_minor.low >= MINIMUM_CONSERVATIVE_SPREAD_MINOR &&
    economics.margin_bps.low >= requiredMargin
  );
}
