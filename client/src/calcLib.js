// Per-category rates for calculating effective price from base price.
//
// rates = { food: { sc, tax, scTax }, alcohol: { sc, tax, scTax } } — all percentages.
//   sc    — service charge on base
//   tax   — tax on base (GST, VAT, ...)
//   scTax — tax on the service charge amount
//
// effective = base + base×sc + base×tax + (base×sc)×scTax
//
// An item with `effectiveOverride` (paise) skips the rates entirely — for odd
// cases like cess on one drink.

export const CATEGORIES = ['food', 'alcohol'];

export const RATE_FIELDS = [
  { key: 'sc', label: 'SC %' },
  { key: 'tax', label: 'Tax %' },
  { key: 'scTax', label: 'Tax on SC %' },
];

export const DEFAULT_RATES = {
  food: { sc: 0, tax: 5, scTax: 0 },
  alcohol: { sc: 0, tax: 0, scTax: 0 },
};

// Presets fill the rate grid from a headline SC % and tax % (taken from the
// current food rates). The grid stays editable afterwards.
export const RATE_PRESETS = [
  {
    id: 'indian-gst',
    label: 'Indian GST',
    description: 'Food: GST on base + SC. Alcohol: price includes tax, GST only on SC.',
    build: (sc, tax) => ({
      food: { sc, tax, scTax: tax },
      alcohol: { sc, tax: 0, scTax: tax },
    }),
  },
  {
    id: 'alcohol-vat',
    label: 'GST + alcohol VAT',
    description: 'Food: GST. Alcohol: VAT added on top of base (e.g. Goa 22%).',
    build: (sc, tax, current) => ({
      food: { sc, tax, scTax: tax },
      alcohol: { sc, tax: current?.alcohol?.tax || 22, scTax: tax },
    }),
  },
  {
    id: 'flat',
    label: 'Flat',
    description: 'Same tax and SC on base for everything. No tax on SC.',
    build: (sc, tax) => ({
      food: { sc, tax, scTax: 0 },
      alcohol: { sc, tax, scTax: 0 },
    }),
  },
  {
    id: 'compound',
    label: 'Compound',
    description: 'Same rates for everything, tax also on SC: (CP + SC) × (1 + Tax%).',
    build: (sc, tax) => ({
      food: { sc, tax, scTax: tax },
      alcohol: { sc, tax, scTax: tax },
    }),
  },
];

export function applyPreset(presetId, rates) {
  const preset = RATE_PRESETS.find((p) => p.id === presetId);
  const food = (rates && rates.food) || DEFAULT_RATES.food;
  const built = preset.build(food.sc, food.tax, rates);
  // Tax on SC is meaningless without SC — zero it so presets match parsed rates
  for (const cat of CATEGORIES) {
    if (!built[cat].sc) built[cat].scTax = 0;
  }
  return built;
}

// Convert the old { tax, serviceCharge, formulaMode } shape (older exported JSON)
export function legacyToRates(tax = 0, serviceCharge = 0, formulaMode = 'indian-gst') {
  switch (formulaMode) {
    case 'flat':
      return RATE_PRESETS.find((p) => p.id === 'flat').build(serviceCharge, tax);
    case 'sc-then-tax':
    case 'tax-then-sc': // (1 + sc)(1 + tax) — same effective price either way
      return RATE_PRESETS.find((p) => p.id === 'compound').build(serviceCharge, tax);
    case 'indian-gst':
    default:
      return RATE_PRESETS.find((p) => p.id === 'indian-gst').build(serviceCharge, tax);
  }
}

export function ratesFor(rates, category) {
  return (rates && rates[category]) || DEFAULT_RATES[category] || DEFAULT_RATES.food;
}

export function hasOverride(item) {
  return item.effectiveOverride != null;
}

export function calcItemBreakdown(item, rates) {
  const base = item.unitPrice * item.qty;

  if (hasOverride(item)) {
    return { base, scAmount: null, taxAmount: null, effective: item.effectiveOverride, overridden: true };
  }

  const r = ratesFor(rates, item.category);
  const scAmount = base * (r.sc / 100);
  const taxAmount = base * (r.tax / 100) + scAmount * (r.scTax / 100);

  return { base, scAmount, taxAmount, effective: base + scAmount + taxAmount, overridden: false };
}

export function calcEffective(item, rates) {
  return calcItemBreakdown(item, rates).effective;
}

export function calcTotal(items, rates) {
  return items.reduce((sum, item) => sum + calcEffective(item, rates), 0);
}

// Short label like "Food 5% · Alcohol 22%" (SC shown only when present)
export function describeRates(rates) {
  return CATEGORIES.map((cat) => {
    const r = ratesFor(rates, cat);
    const parts = [`tax ${r.tax}%`];
    if (r.sc) parts.push(`SC ${r.sc}%`);
    if (r.sc && r.scTax) parts.push(`tax on SC ${r.scTax}%`);
    return `${cat[0].toUpperCase()}${cat.slice(1)}: ${parts.join(', ')}`;
  }).join(' · ');
}
