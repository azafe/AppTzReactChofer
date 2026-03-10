export function moneyARS(value: number | null | undefined): string {
  if (value == null) return "$ 0";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function dateAR(iso: string | null | undefined): string {
  if (!iso) return "-";
  const clean = iso.length > 10 ? iso.substring(0, 10) : iso;
  const [y, m, d] = clean.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeISODate(value: string): string {
  if (!value) return "";
  return value.length > 10 ? value.substring(0, 10) : value;
}

export function monthLabel(year: number, month: number): string {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${months[month - 1]} ${year}`;
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}
