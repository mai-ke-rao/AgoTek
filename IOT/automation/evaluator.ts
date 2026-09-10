// Pure condition evaluation (§4, §7.1). No I/O, no DB, no throwing — the
// engine hands in a map of latest values and gets a boolean back. Everything
// that touches hardware sits downstream of this answer, so it stays exhaustively
// unit-testable.

export type Comparator = "lt" | "lte" | "gt" | "gte" | "eq" | "neq";
export type Combinator = "AND" | "OR";

export interface ClauseInput {
  devId: string;
  variable: string;
  comparator: Comparator;
  threshold: number;
}

// Keyed by valueKey(devId, variable). Values are whatever Bucket stored
// (Mixed) — coercion happens here, once.
export type LatestValues = Map<string, unknown>;

export function valueKey(devId: string, variable: string): string {
  return `${devId}:${variable}`;
}

// Bucket.value is schemaless; sensors report numbers, but a decoder can just
// as easily emit "12.5" or true. Anything that isn't a finite number after
// coercion makes the clause false rather than blowing up the evaluation.
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

export function compare(comparator: Comparator, value: number, threshold: number): boolean {
  switch (comparator) {
    case "lt":  return value < threshold;
    case "lte": return value <= threshold;
    case "gt":  return value > threshold;
    case "gte": return value >= threshold;
    case "eq":  return value === threshold;
    case "neq": return value !== threshold;
    default:    return false; // unknown comparator can't reach the DB (enum), but never throw
  }
}

// Missing variable → false (§4). Never reported means "unknown", and an unknown
// value must not satisfy a condition that actuates hardware.
export function evaluateClause(clause: ClauseInput, latest: LatestValues): boolean {
  const key = valueKey(clause.devId, clause.variable);
  if (!latest.has(key)) return false;

  const value = toNumber(latest.get(key));
  if (!Number.isFinite(value)) return false;

  return compare(clause.comparator, value, clause.threshold);
}

// A rule with no clauses can't be created through the API (min 1), but if one
// ever appears it must not fire on every uplink — so empty → false, not
// vacuous truth.
export function evaluate(
  combinator: Combinator,
  clauses: ClauseInput[],
  latest: LatestValues
): boolean {
  if (clauses.length === 0) return false;

  return combinator === "AND"
    ? clauses.every((clause) => evaluateClause(clause, latest))
    : clauses.some((clause) => evaluateClause(clause, latest));
}
