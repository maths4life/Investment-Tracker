// Number and date formatters

const INR_FULL = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const INR_DECIMAL = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Convert paise to INR rupees */
export function toINR(paise: number): number {
  return paise / 100;
}

/** Format paise as full ₹ value: ₹1,25,000 */
export function formatINR(paise: number): string {
  return INR_FULL.format(paise / 100);
}

/** Format paise as compact: ₹12.5 L, ₹1.25 Cr */
export function formatCompact(paise: number): string {
  const rupees = paise / 100;
  if (Math.abs(rupees) >= 10_000_000) {
    return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  }
  if (Math.abs(rupees) >= 100_000) {
    return `₹${(rupees / 100_000).toFixed(1)} L`;
  }
  if (Math.abs(rupees) >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)} K`;
  }
  return `₹${rupees.toFixed(0)}`;
}

/** Format paise as rupees with 2 decimal places */
export function formatINRDecimal(paise: number): string {
  return INR_DECIMAL.format(paise / 100);
}

/** Format a return percentage with sign and ▲/▼ */
export function formatReturn(pct: number | null): string {
  if (pct === null) return '–';
  const abs = Math.abs(pct * 100).toFixed(2);
  if (pct >= 0) return `▲ +${abs}%`;
  return `▼ −${abs}%`;
}

/** Format profit/loss with sign */
export function formatPL(paise: number): string {
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  const sign = rupees >= 0 ? '+' : '−';
  return `${sign}${INR_FULL.format(abs)}`;
}

/** Format an ISO date string as "05 Nov 2026" */
export function formatDate(iso: string): string {
  if (!iso) return '–';
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format as YYYY-MM-DD for input[type=date] */
export function toInputDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Today as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** XIRR as "▲ +12.34%" or "–" */
export function formatXIRR(xirr: number | null): string {
  if (xirr === null) return '–';
  return formatReturn(xirr);
}

/** Return CSS class for positive/negative/zero */
export function plClass(value: number): string {
  if (value > 0) return 'text-positive';
  if (value < 0) return 'text-negative';
  return 'text-muted';
}

/** Return CSS class for a return % */
export function returnClass(pct: number | null): string {
  if (pct === null) return 'text-muted';
  return plClass(pct);
}

/** Category palette — muted, distinguishable */
export const CATEGORY_COLORS: Record<string, string> = {
  'Mutual Funds': '#6B8CAE',   // slate blue
  'Stocks': '#7A9E7E',         // sage
  'Fixed Deposits': '#C9A96E', // sand
  'Gold': '#B5967A',           // dusty rose / tan
  'PPF/EPF': '#7E9E9A',        // grey-teal
  'Crypto': '#A8956E',         // taupe
  'Other': '#9CA3AF',          // neutral grey
};

export function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? '#9CA3AF';
}

