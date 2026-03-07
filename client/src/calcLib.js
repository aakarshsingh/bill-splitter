// Formula modes for calculating effective price from base + tax% + SC%
//
// Each mode defines how tax and service charge combine with the base price.
// Some modes treat food and alcohol differently (e.g., indian-gst).

export const FORMULA_MODES = [
  {
    id: 'indian-gst',
    label: 'Indian GST (default)',
    description: 'Food: tax on (base + SC). Alcohol: tax only on SC.',
    formula: 'Food: (CP + SC) × (1 + Tax%). Alcohol: CP + SC + SC×Tax%',
  },
  {
    id: 'flat',
    label: 'Flat (independent)',
    description: 'Tax and SC both applied independently on base price.',
    formula: 'CP + CP×Tax% + CP×SC%',
  },
  {
    id: 'sc-then-tax',
    label: 'SC first, then Tax',
    description: 'SC on base, then tax on (base + SC). Same for all items.',
    formula: '(CP + CP×SC%) × (1 + Tax%)',
  },
  {
    id: 'tax-then-sc',
    label: 'Tax first, then SC',
    description: 'Tax on base, then SC on (base + tax). Same for all items.',
    formula: '(CP + CP×Tax%) × (1 + SC%)',
  },
];

export function calcItemBreakdown(item, tax, serviceCharge, formulaMode = 'indian-gst') {
  const base = item.unitPrice * item.qty;
  const sc = serviceCharge / 100;
  const t = tax / 100;

  let scAmount, taxAmount;

  switch (formulaMode) {
    case 'flat':
      scAmount = base * sc;
      taxAmount = base * t;
      break;

    case 'sc-then-tax':
      scAmount = base * sc;
      taxAmount = (base + scAmount) * t;
      break;

    case 'tax-then-sc':
      taxAmount = base * t;
      scAmount = (base + taxAmount) * sc;
      break;

    case 'indian-gst':
    default:
      scAmount = base * sc;
      if (item.category === 'alcohol') {
        taxAmount = scAmount * t;
      } else {
        taxAmount = (base + scAmount) * t;
      }
      break;
  }

  return { base, scAmount, taxAmount, effective: base + scAmount + taxAmount };
}

export function calcEffective(item, tax, serviceCharge, formulaMode = 'indian-gst') {
  return calcItemBreakdown(item, tax, serviceCharge, formulaMode).effective;
}

export function calcTotal(items, tax, serviceCharge, formulaMode = 'indian-gst') {
  return items.reduce((sum, item) => sum + calcItemBreakdown(item, tax, serviceCharge, formulaMode).effective, 0);
}
