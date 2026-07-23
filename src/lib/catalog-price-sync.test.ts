import { describe, it, expect } from "vitest"
import { decidePodCostUpdate } from "./catalog-price-sync"

describe("decidePodCostUpdate", () => {
  it("should update when the fetched price differs within the guardrail", () => {
    // +10% change
    expect(decidePodCostUpdate(1000, 1100)).toEqual({ action: "update", newPodCostCents: 1100 })
    // -10% change
    expect(decidePodCostUpdate(1000, 900)).toEqual({ action: "update", newPodCostCents: 900 })
  })

  it("should report unchanged when prices match", () => {
    expect(decidePodCostUpdate(1225, 1225)).toEqual({ action: "unchanged" })
  })

  it("should skip changes beyond the ±25% guardrail", () => {
    expect(decidePodCostUpdate(1000, 1300).action).toBe("skipped")
    expect(decidePodCostUpdate(1000, 700).action).toBe("skipped")
  })

  it("should allow a change of exactly 25%", () => {
    expect(decidePodCostUpdate(1000, 1250)).toEqual({ action: "update", newPodCostCents: 1250 })
  })

  it("should skip invalid fetched prices", () => {
    expect(decidePodCostUpdate(1000, null).action).toBe("skipped")
    expect(decidePodCostUpdate(1000, 0).action).toBe("skipped")
    expect(decidePodCostUpdate(1000, -50).action).toBe("skipped")
    expect(decidePodCostUpdate(1000, NaN).action).toBe("skipped")
  })

  it("should skip when the stored price is invalid", () => {
    expect(decidePodCostUpdate(0, 1100).action).toBe("skipped")
  })
})
