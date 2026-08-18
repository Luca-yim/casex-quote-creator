/**
 * Baseline total contract value before adjustments and margin:
 * `oneTimeTotal + monthlyRecurring * 12 * contractYears`.
 */
export function calculateContractTCV(
  oneTimeTotal: number,
  monthlyRecurring: number,
  contractYears: number,
): number {
  return oneTimeTotal + monthlyRecurring * 12 * contractYears;
}
