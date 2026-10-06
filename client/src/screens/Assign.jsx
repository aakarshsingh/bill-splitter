import React, { useState } from 'react';
import styles from './Assign.module.css';
import { calcEffective, hasOverride } from '../calcLib';

function formatPrice(paise) {
  return (paise / 100).toFixed(2);
}

// Assignments stored as { itemId: { personName: parts } }
// "parts" is an integer — how many shares this person has of the item.
// The fraction each person pays = parts / totalParts for that item.

function sumParts(itemParts) {
  return Object.values(itemParts || {}).reduce((s, v) => s + v, 0);
}

function buildRow(people, partsFor) {
  const row = {};
  for (const p of people) row[p.name] = partsFor(p);
  return row;
}

function buildEmptyParts(items, people) {
  const map = {};
  for (const item of items) map[item.id] = buildRow(people, () => 0);
  return map;
}

export default function Assign({ reviewData, people, initialAssignments, onConfirm }) {
  const { items, rates } = reviewData;

  const [parts, setParts] = useState(() => initialAssignments || buildEmptyParts(items, people));
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  const setRow = (itemId, row) => setParts((prev) => ({ ...prev, [itemId]: row }));

  const adjust = (itemId, personName, delta) => {
    setParts((prev) => {
      const row = prev[itemId] || {};
      return { ...prev, [itemId]: { ...row, [personName]: Math.max(0, (row[personName] || 0) + delta) } };
    });
  };

  // Count button toggles a person in/out of an item without touching others
  const toggle = (itemId, personName) => {
    setParts((prev) => {
      const row = prev[itemId] || {};
      return { ...prev, [itemId]: { ...row, [personName]: row[personName] > 0 ? 0 : 1 } };
    });
  };

  const splitEqual = (itemId) => setRow(itemId, buildRow(people, () => 1));
  const clearItem = (itemId) => setRow(itemId, buildRow(people, () => 0));

  const copyFromAbove = (index) => {
    const prevItem = items[index - 1];
    setRow(items[index].id, buildRow(people, (p) => (parts[prevItem.id] || {})[p.name] || 0));
  };

  const splitAllEqual = () => {
    const updated = {};
    for (const item of items) updated[item.id] = buildRow(people, () => 1);
    setParts(updated);
  };

  const splitRemainingEqual = () => {
    setParts((prev) => {
      const updated = { ...prev };
      for (const item of items) {
        if (sumParts(prev[item.id]) === 0) updated[item.id] = buildRow(people, () => 1);
      }
      return updated;
    });
  };

  const clearAll = () => {
    setParts(buildEmptyParts(items, people));
  };

  const unassignedCount = items.filter((item) => sumParts(parts[item.id]) === 0).length;
  const assignedCount = items.length - unassignedCount;

  // Per-person totals
  const personTotals = {};
  for (const p of people) personTotals[p.name] = 0;
  for (const item of items) {
    const eff = calcEffective(item, rates);
    const itemParts = parts[item.id] || {};
    const totalParts = sumParts(itemParts);
    if (totalParts === 0) continue;
    for (const p of people) {
      const pp = itemParts[p.name] || 0;
      if (pp > 0) personTotals[p.name] += eff * (pp / totalParts);
    }
  }
  const grandTotal = Object.values(personTotals).reduce((s, v) => s + v, 0);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Assign Items</h2>

      <div className={styles.toolbar}>
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${items.length ? (assignedCount / items.length) * 100 : 0}%` }}
            />
          </div>
          <span className={unassignedCount === 0 ? styles.progressDone : styles.progressText}>
            {assignedCount}/{items.length} assigned
          </span>
          <label className={styles.filterToggle}>
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
            />
            Unassigned only
          </label>
        </div>

        <div className={styles.bulkActions}>
          <button className={styles.bulkBtn} onClick={splitRemainingEqual} disabled={unassignedCount === 0}>
            Split remaining equally
          </button>
          <button className={styles.bulkBtn} onClick={splitAllEqual}>
            Split all equally
          </button>
          <button className={styles.bulkBtn} onClick={clearAll}>
            Clear all
          </button>
        </div>
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
            {items.map((item, index) => {
              const eff = calcEffective(item, rates);
              const itemParts = parts[item.id] || {};
              const totalParts = sumParts(itemParts);
              if (unassignedOnly && totalParts > 0) return null;
              const unitsMatch = item.qty > 1 && totalParts === item.qty;

              return (
                <tr key={item.id} className={totalParts === 0 ? styles.rowUnassigned : ''}>
                  <td className={styles.itemCell}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={`${styles.itemMeta} ${item.category === 'alcohol' ? styles.alcohol : ''}`}>
                      {item.category} · qty {item.qty}
                      {hasOverride(item) && <span className={styles.overrideTag}> · override</span>}
                    </span>
                    {item.qty > 1 && totalParts > 0 && (
                      <span className={`${styles.unitHint} ${unitsMatch ? styles.unitHintMatch : ''}`}>
                        {unitsMatch ? 'parts = units' : `${totalParts} parts · ${item.qty} units`}
                      </span>
                    )}
                  </td>
                  <td className={styles.effCell}>{formatPrice(eff)}</td>
                  {people.map((p) => {
                    const pp = itemParts[p.name] || 0;
                    const isActive = pp > 0;
                    const fraction = isActive
                      ? pp === totalParts
                        ? 'all'
                        : unitsMatch
                          ? `${pp} of ${item.qty}`
                          : `${pp}/${totalParts}`
                      : null;

                    return (
                      <td key={p.id} className={styles.shareCell}>
                        <div className={`${styles.shareBox} ${isActive ? styles.shareActive : ''}`}>
                          <button
                            className={styles.shareBtn}
                            onClick={() => adjust(item.id, p.name, -1)}
                            disabled={pp === 0}
                          >
                            -
                          </button>
                          <button
                            className={styles.shareCount}
                            onClick={() => toggle(item.id, p.name)}
                            title={pp === 0 ? `Add ${p.name}` : `Remove ${p.name}`}
                          >
                            {pp}
                          </button>
                          <button
                            className={styles.shareBtn}
                            onClick={() => adjust(item.id, p.name, 1)}
                          >
                            +
                          </button>
                        </div>
                        {fraction && <div className={styles.shareFraction}>{fraction}</div>}
                        {isActive && (
                          <div className={styles.shareAmount}>{formatPrice(eff * pp / totalParts)}</div>
                        )}
                      </td>
                    );
                  })}
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.rowBtn}
                      onClick={() => copyFromAbove(index)}
                      disabled={index === 0}
                      title="Same as above"
                    >
                      ↑
                    </button>
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
            {unassignedOnly && unassignedCount === 0 && (
              <tr>
                <td colSpan={people.length + 3} className={styles.emptyFilter}>
                  Everything is assigned.
                </td>
              </tr>
            )}
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

      <div className={styles.shareHelp}>
        <span className={styles.helpLabel}>How it works:</span>{' '}
        Tap a number to add or remove that person. Use <strong>+</strong>/<strong>-</strong> to weight
        shares — 2 parts vs 1 part pays double. For items with qty &gt; 1, set parts to units
        (e.g. 6 shots: 4 + 2). <strong>↑</strong> copies the split from the row above,
        <strong> =</strong> splits equally, <strong>x</strong> clears the row.
      </div>

      <button
        onClick={() => onConfirm(parts)}
        className={styles.confirmBtn}
        disabled={unassignedCount > 0}
      >
        {unassignedCount > 0 ? `Assign ${unassignedCount} more item(s) to continue` : 'Confirm & Continue'}
      </button>
    </div>
  );
}
