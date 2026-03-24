import React, { useState, useMemo } from 'react';
import styles from './Split.module.css';
import { calcItemBreakdown } from '../calcLib';

function formatPrice(paise) {
  return (paise / 100).toFixed(2);
}

function computeSplit(items, assignments, people, tax, serviceCharge, formulaMode) {
  const itemsById = {};
  for (const item of items) itemsById[item.id] = item;

  // Build per-person breakdown
  const personData = {};
  for (const p of people) {
    personData[p.name] = { items: [], total: 0 };
  }

  for (const item of items) {
    const bd = calcItemBreakdown(item, tax, serviceCharge, formulaMode);
    const itemParts = assignments[item.id] || {};
    const totalParts = Object.values(itemParts).reduce((s, v) => s + v, 0);
    if (totalParts === 0) continue;

    for (const p of people) {
      const pp = itemParts[p.name] || 0;
      if (pp <= 0) continue;
      const fraction = pp / totalParts;
      const amount = bd.effective * fraction;
      personData[p.name].items.push({
        itemId: item.id,
        name: item.name,
        category: item.category,
        qty: item.qty,
        effective: bd.effective,
        parts: pp,
        totalParts,
        fraction,
        amount,
      });
      personData[p.name].total += amount;
    }
  }

  return personData;
}

