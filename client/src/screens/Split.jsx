import React, { useState, useMemo } from 'react';
import styles from './Split.module.css';

function formatPrice(paise) {
  return (paise / 100).toFixed(2);
}

function calcItemBreakdown(item, tax, serviceCharge) {
  const base = item.unitPrice * item.qty;
  const sc = serviceCharge / 100;
  const t = tax / 100;
  const scAmount = base * sc;
  if (item.category === 'alcohol') {
    const taxAmount = scAmount * t;
    return { base, scAmount, taxAmount, effective: base + scAmount + taxAmount };
  }
  const taxAmount = (base + scAmount) * t;
  return { base, scAmount, taxAmount, effective: base + scAmount + taxAmount };
}

function computeSplit(items, assignments, people, tax, serviceCharge) {
  const itemsById = {};
  for (const item of items) itemsById[item.id] = item;

  // Build per-person breakdown
  const personData = {};
  for (const p of people) {
    personData[p.name] = { items: [], total: 0 };
  }

  for (const item of items) {
    const bd = calcItemBreakdown(item, tax, serviceCharge);
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

export default function Split({ reviewData, people, assignments, onConfirm }) {
  const { items, tax, serviceCharge, establishment, billTotal } = reviewData;
  const [expandedPerson, setExpandedPerson] = useState(null);

  const split = useMemo(
    () => computeSplit(items, assignments, people, tax, serviceCharge),
    [items, assignments, people, tax, serviceCharge]
  );

  const grandTotal = Object.values(split).reduce((s, d) => s + d.total, 0);
  const billTotalNum = billTotal || 0;
  const roundingDiff = billTotalNum > 0 ? Math.abs(grandTotal - billTotalNum) : 0;

  // Sort people by total descending
  const sorted = [...people].sort((a, b) => split[b.name].total - split[a.name].total);

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
        <div className={styles.overviewItem}>
          <span className={styles.overviewLabel}>Total</span>
          <span className={styles.overviewValue}>{formatPrice(grandTotal)}</span>
        </div>
      </div>

      {billTotalNum > 0 && roundingDiff > 100 && (
        <div className={styles.mismatchNote}>
          Calculated total ({formatPrice(grandTotal)}) differs from bill total ({formatPrice(billTotalNum)}) by {formatPrice(roundingDiff)}
        </div>
      )}

      <div className={styles.cards}>
        {sorted.map((p) => {
          const data = split[p.name];
          const isExpanded = expandedPerson === p.name;
          const pct = grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(0) : 0;

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
                  <span className={styles.personTotal}>{formatPrice(data.total)}</span>
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
                      <tr>
                        <td colSpan={4} className={styles.bdTotalLabel}>Total</td>
                        <td className={styles.bdTotalAmount}>{formatPrice(data.total)}</td>
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
        onClick={() => onConfirm(split)}
        className={styles.confirmBtn}
      >
        Confirm & Continue
      </button>
    </div>
  );
}
