export const routes = ["dashboard", "students", "invoices", "bills", "forecast", "alerts"];

export const DEFAULT_ROUTE = "dashboard";

export function currentRoute() {
  const name = location.hash.slice(1);
  return routes.includes(name) ? name : DEFAULT_ROUTE;
}

export function onRouteChange(handler) {
  window.addEventListener("hashchange", handler);
}