export default function Split({ reviewData, people, assignments, initialDiscount, onConfirm }) {
  const { items, tax, serviceCharge, establishment, billTotal, formulaMode } = reviewData;
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [discountPct, setDiscountPct] = useState(
    initialDiscount?.pct || ''
  );
  const [discountRupees, setDiscountRupees] = useState(
    initialDiscount?.discount || ''
  );
  const [finalAmountRupees, setFinalAmountRupees] = useState(
    initialDiscount?.finalAmount || ''
  );
  const [locked, setLocked] = useState(
    initialDiscount?.field || null
  );

  const split = useMemo(
    () => computeSplit(items, assignments, people, tax, serviceCharge, formulaMode),
    [items, assignments, people, tax, serviceCharge, formulaMode]
  );

  const preTotalPaise = useMemo(
    () => Object.values(split).reduce((s, d) => s + d.total, 0),
    [split]
  );

  const preTotalRupees = preTotalPaise / 100;

  const discountPaise = useMemo(() => {
    if (!locked) return 0;
    if (locked === 'pct') {
      const v = Number(discountPct);
      if (!v || v <= 0 || v > 100) return 0;
      return Math.round(preTotalPaise * v / 100);
    }
    if (locked === 'final') {
      const v = Number(finalAmountRupees);
      if (!v || v <= 0) return 0;
      const paid = Math.round(v * 100);
      const disc = preTotalPaise - paid;
      return disc > 0 ? disc : 0;
    }
    const v = Number(discountRupees);
    if (!v || v <= 0) return 0;
    const raw = Math.round(v * 100);
    return raw <= preTotalPaise ? raw : preTotalPaise;
  }, [locked, discountPct, discountRupees, finalAmountRupees, preTotalPaise]);

  const splitWithDiscount = useMemo(() => {
    const names = Object.keys(split);
    if (discountPaise === 0 || preTotalPaise === 0) {
      const result = {};
      for (const name of names) {
        result[name] = { ...split[name], discountAmount: 0, adjustedTotal: split[name].total };
      }
      return result;
    }
    // Largest-remainder method for exact paise allocation
    const exact = names.map((name) => (split[name].total / preTotalPaise) * discountPaise);
    const floored = exact.map(Math.floor);
    let residual = discountPaise - floored.reduce((s, v) => s + v, 0);
    const fractions = exact
      .map((v, i) => ({ i, frac: v - floored[i] }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < residual; k++) {
      floored[fractions[k].i] += 1;
    }
    const result = {};
    names.forEach((name, i) => {
      const data = split[name];
      result[name] = { ...data, discountAmount: floored[i], adjustedTotal: data.total - floored[i] };
    });
    return result;
  }, [split, discountPaise, preTotalPaise]);

  const grandTotal = useMemo(
    () => Object.values(splitWithDiscount).reduce((s, d) => s + d.adjustedTotal, 0),
    [splitWithDiscount]
  );

  const billTotalNum = billTotal || 0;
  const roundingDiff = billTotalNum > 0 ? Math.abs(preTotalPaise - billTotalNum) : 0;

  // Sort people by adjustedTotal descending
  const sorted = [...people].sort(
    (a, b) => splitWithDiscount[b.name].adjustedTotal - splitWithDiscount[a.name].adjustedTotal
  );

  const toggleExpand = (name) => {
    setExpandedPerson((prev) => (prev === name ? null : name));
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Split Summary</h2>

      {establishment && (
        <div className={styles.establishment}>{establishment}</div>
      )}

      <div className={styles.overviewBar}>
        <div className={styles.overviewItem}>
          <span className={styles.overviewLabel}>Items</span>
          <span className={styles.overviewValue}>{items.length}</span>
        </div>
        <div className={styles.overviewItem}>
          <span className={styles.overviewLabel}>People</span>
          <span className={styles.overviewValue}>{people.length}</span>
        </div>
        <div className={styles.overviewItem}>
          <span className={styles.overviewLabel}>Tax</span>
          <span className={styles.overviewValue}>{tax}%</span>
        </div>
        <div className={styles.overviewItem}>
          <span className={styles.overviewLabel}>SC</span>
          <span className={styles.overviewValue}>{serviceCharge}%</span>
        </div>
        {discountPaise > 0 ? (
          <>
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Subtotal</span>
              <span className={styles.overviewValue}>{formatPrice(preTotalPaise)}</span>
            </div>
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>
                {locked === 'pct' ? `Discount (${discountPct}%)` : 'Discount'}
              </span>
              <span className={`${styles.overviewValue} ${styles.discountValue}`}>
                -{formatPrice(discountPaise)}
              </span>
            </div>
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Total</span>
              <span className={`${styles.overviewValue} ${styles.finalValue}`}>
                {formatPrice(grandTotal)}
              </span>
            </div>
          </>
        ) : (
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Total</span>
            <span className={styles.overviewValue}>{formatPrice(grandTotal)}</span>
          </div>
        )}
      </div>

      {billTotalNum > 0 && roundingDiff > 100 && (
        <div className={styles.mismatchNote}>
          Calculated total ({formatPrice(preTotalPaise)}) differs from bill total ({formatPrice(billTotalNum)}) by {formatPrice(roundingDiff)}
        </div>
      )}

      <div className={styles.discountSection}>
        <div className={styles.discountField}>
          <label htmlFor="discountPctInput" className={styles.discountLabel}>Discount %</label>
          <input
            id="discountPctInput"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={locked && locked !== 'pct' ? (discountPaise > 0 ? (discountPaise / preTotalPaise * 100).toFixed(1) : '') : discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            placeholder="0"
            className={`${styles.discountInput} ${locked === 'pct' ? styles.discountInputActive : ''}`}
            disabled={locked && locked !== 'pct'}
          />
        </div>
        <span className={styles.discountOr}>or</span>
        <div className={styles.discountField}>
          <label htmlFor="discountInput" className={styles.discountLabel}>Flat Discount (₹)</label>
          <input
            id="discountInput"
            type="number"
            min="0"
            step="0.01"
            value={locked && locked !== 'discount' ? (discountPaise > 0 ? (discountPaise / 100).toFixed(2) : '') : discountRupees}
            onChange={(e) => setDiscountRupees(e.target.value)}
            placeholder="0"
            className={`${styles.discountInput} ${locked === 'discount' ? styles.discountInputActive : ''}`}
            disabled={locked && locked !== 'discount'}
          />
        </div>
        <span className={styles.discountOr}>or</span>
        <div className={styles.discountField}>
          <label htmlFor="finalAmountInput" className={styles.discountLabel}>Final Amount (₹)</label>
          <input
            id="finalAmountInput"
            type="number"
            min="0"
            step="0.01"
            value={locked && locked !== 'final' ? (discountPaise > 0 ? ((preTotalPaise - discountPaise) / 100).toFixed(2) : '') : finalAmountRupees}
            onChange={(e) => setFinalAmountRupees(e.target.value)}
            placeholder={preTotalRupees.toFixed(2)}
            className={`${styles.discountInput} ${locked === 'final' ? styles.discountInputActive : ''}`}
            disabled={locked && locked !== 'final'}
          />
        </div>
        {!locked && (
          <button
            className={styles.discountApply}
            onClick={() => {
              if (Number(discountPct) > 0) {
                setLocked('pct');
                setDiscountRupees('');
                setFinalAmountRupees('');
              } else if (Number(discountRupees) > 0) {
                setLocked('discount');
                setDiscountPct('');
                setFinalAmountRupees('');
              } else if (Number(finalAmountRupees) > 0) {
                setLocked('final');
                setDiscountPct('');
                setDiscountRupees('');
              }
            }}
            disabled={!Number(discountPct) && !Number(discountRupees) && !Number(finalAmountRupees)}
          >
            Apply
          </button>
        )}
        {locked && (
          <button
            className={styles.discountClear}
            onClick={() => {
              setLocked(null);
              setDiscountPct('');
              setDiscountRupees('');
              setFinalAmountRupees('');
            }}
          >
            Clear
          </button>
        )}
        {discountPaise > 0 && (
          <span className={styles.discountHint}>split proportionally by share</span>
        )}
      </div>

      <div className={styles.cards}>
        {sorted.map((p) => {
          const data = splitWithDiscount[p.name];
          const isExpanded = expandedPerson === p.name;
          const pct = grandTotal > 0 ? ((data.adjustedTotal / grandTotal) * 100).toFixed(0) : 0;

          return (
            <div key={p.name} className={styles.card}>
              <button
                className={styles.cardHeader}
                onClick={() => toggleExpand(p.name)}
              >
                <div className={styles.cardLeft}>
                  <span className={styles.personName}>{p.name}</span>
                  <span className={styles.itemCount}>
                    {data.items.length} item{data.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className={styles.cardRight}>
                  {discountPaise > 0 && (
                    <span className={styles.originalTotal}>{formatPrice(data.total)}</span>
                  )}
                  <span className={styles.personTotal}>{formatPrice(data.adjustedTotal)}</span>
                  <span className={styles.personPct}>{pct}%</span>
                </div>
                <span className={styles.expandIcon}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
              </button>

              <div className={styles.shareBar}>
                <div
                  className={styles.shareFill}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {isExpanded && (
                <div className={styles.breakdown}>
                  <table className={styles.breakdownTable}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Effective</th>
                        <th>Share</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((entry) => (
                        <tr key={entry.itemId}>
                          <td className={styles.bdItemName}>
                            {entry.name}
                            {entry.qty > 1 && <span className={styles.bdQty}> x{entry.qty}</span>}
                          </td>
                          <td className={`${styles.bdType} ${entry.category === 'alcohol' ? styles.bdAlcohol : ''}`}>
                            {entry.category}
                          </td>
                          <td className={styles.bdPrice}>{formatPrice(entry.effective)}</td>
                          <td className={styles.bdShare}>
                            {entry.parts === entry.totalParts
                              ? 'all'
                              : `${entry.parts}/${entry.totalParts}`}
                          </td>
                          <td className={styles.bdAmount}>{formatPrice(entry.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {discountPaise > 0 && (
                        <>
                          <tr>
                            <td colSpan={4} className={styles.bdDiscountLabel}>Subtotal</td>
                            <td className={styles.bdDiscountSubtotal}>{formatPrice(data.total)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className={styles.bdDiscountLabel}>Discount</td>
                            <td className={styles.bdDiscountAmount}>-{formatPrice(data.discountAmount)}</td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td colSpan={4} className={styles.bdTotalLabel}>Total</td>
                        <td className={styles.bdTotalAmount}>{formatPrice(data.adjustedTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onConfirm(splitWithDiscount, locked ? {
          pct: locked === 'pct' ? discountPct : '',
          discount: locked === 'discount' ? discountRupees : '',
          finalAmount: locked === 'final' ? finalAmountRupees : '',
          field: locked,
          discountPaise,
        } : null)}
        className={styles.confirmBtn}
      >
        Confirm & Continue
      </button>
    </div>
  );
}
