import React, { useState, useEffect } from 'react';
import styles from './Review.module.css';

export default function Review({ file, previewUrl, onConfirm }) {
  const [items, setItems] = useState([]);
  const [establishment, setEstablishment] = useState('');
  const [tax, setTax] = useState(0);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isPdf = file && file.type === 'application/pdf';

  useEffect(() => {
    const parseFile = async () => {
      try {
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
        const data = await res.json();
        setEstablishment(data.establishment || '');
        setItems(data.items || []);
        setTax(data.tax || 0);
        setServiceCharge(data.serviceCharge || 0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    parseFile();
  }, [file]);

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
      { id: crypto.randomUUID(), name: '', qty: 1, unitPrice: 0 },
    ]);
  };

  const formatPrice = (paise) => {
    return (paise / 100).toFixed(2);
  };

  const parsePriceInput = (str) => {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

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
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
                  <td className={styles.lineTotal}>
                    {formatPrice(item.unitPrice * item.qty)}
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
              ))}
            </tbody>
          </table>

          <button onClick={addItem} className={styles.addBtn}>
            + Add Item
          </button>

          <div className={styles.chargesRow}>
            <div className={styles.chargeField}>
              <label>Tax %</label>
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

          <div className={styles.subtotal}>
            Subtotal: {formatPrice(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0))}
            {' | '}
            With tax + SC: {formatPrice(
              items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0) *
                (1 + tax / 100 + serviceCharge / 100)
            )}
          </div>

          <button
            onClick={() =>
              onConfirm({ establishment, items, tax, serviceCharge })
            }
            className={styles.confirmBtn}
            disabled={items.length === 0}
          >
            Confirm & Continue
          </button>
        </div>

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
