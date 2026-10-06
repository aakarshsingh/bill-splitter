import React, { useState, useEffect } from 'react';
import styles from './Review.module.css';
import {
  CATEGORIES,
  RATE_FIELDS,
  RATE_PRESETS,
  DEFAULT_RATES,
  applyPreset,
  legacyToRates,
  calcItemBreakdown,
  calcTotal,
} from '../calcLib';
import { shrinkImage } from '../imageUtils';
import PriceInput from '../components/PriceInput';

function ratesEqual(a, b) {
  return CATEGORIES.every((cat) => RATE_FIELDS.every(({ key }) => a[cat][key] === b[cat][key]));
}

function initialRates(data) {
  if (data.rates) return data.rates;
  if (data.tax != null || data.serviceCharge != null) {
    return legacyToRates(data.tax || 0, data.serviceCharge || 0, data.formulaMode);
  }
  return DEFAULT_RATES;
}

export default function Review({ file, previewUrl, pdfPage, initialData, onConfirm }) {
  const hasInitial = initialData && initialData.items;
  const [items, setItems] = useState(hasInitial ? initialData.items : []);
  const [establishment, setEstablishment] = useState(hasInitial ? initialData.establishment : '');
  const [rates, setRates] = useState(hasInitial ? initialRates(initialData) : DEFAULT_RATES);
  const [billTotal, setBillTotal] = useState(hasInitial ? initialData.billTotal : 0);
  const [billDate, setBillDate] = useState(hasInitial ? initialData.billDate || null : null);
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState(null);

  const isPdf = file && file.type === 'application/pdf';

  useEffect(() => {
    if (hasInitial) return;
    const isTestJson = file && file.type === 'application/json';

    const loadData = async () => {
      try {
        let data;
        if (isTestJson) {
          const text = await file.text();
          data = JSON.parse(text);
        } else {
          const upload = await shrinkImage(file);
          const base64 = await fileToBase64(upload);
          const res = await fetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: base64, mimeType: upload.type, pageNumber: pdfPage || null }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to parse bill');
          }
          data = await res.json();
        }
        setEstablishment(data.establishment || '');
        setItems(data.items || []);
        setRates(initialRates(data));
        setBillTotal(data.billTotal || 0);
        if (data.date) setBillDate(data.date);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [file, hasInitial]);

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const updateRate = (category, key, value) => {
    setRates((prev) => ({ ...prev, [category]: { ...prev[category], [key]: value } }));
  };

  const toggleOverride = (item, effective) => {
    updateItem(item.id, 'effectiveOverride', item.effectiveOverride == null ? Math.round(effective) : null);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', qty: 1, unitPrice: 0, category: 'food' },
    ]);
  };

  const formatPrice = (paise) => (paise / 100).toFixed(2);

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const calculated = calcTotal(items, rates);
  const diff = billTotal > 0 ? Math.abs(calculated - billTotal) : 0;
  const isMatched = billTotal > 0 && diff <= 100; // within 1 rupee — receipts round off
  const activePreset = RATE_PRESETS.find((p) => ratesEqual(applyPreset(p.id, rates), rates));

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Parsing your bill with AI...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.tableSection}>
          <div className={styles.establishmentRow}>
            <label>Establishment</label>
            <input
              type="text"
              value={establishment}
              onChange={(e) => setEstablishment(e.target.value)}
              className={styles.establishmentInput}
            />
          </div>

          <div className={styles.dateRow}>
            <label>Date</label>
            <input
              type="date"
              value={billDate || ''}
              onChange={(e) => setBillDate(e.target.value || null)}
              className={styles.dateInput}
            />
            {!billDate && (
              <span className={styles.dateHint}>Not detected — will use today's date</span>
            )}
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>SC</th>
                <th>Tax</th>
                <th>Effective</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const bd = calcItemBreakdown(item, rates);
                return (
                  <tr key={item.id} className={bd.overridden ? styles.overrideRow : ''}>
                    <td>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        className={styles.nameInput}
                      />
                    </td>
                    <td>
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                        className={styles.categorySelect}
                      >
                        <option value="food">Food</option>
                        <option value="alcohol">Alcohol</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(item.id, 'qty', parseInt(e.target.value) || 1)
                        }
                        className={styles.qtyInput}
                      />
                    </td>
                    <td>
                      <PriceInput
                        paise={item.unitPrice}
                        onChange={(v) => updateItem(item.id, 'unitPrice', v)}
                        className={styles.priceInput}
                      />
                    </td>
                    <td className={styles.calcCol}>{bd.overridden ? '—' : formatPrice(bd.scAmount)}</td>
                    <td className={styles.calcCol}>{bd.overridden ? '—' : formatPrice(bd.taxAmount)}</td>
                    <td className={styles.lineTotal}>
                      <div className={styles.effectiveCell}>
                        {bd.overridden ? (
                          <PriceInput
                            paise={item.effectiveOverride}
                            onChange={(v) => updateItem(item.id, 'effectiveOverride', v)}
                            className={styles.overrideInput}
                            title="Effective price override (incl. all taxes)"
                          />
                        ) : (
                          formatPrice(bd.effective)
                        )}
                        <button
                          onClick={() => toggleOverride(item, bd.effective)}
                          className={`${styles.overrideBtn} ${bd.overridden ? styles.overrideOn : ''}`}
                          title={bd.overridden ? 'Remove override — use rates' : 'Override effective price'}
                        >
                          {bd.overridden ? '↺' : '✎'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => removeItem(item.id)}
                        className={styles.removeBtn}
                      >
                        x
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button onClick={addItem} className={styles.addBtn}>
            + Add Item
          </button>

          <div className={styles.ratesSection}>
            <div className={styles.ratesLabel}>Tax & Service Charge</div>
            <div className={styles.presetOptions}>
              {RATE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`${styles.presetBtn} ${activePreset?.id === preset.id ? styles.presetActive : ''}`}
                  onClick={() => setRates(applyPreset(preset.id, rates))}
                >
                  <span className={styles.presetBtnLabel}>{preset.label}</span>
                  <span className={styles.presetBtnDesc}>{preset.description}</span>
                </button>
              ))}
            </div>
            <table className={styles.ratesTable}>
              <thead>
                <tr>
                  <th></th>
                  {RATE_FIELDS.map(({ key, label }) => (
                    <th key={key}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat) => (
                  <tr key={cat}>
                    <td className={styles.rateCategory}>{cat === 'food' ? 'Food' : 'Alcohol'}</td>
                    {RATE_FIELDS.map(({ key }) => (
                      <td key={key}>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={rates[cat][key]}
                          onChange={(e) => updateRate(cat, key, parseFloat(e.target.value) || 0)}
                          className={styles.chargeInput}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.formulaNote}>
              Effective = CP + CP×SC% + CP×Tax% + SC×TaxOnSC%. Use ✎ on an item for one-off taxes (e.g. cess).
            </div>
          </div>

          <div className={styles.totalsSection}>
            <div className={styles.totalRow}>
              <span>Subtotal (base prices)</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Calculated total (with tax + SC)</span>
              <span>{formatPrice(calculated)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Bill total (from receipt)</span>
              <PriceInput
                paise={billTotal || null}
                onChange={setBillTotal}
                placeholder="Enter bill total"
                className={styles.billTotalInput}
              />
            </div>
            {billTotal > 0 && (
              <div className={`${styles.matchStatus} ${isMatched ? styles.matched : styles.mismatch}`}>
                {!isMatched
                  ? `Mismatch of ${formatPrice(diff)} — adjust items, rates, or override an item to reconcile`
                  : diff >= 1
                    ? `Totals match (${formatPrice(diff)} round-off)`
                    : 'Totals match'}
              </div>
            )}
          </div>

          <button
            onClick={() =>
              onConfirm({ establishment, items, rates, billTotal, billDate })
            }
            className={styles.confirmBtn}
            disabled={items.length === 0}
          >
            Confirm & Continue
          </button>
        </div>

        {previewUrl && !isPdf && (
          <div className={styles.previewSection}>
            <h3>Bill Preview</h3>
            <img
              src={previewUrl}
              alt="Bill preview"
              className={styles.imagePreview}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
