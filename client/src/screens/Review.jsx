import React, { useState, useEffect } from 'react';
import styles from './Review.module.css';
import { FORMULA_MODES, calcItemBreakdown, calcTotal } from '../calcLib';

export default function Review({ file, previewUrl, initialData, onConfirm }) {
  const hasInitial = initialData && initialData.items;
  const [items, setItems] = useState(hasInitial ? initialData.items : []);
  const [establishment, setEstablishment] = useState(hasInitial ? initialData.establishment : '');
  const [tax, setTax] = useState(hasInitial ? initialData.tax : 0);
  const [serviceCharge, setServiceCharge] = useState(hasInitial ? initialData.serviceCharge : 0);
  const [billTotal, setBillTotal] = useState(hasInitial ? initialData.billTotal : 0);
  const [testAssignments, setTestAssignments] = useState(hasInitial ? initialData.testAssignments || null : null);
  const [formulaMode, setFormulaMode] = useState(hasInitial ? initialData.formulaMode || 'indian-gst' : 'indian-gst');
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
          const base64 = await fileToBase64(file);
          const res = await fetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: base64, mimeType: file.type }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to parse bill');
          }
          data = await res.json();
        }
        setEstablishment(data.establishment || '');
        setItems(data.items || []);
        setTax(data.tax || 0);
        setServiceCharge(data.serviceCharge || 0);
        setBillTotal(data.billTotal || 0);
        if (data.testAssignments) setTestAssignments(data.testAssignments);
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
  const parsePriceInput = (str) => {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const calculated = calcTotal(items, tax, serviceCharge, formulaMode);
  const diff = billTotal > 0 ? Math.abs(calculated - billTotal) : 0;
  const isMatched = billTotal > 0 && diff <= 100; // within 1 rupee

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
                const bd = calcItemBreakdown(item, tax, serviceCharge, formulaMode);
                return (
                  <tr key={item.id}>
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
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formatPrice(item.unitPrice)}
                        onChange={(e) =>
                          updateItem(item.id, 'unitPrice', parsePriceInput(e.target.value))
                        }
                        className={styles.priceInput}
                      />
                    </td>
                    <td className={styles.calcCol}>{formatPrice(bd.scAmount)}</td>
                    <td className={styles.calcCol}>{formatPrice(bd.taxAmount)}</td>
                    <td className={styles.lineTotal}>{formatPrice(bd.effective)}</td>
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

          <div className={styles.chargesRow}>
            <div className={styles.chargeField}>
              <label>Tax/GST %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={tax}
                onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                className={styles.chargeInput}
              />
            </div>
            <div className={styles.chargeField}>
              <label>Service Charge %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(parseFloat(e.target.value) || 0)}
                className={styles.chargeInput}
              />
            </div>
          </div>

          <div className={styles.formulaSection}>
            <div className={styles.formulaLabel}>Tax/SC Formula</div>
            <div className={styles.formulaOptions}>
              {FORMULA_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`${styles.formulaBtn} ${formulaMode === mode.id ? styles.formulaActive : ''}`}
                  onClick={() => setFormulaMode(mode.id)}
                  title={mode.formula}
                >
                  <span className={styles.formulaBtnLabel}>{mode.label}</span>
                  <span className={styles.formulaBtnDesc}>{mode.description}</span>
                </button>
              ))}
            </div>
            <div className={styles.formulaNote}>
              {FORMULA_MODES.find((m) => m.id === formulaMode)?.formula}
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
            {billTotal > 0 && (
              <>
                <div className={styles.totalRow}>
                  <span>Bill total (from receipt)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formatPrice(billTotal)}
                    onChange={(e) => setBillTotal(parsePriceInput(e.target.value))}
                    className={styles.billTotalInput}
                  />
                </div>
                <div className={`${styles.matchStatus} ${isMatched ? styles.matched : styles.mismatch}`}>
                  {isMatched
                    ? 'Totals match'
                    : `Mismatch of ${formatPrice(diff)} — adjust items, tax, or SC to reconcile`}
                </div>
              </>
            )}
            {billTotal === 0 && (
              <div className={styles.totalRow}>
                <span>Bill total (manual)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value=""
                  placeholder="Enter bill total"
                  onChange={(e) => setBillTotal(parsePriceInput(e.target.value))}
                  className={styles.billTotalInput}
                />
              </div>
            )}
          </div>

          <button
            onClick={() =>
              onConfirm({ establishment, items, tax, serviceCharge, billTotal, testAssignments, formulaMode })
            }
            className={styles.confirmBtn}
            disabled={items.length === 0}
          >
            Confirm & Continue
          </button>
        </div>

        {previewUrl && (
          <div className={styles.previewSection}>
            <h3>Bill Preview</h3>
            {isPdf ? (
              <iframe
                src={previewUrl}
                title="Bill preview"
                className={styles.pdfPreview}
              />
            ) : (
              <img
                src={previewUrl}
                alt="Bill preview"
                className={styles.imagePreview}
              />
            )}
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
