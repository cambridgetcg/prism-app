import {
  OPPORTUNITY_SIGNAL_COST_KEYS,
  OPPORTUNITY_SIGNAL_MAX_MINOR_UNITS,
  type OpportunitySignalCostStateV1,
  type OpportunitySignalInputV1,
  type OpportunitySignalIntegerRange,
} from "../contracts/opportunity-signal-v1";

export interface BigIntRange {
  readonly low: bigint;
  readonly midpoint: bigint;
  readonly high: bigint;
}

export interface ConservativeEconomics {
  readonly acquisition_minor: BigIntRange;
  readonly net_spread_minor: BigIntRange;
  readonly margin_bps: BigIntRange;
}

const ZERO_RANGE: BigIntRange = Object.freeze({
  low: 0n,
  midpoint: 0n,
  high: 0n,
});

function integerInContractRange(value: number, positive = false): boolean {
  return (
    Number.isSafeInteger(value) &&
    !Object.is(value, -0) &&
    value >= (positive ? 1 : 0) &&
    value <= OPPORTUNITY_SIGNAL_MAX_MINOR_UNITS
  );
}

export function validIntegerRange(
  range: OpportunitySignalIntegerRange,
): boolean {
  return (
    integerInContractRange(range.low) &&
    integerInContractRange(range.midpoint) &&
    integerInContractRange(range.high) &&
    range.low <= range.midpoint &&
    range.midpoint <= range.high
  );
}

function toBigIntRange(range: OpportunitySignalIntegerRange): BigIntRange {
  return {
    low: BigInt(range.low),
    midpoint: BigInt(range.midpoint),
    high: BigInt(range.high),
  };
}

function costRange(cost: OpportunitySignalCostStateV1): BigIntRange {
  if (cost.state === "not_applicable") return ZERO_RANGE;
  if (cost.state === "known" || cost.state === "estimated") {
    return toBigIntRange(cost.amount_minor);
  }
  throw new Error("Opportunity economics require every cost to be known.");
}

function addRanges(left: BigIntRange, right: BigIntRange): BigIntRange {
  return {
    low: left.low + right.low,
    midpoint: left.midpoint + right.midpoint,
    high: left.high + right.high,
  };
}

function sumCosts(
  input: OpportunitySignalInputV1,
  keys: readonly (typeof OPPORTUNITY_SIGNAL_COST_KEYS)[number][],
): BigIntRange {
  return keys.reduce<BigIntRange>(
    (total, key) => addRanges(total, costRange(input.costs[key])),
    ZERO_RANGE,
  );
}

function floorBasisPoints(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("Opportunity margin requires positive acquisition outlay.");
  }

  const scaled = numerator * 10_000n;
  const quotient = scaled / denominator;
  const remainder = scaled % denominator;
  // BigInt division truncates toward zero. Move one integer lower when a
  // negative result has a remainder so losses retain mathematical floor.
  return scaled < 0n && remainder !== 0n ? quotient - 1n : quotient;
}

function marginBasisPoints(netExit: bigint, acquisition: bigint): bigint {
  return floorBasisPoints(netExit - acquisition, acquisition);
}

function minimum(values: readonly bigint[]): bigint {
  return values.reduce((lowest, value) => (value < lowest ? value : lowest));
}

function maximum(values: readonly bigint[]): bigint {
  return values.reduce((highest, value) => (value > highest ? value : highest));
}

/**
 * Computes conservative endpoint-paired economics using BigInt throughout.
 *
 * - low spread: low possible exit minus high total transaction cost;
 * - midpoint: midpoint exit minus midpoint total transaction cost;
 * - high spread: high possible exit minus low total transaction cost;
 * - margin: net spread divided by total acquisition outlay, rounded down;
 * - signed margin bounds: extrema across net-exit/acquisition endpoint pairs,
 *   so negative and zero-crossing intervals remain mathematically ordered.
 */
export function calculateConservativeEconomics(
  input: OpportunitySignalInputV1,
): ConservativeEconomics {
  const asking = BigInt(input.candidate.asking_price_minor);
  const acquisitionCosts = sumCosts(input, [
    "buyer_fee",
    "inbound_shipping",
    "acquisition_tax_and_duty",
  ]);
  const disposalCosts = sumCosts(input, [
    "seller_fee",
    "payment_processing",
    "outbound_shipping",
    "disposal_tax_and_duty",
  ]);
  const acquisition: BigIntRange = {
    low: asking + acquisitionCosts.low,
    midpoint: asking + acquisitionCosts.midpoint,
    high: asking + acquisitionCosts.high,
  };
  const grossExit = toBigIntRange(
    input.valuation.estimated_gross_exit_minor,
  );
  const netExit: BigIntRange = {
    low: grossExit.low - disposalCosts.high,
    midpoint: grossExit.midpoint - disposalCosts.midpoint,
    high: grossExit.high - disposalCosts.low,
  };
  const spread: BigIntRange = {
    low: netExit.low - acquisition.high,
    midpoint: netExit.midpoint - acquisition.midpoint,
    high: netExit.high - acquisition.low,
  };
  const endpointMargins = [
    marginBasisPoints(netExit.low, acquisition.low),
    marginBasisPoints(netExit.low, acquisition.high),
    marginBasisPoints(netExit.high, acquisition.low),
    marginBasisPoints(netExit.high, acquisition.high),
  ] as const;
  const margin: BigIntRange = {
    low: minimum(endpointMargins),
    midpoint: marginBasisPoints(netExit.midpoint, acquisition.midpoint),
    high: maximum(endpointMargins),
  };

  return Object.freeze({
    acquisition_minor: Object.freeze(acquisition),
    net_spread_minor: Object.freeze(spread),
    margin_bps: Object.freeze(margin),
  });
}
