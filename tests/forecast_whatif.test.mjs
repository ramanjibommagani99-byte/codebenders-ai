import { test } from "node:test";
import assert from "node:assert/strict";
import { forecast, averageDaysLateByStudent, delayParent, removeStudents } from "../lib/forecast.js";
import { amountOwed } from "../lib/status.js";
import { invoices } from "../data/invoices.js";
import { payments } from "../data/payments.js";
import { students } from "../data/students.js";
import { billList } from "../data/bills.js";
import { settings } from "../data/settings.js";

test("delayParent raises that student's average by exactly 10 days", () => {
  const id = students[0].id;
  const before = averageDaysLateByStudent(invoices, payments);
  const after = delayParent(before, id, 10);
  assert.equal(after[id] - (before[id] ?? 0), 10);
  assert.equal((before[id] ?? 0) + 10, after[id]);
});

test("removeStudents with count 1 removes exactly that student's unpaid invoices", () => {
  const first = students.map((s) => s.id).sort()[0];
  const kept = removeStudents(invoices, students, 1, payments);
  const unpaidOfFirst = invoices.filter((inv) => inv.studentId === first && amountOwed(inv, payments) > 0);
  assert.equal(kept.length, invoices.length - unpaidOfFirst.length);
  assert.ok(!kept.some((inv) => inv.studentId === first && amountOwed(inv, payments) > 0));
  const othersBefore = invoices.filter((inv) => inv.studentId !== first);
  const othersAfter = kept.filter((inv) => inv.studentId !== first);
  assert.equal(othersAfter.length, othersBefore.length);
});

test("a 10-day parent delay does not raise the lowest balance over 90 days", () => {
  const base = {
    openingBalance: settings.openingBalance,
    today: settings.today,
    payments,
    bills: billList,
    invoices,
    horizonDays: 90,
  };
  const avgLate = averageDaysLateByStudent(invoices, payments);
  const normal = forecast({ ...base, parentAvgDaysLate: avgLate });
  const delayed = forecast({
    ...base,
    parentAvgDaysLate: delayParent(avgLate, students[0].id, 10),
  });
  assert.ok(delayed.lowest.balance <= normal.lowest.balance);
});
