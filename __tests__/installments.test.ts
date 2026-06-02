import { describe, it, expect } from "vitest";
import { installmentStatus } from "@/lib/core/installments";

describe("installmentStatus (compute-on-read, pure)", () => {
  const asOf = "2026-06-15";

  it("returns upcoming when due date is after asOf and not paid", () => {
    expect(
      installmentStatus(
        { status: "upcoming", due_date: "2026-07-01", paid_date: null },
        asOf,
      ),
    ).toBe("upcoming");
  });

  it("returns overdue when due date is before asOf and not paid", () => {
    expect(
      installmentStatus(
        { status: "upcoming", due_date: "2026-06-01", paid_date: null },
        asOf,
      ),
    ).toBe("overdue");
  });

  it("returns paid when stored status is 'paid', even if due date is past", () => {
    expect(
      installmentStatus(
        { status: "paid", due_date: "2026-06-01", paid_date: "2026-06-01" },
        asOf,
      ),
    ).toBe("paid");
  });

  it("returns paid when paid_date is set, even if stored status is 'upcoming'", () => {
    expect(
      installmentStatus(
        { status: "upcoming", due_date: "2026-06-01", paid_date: "2026-06-01" },
        asOf,
      ),
    ).toBe("paid");
  });

  it("returns upcoming when due date equals asOf (not overdue)", () => {
    expect(
      installmentStatus(
        { status: "upcoming", due_date: "2026-06-15", paid_date: null },
        asOf,
      ),
    ).toBe("upcoming");
  });

  it("returns overdue when status is 'overdue' in DB and not paid (explicit)", () => {
    expect(
      installmentStatus(
        { status: "overdue", due_date: "2026-06-01", paid_date: null },
        asOf,
      ),
    ).toBe("overdue");
  });

  it("returns upcoming for a future installment even with explicit 'overdue' status", () => {
    // Future date + not paid → computed as upcoming regardless of stored status
    // Actually: the stored status is irrelevant if not paid — the function
    // checks due_date < asOf. So for a future date, it returns upcoming.
    expect(
      installmentStatus(
        { status: "overdue", due_date: "2026-07-01", paid_date: null },
        asOf,
      ),
    ).toBe("upcoming");
  });

  it("DD/MM regression: DUE 07/03/2026 (7 March), ASOF 2026-06-15 → overdue, NOT 3 July", () => {
    // 2026-03-07 is before 2026-06-15 → overdue
    expect(
      installmentStatus(
        { status: "upcoming", due_date: "2026-03-07", paid_date: null },
        asOf,
      ),
    ).toBe("overdue");
  });

  it("paid always wins when both status=paid and paid_date set", () => {
    expect(
      installmentStatus(
        {
          status: "paid",
          due_date: "2026-01-01",
          paid_date: "2026-01-01",
        },
        asOf,
      ),
    ).toBe("paid");
  });
});
