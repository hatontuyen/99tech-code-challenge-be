# Problem 4 — Three ways to sum to n (TypeScript)

## Files

- [`sum_to_n.ts`](./sum_to_n.ts) — the three implementations, each with a complexity comment
- [`sum_to_n.test.ts`](./sum_to_n.test.ts) — zero-dependency test suite

## The three implementations

| | Approach | Time | Space | Notes |
|---|---|---|---|---|
| `sum_to_n_a` | Gauss closed-form `n(n+1)/2` | **O(1)** | O(1) | The production choice. Intermediate `n(n+1)` is exactly 2× the result, so it stays within safe-integer range whenever the result does. |
| `sum_to_n_b` | Iterative loop | O(n) | O(1) | Trivially correct by inspection → used as the oracle to validate the other two. |
| `sum_to_n_c` | Divide-and-conquer recursion | O(n) additions | **O(log n) stack** | Naive `n + f(n-1)` recursion blows the call stack at n ≈ 10⁴; halving the range keeps depth logarithmic, so it works for any valid input. |

## Assumptions (declared per the challenge instructions)

The spec doesn't define behavior for `n <= 0` while stating the input is *any* integer. I chose the least surprising extension — summation *from the origin toward n* (so `sum_to_n(-5) === -15`) — and made all three implementations consistent with it. In a real ticket I'd confirm this with the spec author first.

## Design decisions

- **"Any integer" handled literally**: `sum_to_n(0) === 0`, `sum_to_n(-5) === -15`, and the odd-function property `f(-n) === -f(n)` holds for all three.
- **Implementations verify each other**: fixed edge cases plus 500 randomized cross-checks.

## Run

```bash
npx tsx sum_to_n.test.ts
# PASS all 9 fixed cases + 500 randomized property checks (x3 implementations)
```
