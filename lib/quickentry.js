// Quick entry: plain-rule parsing of sentences like "Aarav paid 1000 UPI yesterday". No AI, no network.
// Dates are ISO "YYYY-MM-DD" strings; arithmetic uses Date.UTC so time zones cannot shift the day.
import { amountOwed } from "./status.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WRITTEN_YEAR = 2026;
const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function formatIso(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// True when y/m/d (month 0-based) is a real calendar date, e.g. rejects 31 Nov.
function isRealDate(y, m, d) {
  const x = new Date(Date.UTC(y, m, d));
  return x.getUTCFullYear() === y && x.getUTCMonth() === m && x.getUTCDate() === d;
}

// Student: a full name at the start of the text wins; otherwise the first word must match a first name.
function findStudent(text, students) {
  const lower = text.trim().toLowerCase();
  const byFullName = students.filter((s) => {
    const name = s.name.toLowerCase();
    return lower.startsWith(name) && !/[a-z]/.test(lower.charAt(name.length));
  });
  const matches =
    byFullName.length > 0
      ? byFullName
      : students.filter((s) => {
          const word = (text.trim().match(/^[A-Za-z]+/) ?? [""])[0].toLowerCase();
          return word !== "" && s.name.split(" ")[0].toLowerCase() === word;
        });
  if (matches.length === 0) return { error: "notFound" };
  if (matches.length > 1) return { error: "ambiguous", options: matches.map((s) => s.name) };
  return { student: matches[0] };
}

// Date: ISO date, or "21 Nov" / "21 November" in 2026, or "yesterday"; otherwise today.
// Returns the date plus the text with the date words removed, so the amount is not read from them.
function findDate(text, today) {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    if (!isRealDate(y, m, d)) return { error: "badDate" };
    return { date: iso[0], rest: text.replace(iso[0], " ") };
  }
  const written = text.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
  if (written) {
    const day = Number(written[1]);
    const month = MONTH_ABBR.indexOf(written[2].toLowerCase());
    if (!isRealDate(WRITTEN_YEAR, month, day)) return { error: "badDate" };
    return { date: formatIso(Date.UTC(WRITTEN_YEAR, month, day)), rest: text.replace(written[0], " ") };
  }
  if (/\byesterday\b/i.test(text)) {
    const [y, m, d] = today.split("-").map(Number);
    return { date: formatIso(Date.UTC(y, m - 1, d) - DAY_MS), rest: text };
  }
  return { date: today, rest: text };
}

// Amount: the first number in rupees, commas allowed.
function findAmount(text) {
  const match = text.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0].replace(/,/g, ""));
  return amount > 0 ? amount : null;
}

// Method: "UPI" if the word upi appears, "cash" if cash appears, otherwise null.
function findMethod(text) {
  if (/\bupi\b/i.test(text)) return "UPI";
  if (/\bcash\b/i.test(text)) return "cash";
  return null;
}

export function parseQuickEntry(text, students, invoices, payments, today) {
  const input = String(text ?? "");
  const found = findStudent(input, students);
  if (found.error) return found;
  const student = found.student;

  const dated = findDate(input, today);
  if (dated.error) return dated;

  const amount = findAmount(dated.rest);
  if (amount === null) return { error: "noAmount" };

  const method = findMethod(input);
  if (method === null) return { error: "noMethod" };

  // Oldest unpaid invoice first: earliest due date among invoices still owing money.
  const open = invoices
    .filter((inv) => inv.studentId === student.id && amountOwed(inv, payments) > 0)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  if (open.length === 0) return { error: "noInvoice" };

  return {
    ok: true,
    studentId: student.id,
    studentName: student.name,
    amount,
    method,
    date: dated.date,
    invoiceId: open[0].id,
  };
}
