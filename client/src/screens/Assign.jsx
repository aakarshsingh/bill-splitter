import React, { useState, useEffect } from 'react';
import styles from './Assign.module.css';
import { calcEffective } from '../calcLib';

function formatPrice(paise) {
  return (paise / 100).toFixed(2);
}

// Assignments stored as { itemId: { personName: parts } }
// "parts" is an integer — how many shares this person has of the item.
// The fraction each person pays = parts / totalParts for that item.

function buildEmptyParts(items, people) {
  const map = {};
  for (const item of items) {
    map[item.id] = {};
    for (const p of people) {
      map[item.id][p.name] = 0;
    }
  }
  return map;
}

function partsFromAI(aiResult, items, people) {
  const map = buildEmptyParts(items, people);
  const aiMap = aiResult.assignments || {};
  for (const itemId of Object.keys(aiMap)) {
    if (!map[itemId]) continue;
    const entries = aiMap[itemId];
    for (const entry of entries) {
      if (map[itemId][entry.person] === undefined) continue;
      // Parse share string like "1/3" or "1" into a parts count
      const share = entry.share?.trim();
      if (!share) continue;
      if (share.includes('/')) {
        const [num] = share.split('/').map(Number);
        map[itemId][entry.person] = isNaN(num) ? 0 : num;
      } else {
        const n = parseFloat(share);
        map[itemId][entry.person] = isNaN(n) ? 0 : (n === 1 ? 1 : Math.round(n * 10));
      }
    }
  }
  return map;
}

// Convert parts map to the fraction-based format for passing downstream
function partsToAssignments(partsMap) {
  const result = {};
  for (const itemId of Object.keys(partsMap)) {
    const personParts = partsMap[itemId];
    const total = Object.values(personParts).reduce((s, v) => s + v, 0);
    result[itemId] = [];
    for (const [person, parts] of Object.entries(personParts)) {
      if (parts > 0 && total > 0) {
        result[itemId].push({ person, share: `${parts}/${total}` });
      }
    }
  }
  return result;
}

