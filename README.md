# Tutor Desk

Tutor Desk is a mobile-first web back-office app for a solo home tutor.

## The problem

A home tutor tracks fees, late payments and upcoming bills in notebooks or chat. This app puts them in one place on a phone.

## The user

A solo home tutor in India who collects monthly fees from parents.

## What each screen does

- **Dashboard**: total outstanding in large rupee figures, and overdue invoices grouped by days late.
- **Students**: roster with parent name, phone, monthly fee and due day.
- **Invoices**: monthly invoices with status Paid, Partly paid, Overdue or Sent. Record payments and create invoices here.
- **Bills**: rent, internet and other bills, monthly or one-off, with an add form.
- **Forecast**: 30/60/90-day cash balance chart, with what-if scenarios for late payers or students leaving.
- **Alerts**: overdue reminders sent via WhatsApp click-to-chat, cash going below zero within 90 days, bills due in 3 days, and a reminder log.

## How to try the demo

1. Open a terminal in the project folder and run `python -m http.server 8081`.
2. Go to http://localhost:8081/.
3. Tap through the six tabs along the bottom.
4. After making changes, tap **Reset demo** to restore the sample data.

## Sample data

All data is invented sample data, including names, amounts and phone numbers (90000 00001 onward). Nothing is sent to real people unless you use a real WhatsApp link.

## Built with Codebenders

This project was built with Codebenders. It uses plain HTML, CSS and ES modules with no build step.
