function parseDate(e) {
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(e || ""));
  if (!t) return null;
  const n = new Date(Number(t[1]), Number(t[2]) - 1, Number(t[3]));
  return Number.isNaN(n.getTime()) ? null : n;
}

function startOfDay(e = new Date()) {
  return new Date(e.getFullYear(), e.getMonth(), e.getDate());
}

function formatDate(e) {
  const t = (n) => String(n).padStart(2, "0");
  return `${e.getFullYear()}-${t(e.getMonth() + 1)}-${t(e.getDate())}`;
}

function calculateDDay(e, t = new Date()) {
  const n = parseDate(e);
  return n ? Math.round((n.getTime() - startOfDay(t).getTime()) / 864e5) : null;
}

function formatDDay(e) {
  return e == null ? "상시" : e < 0 ? "마감" : e === 0 ? "D-Day" : `D-${e}`;
}

export { parseDate, startOfDay, formatDate, calculateDDay, formatDDay };