export default function Assign({
  reviewData,
  people,
  preferences,
  instructions,
  initialAssignments,
  isTestMode,
  testAssignments,
  onConfirm,
}) {
  const { items, tax, serviceCharge, formulaMode } = reviewData;

  const [parts, setParts] = useState(() => {
    if (initialAssignments) return initialAssignments;
    return buildEmptyParts(items, people);
  });
  const [reasoning, setReasoning] = useState('');
  const [loading, setLoading] = useState(!initialAssignments);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialAssignments) return;

    if (isTestMode && testAssignments) {
      setParts(partsFromAI(testAssignments, items, people));
      setReasoning(testAssignments.reasoning || '');
      setLoading(false);
      return;
    }

    const fetchAssignments = async () => {
      try {
        const res = await fetch('/api/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, people, instructions, preferences }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to get assignments');
        }
        const data = await res.json();
        setParts(partsFromAI(data, items, people));
        setReasoning(data.reasoning || '');
      } catch (err) {
        setError(err.message);
        setParts(buildEmptyParts(items, people));
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const increment = (itemId, personName) => {
    setParts((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [personName]: (prev[itemId][personName] || 0) + 1 },
    }));
  };

  const decrement = (itemId, personName) => {
    setParts((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [personName]: Math.max(0, (prev[itemId][personName] || 0) - 1) },
    }));
  };

  const splitEqual = (itemId) => {
    setParts((prev) => {
      const updated = { ...prev[itemId] };
      for (const p of people) updated[p.name] = 1;
      return { ...prev, [itemId]: updated };
    });
  };

  const assignSolo = (itemId, personName) => {
    setParts((prev) => {
      const updated = {};
      for (const p of people) updated[p.name] = p.name === personName ? 1 : 0;
      return { ...prev, [itemId]: updated };
    });
  };

  const clearItem = (itemId) => {
    setParts((prev) => {
      const updated = {};
      for (const p of people) updated[p.name] = 0;
      return { ...prev, [itemId]: updated };
    });
  };

  const splitAllEqual = () => {
    const updated = {};
    for (const item of items) {
      updated[item.id] = {};
      for (const p of people) updated[item.id][p.name] = 1;
    }
    setParts(updated);
  };

  const clearAll = () => {
    setParts(buildEmptyParts(items, people));
  };

  // Validation
  const warnings = [];
  for (const item of items) {
    const itemParts = parts[item.id] || {};
    const total = Object.values(itemParts).reduce((s, v) => s + v, 0);
    if (total === 0) {
      warnings.push(`"${item.name}" has no one assigned`);
    }
  }

  // Per-person totals
  const personTotals = {};
  for (const p of people) personTotals[p.name] = 0;
  for (const item of items) {
    const eff = calcEffective(item, tax, serviceCharge, formulaMode);
    const itemParts = parts[item.id] || {};
    const totalParts = Object.values(itemParts).reduce((s, v) => s + v, 0);
    if (totalParts === 0) continue;
    for (const p of people) {
      const pp = itemParts[p.name] || 0;
      if (pp > 0) personTotals[p.name] += eff * (pp / totalParts);
    }
  }
  const grandTotal = Object.values(personTotals).reduce((s, v) => s + v, 0);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Getting AI assignment suggestions...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Assign Items</h2>

      {error && (
        <div className={styles.error}>
          <p>AI suggestion failed: {error}</p>
          <p className={styles.errorHint}>You can assign items manually below.</p>
        </div>
      )}

      {reasoning && !error && (
        <div className={styles.reasoning}>
          <span className={styles.reasoningLabel}>AI reasoning:</span> {reasoning}
        </div>
      )}

      <div className={styles.bulkActions}>
        <button className={styles.bulkBtn} onClick={splitAllEqual}>
          Split all equally
        </button>
        <button className={styles.bulkBtn} onClick={clearAll}>
          Clear all
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.itemCol}>Item</th>
              <th className={styles.effCol}>Effective</th>
              {people.map((p) => (
                <th key={p.id} className={styles.personCol}>
                  <span className={styles.personName}>{p.name}</span>
                </th>
              ))}
              <th className={styles.actionsCol}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const eff = calcEffective(item, tax, serviceCharge, formulaMode);
              const itemParts = parts[item.id] || {};
              const totalParts = Object.values(itemParts).reduce((s, v) => s + v, 0);
              const assignedCount = Object.values(itemParts).filter((v) => v > 0).length;

              return (
                <tr key={item.id} className={totalParts === 0 ? styles.rowUnassigned : ''}>
                  <td className={styles.itemCell}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={`${styles.itemMeta} ${item.category === 'alcohol' ? styles.alcohol : ''}`}>
                      {item.category} · qty {item.qty}
                    </span>
                  </td>
                  <td className={styles.effCell}>{formatPrice(eff)}</td>
                  {people.map((p) => {
                    const pp = itemParts[p.name] || 0;
                    const isActive = pp > 0;
                    const fraction = isActive && totalParts > 0
                      ? (pp === totalParts ? 'all' : `${pp}/${totalParts}`)
                      : null;
                    const amount = isActive && totalParts > 0
                      ? formatPrice(eff * pp / totalParts)
                      : null;

                    return (
                      <td key={p.id} className={styles.shareCell}>
                        <div className={`${styles.shareBox} ${isActive ? styles.shareActive : ''}`}>
                          <button
                            className={styles.shareBtn}
                            onClick={() => decrement(item.id, p.name)}
                            disabled={pp === 0}
                          >
                            -
                          </button>
                          <button
                            className={styles.shareCount}
                            onClick={() => {
                              if (pp === 0) assignSolo(item.id, p.name);
                              else decrement(item.id, p.name);
                            }}
                            title={pp === 0 ? 'Assign solely' : 'Decrease'}
                          >
                            {pp}
                          </button>
                          <button
                            className={styles.shareBtn}
                            onClick={() => increment(item.id, p.name)}
                          >
                            +
                          </button>
                        </div>
                        {fraction && (
                          <div className={styles.shareFraction}>{fraction}</div>
                        )}
                        {amount && (
                          <div className={styles.shareAmount}>{amount}</div>
                        )}
                      </td>
                    );
                  })}
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.rowBtn}
                      onClick={() => splitEqual(item.id)}
                      title="Split equally"
                    >
                      =
                    </button>
                    <button
                      className={styles.rowBtn}
                      onClick={() => clearItem(item.id)}
                      title="Clear"
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className={styles.totalRow}>
              <td className={styles.totalLabel}>Per-person total</td>
              <td className={styles.effCell}>{formatPrice(grandTotal)}</td>
              {people.map((p) => (
                <td key={p.id} className={styles.personTotal}>
                  {formatPrice(personTotals[p.name])}
                </td>
              ))}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {warnings.length > 0 && (
        <div className={styles.warnings}>
          <span className={styles.warningsLabel}>Warnings:</span>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.shareHelp}>
        <span className={styles.helpLabel}>How it works:</span>{' '}
        Use <strong>+</strong>/<strong>-</strong> to adjust each person's share of an item.
        Shares are proportional — if two people each have 1 part, they split 50/50.
        Give someone 2 parts and others 1 to make them pay double.
        Click the number to quickly assign an item to one person.
      </div>

      <button
        onClick={() => onConfirm(parts)}
        className={styles.confirmBtn}
        disabled={warnings.length > 0}
      >
        {warnings.length > 0 ? `Fix ${warnings.length} warning(s) to continue` : 'Confirm & Continue'}
      </button>
    </div>
  );
}
