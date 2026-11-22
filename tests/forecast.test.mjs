import { test } from "node:test";
import assert from "node:assert/strict";
import { forecast } from "../lib/forecast.js";

const bills = [
  { name: "Rent", amount: 8000, dueDate: "2026-12-01", monthly: false },
  { name: "Internet", amount: 700, dueDate: "2026-12-03", monthly: false },
];

const horizonDays = 30;

test("lowest balance is 2300 on 2026-12-03 when the 4000 payment lands on 11-25", () => {
  const payments = [
    { amount: 4000, date: "2026-11-25" },
    { amount: 3000, date: "2026-11-28" },
    { amount: 3500, date: "2026-12-05" },
  ];
  const result = forecast({
    openingBalance: 4000,
    today: "2026-11-22",
    payments,
    bills,
    invoices: [],
    horizonDays,
  });
  assert.deepEqual(result.lowest, { date: "2026-12-03", balance: 2300 });
  assert.equal(result.firstNegative, null);
});

test("lowest balance is -1700 on 2026-12-03 when the 4000 payment lands on 12-10", () => {
  const payments = [
    { amount: 4000, date: "2026-12-10" },
    { amount: 3000, date: "2026-11-28" },
    { amount: 3500, date: "2026-12-05" },
  ];
  const result = forecast({
    openingBalance: 4000,
    today: "2026-11-22",
    payments,
    bills,
    invoices: [],
    horizonDays,
  });
  assert.deepEqual(result.lowest, { date: "2026-12-03", balance: -1700 });
  // 4000 + 3000 - 8000 = -1000 on 2026-12-01, so the first negative day is 12-01, not 12-03.
  assert.deepEqual(result.daily.find((d) => d.date === "2026-12-01"), { date: "2026-12-01", balance: -1000 });
  assert.equal(result.firstNegative, "2026-12-01");
});
