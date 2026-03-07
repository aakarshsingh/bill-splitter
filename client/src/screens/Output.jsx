import React, { useState } from 'react';
import styles from './Output.module.css';

function formatPrice(paise) {
  return (paise / 100).toFixed(2);
}

function formatRupees(paise) {
  const rupees = Math.round(paise / 100);
  return rupees.toLocaleString('en-IN');
}

function buildWhatsAppText(establishment, splitData, grandTotal) {
  const lines = [];
  if (establishment) {
    lines.push(`*${establishment}*`);
  }
  lines.push('');

  const sorted = Object.entries(splitData)
    .sort(([, a], [, b]) => b.total - a.total);

  for (const [name, data] of sorted) {
    lines.push(`*${name}*: Rs ${formatRupees(data.total)}`);
    for (const entry of data.items) {
      const share = entry.parts === entry.totalParts
        ? ''
        : ` (${entry.parts}/${entry.totalParts})`;
      lines.push(`  - ${entry.name}${share}: ${formatRupees(entry.amount)}`);
    }
    lines.push('');
  }

  lines.push(`*Total: Rs ${formatRupees(grandTotal)}*`);
  return lines.join('\n');
}

export default function Output({ sessionData }) {
  const {
    reviewData,
    selectedPeople: people,
    preferences,
    instructions,
    assignments,
    splitData,
    historyFilename,
  } = sessionData;

  const { items, tax, serviceCharge, establishment } = reviewData || {};

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const grandTotal = splitData
    ? Object.values(splitData).reduce((s, d) => s + d.total, 0)
    : 0;

  const sorted = splitData
    ? Object.entries(splitData).sort(([, a], [, b]) => b.total - a.total)
    : [];

  const whatsappText = splitData
    ? buildWhatsAppText(establishment, splitData, grandTotal)
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = whatsappText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const session = {
        establishment,
        date: new Date().toISOString().slice(0, 10),
        items,
        tax,
        serviceCharge,
        billTotal: reviewData?.billTotal,
        formulaMode: reviewData?.formulaMode || 'indian-gst',
        people: people?.map((p) => ({ id: p.id, name: p.name })),
        preferences,
        instructions,
        assignments,
        splitData,
      };
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, overwriteFilename: historyFilename || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      const data = await res.json();
      setSaveResult(data.filename);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Final Summary</h2>

      {establishment && (
        <div className={styles.establishment}>{establishment}</div>
      )}

      <table className={styles.summaryTable}>
        <thead>
          <tr>
            <th>Person</th>
            <th>Items</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([name, data]) => (
            <tr key={name}>
              <td className={styles.personCell}>{name}</td>
              <td className={styles.itemsCell}>{data.items.length}</td>
              <td className={styles.amountCell}>{formatPrice(data.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={styles.totalLabel}>Total</td>
            <td></td>
            <td className={styles.totalAmount}>{formatPrice(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${styles.copyBtn}`}
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy for WhatsApp'}
        </button>

        <button
          className={`${styles.actionBtn} ${styles.saveBtn}`}
          onClick={handleSave}
          disabled={saving || !!saveResult}
        >
          {saving ? 'Saving...' : saveResult ? `Saved: ${saveResult}` : 'Save Session'}
        </button>
      </div>

      {saveError && (
        <div className={styles.error}>{saveError}</div>
      )}

      <div className={styles.previewSection}>
        <button
          className={styles.previewHeader}
          onClick={() => setShowPreview((v) => !v)}
        >
          <span className={styles.previewLabel}>WhatsApp Preview</span>
          <span className={styles.collapseIcon}>{showPreview ? '\u25B2' : '\u25BC'}</span>
        </button>
        {showPreview && (
          <pre className={styles.previewText}>{whatsappText}</pre>
        )}
      </div>

      <div className={styles.detailSection}>
        <button
          className={styles.detailToggle}
          onClick={() => setShowDetail((v) => !v)}
        >
          <span className={styles.detailTitle}>Detailed Breakdown</span>
          <span className={styles.collapseIcon}>{showDetail ? '\u25B2' : '\u25BC'}</span>
        </button>
        {showDetail && sorted.map(([name, data]) => (
          <div key={name} className={styles.personBlock}>
            <div className={styles.personHeader}>
              <span className={styles.personName}>{name}</span>
              <span className={styles.personTotal}>{formatPrice(data.total)}</span>
            </div>
            <table className={styles.detailTable}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Share</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.itemId}>
                    <td className={styles.detailItem}>
                      {entry.name}
                      {entry.qty > 1 && <span className={styles.detailQty}> x{entry.qty}</span>}
                    </td>
                    <td className={styles.detailShare}>
                      {entry.parts === entry.totalParts
                        ? 'all'
                        : `${entry.parts}/${entry.totalParts}`}
                    </td>
                    <td className={styles.detailAmount}>{formatPrice(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

