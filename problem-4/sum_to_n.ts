/**
 * Problem 4: Three ways to sum to n (TypeScript)
 * ----------------------------------------------
 * sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15
 *
 * The task says `n` is "any integer", so every implementation handles n <= 0
 * consistently instead of looping forever or returning garbage:
 *   - sum_to_n(0)  === 0
 *   - sum_to_n(-5) === (-1) + (-2) + ... + (-5) === -15
 * i.e. the function is odd: sum_to_n(-n) === -sum_to_n(n).
 */

/**
 * A) Closed-form arithmetic series (Gauss formula).
 *
 * Complexity: O(1) time, O(1) space.
 *
 * The production choice — constant time regardless of n. The intermediate
 * product m * (m + 1) is exactly 2x the final result, so as long as the
 * result fits in Number.MAX_SAFE_INTEGER (guaranteed by the task), the
 * intermediate stays inside the 2^53 exact-integer range too.
 */
function sum_to_n_a(n: number): number {
  const sign = n < 0 ? -1 : 1;
  const m = Math.abs(n);
  return (sign * (m * (m + 1))) / 2;
}

/**
 * B) Iterative accumulation.
 *
 * Complexity: O(n) time, O(1) space.
 *
 * The literal translation of "summation to n". Slower, but trivially correct
 * by inspection — which makes it the perfect oracle to test the clever
 * versions against (see sum_to_n.test.ts).
 */
function sum_to_n_b(n: number): number {
  const sign = n < 0 ? -1 : 1;
  const m = Math.abs(n);
  let sum = 0;
  for (let i = 1; i <= m; i++) {
    sum += i;
  }
  return sign * sum;
}

/**
 * C) Divide-and-conquer recursion.
 *
 * Complexity: O(n) additions in total, O(log n) call-stack depth.
 *
 * The naive recursion `n + f(n - 1)` is O(n) stack depth and overflows the
 * call stack around n ≈ 10^4 in most engines. Splitting the range [lo, hi]
 * in half instead keeps the depth logarithmic, so this handles any n whose
 * sum fits in a safe integer — while remaining a genuinely recursive,
 * formula-free implementation.
 */
function sum_to_n_c(n: number): number {
  const sign = n < 0 ? -1 : 1;
  const m = Math.abs(n);

  const rangeSum = (lo: number, hi: number): number => {
    if (lo > hi) return 0;
    if (lo === hi) return lo;
    const mid = (lo + hi) >>> 1;
    return rangeSum(lo, mid) + rangeSum(mid + 1, hi);
  };

  return sign * rangeSum(1, m);
}

export { sum_to_n_a, sum_to_n_b, sum_to_n_c };
