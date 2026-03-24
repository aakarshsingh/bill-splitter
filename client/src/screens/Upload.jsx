import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import styles from './Upload.module.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'application/json'];

export default function Upload({ initialFile, initialPreviewUrl, onConfirm, onLoadSession }) {
  const [file, setFile] = useState(initialFile || null);
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl || null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const inputRef = useRef();

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingFile, setLoadingFile] = useState(null);

  useEffect(() => {
    fetch('/api/load')
      .then((r) => r.ok ? r.json() : [])
      .then((files) => setHistory(files))
      .catch(() => {});
  }, []);

  const handleFile = useCallback(async (f) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Please upload a JPG, PNG, PDF, or JSON file.');
      return;
    }
    setError(null);
    setFile(f);
    setPdfPageCount(0);
    setSelectedPage(1);
    if (f.type === 'application/pdf') {
      setPreviewUrl(URL.createObjectURL(f));
      try {
        const buf = await f.arrayBuffer();
        const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
        const count = pdf.getPageCount();
        setPdfPageCount(count);
      } catch {
        setPdfPageCount(1);
      }
    } else if (f.type !== 'application/json') {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = (e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
  };

  const handleRemove = () => {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setPdfPageCount(0);
    setSelectedPage(1);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleLoadSession = async (filename) => {
    setLoadingFile(filename);
    setError(null);
    try {
      const res = await fetch('/api/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load session');
      }
      const session = await res.json();
      onLoadSession(session, filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingFile(null);
    }
  };

  const isJson = file && file.type === 'application/json';
  const isPdf = file && file.type === 'application/pdf';

  return (
    <div className={styles.container}>
      {!file ? (
        <div
          className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current.click()}
        >
          <div className={styles.dropzoneContent}>
            <span className={styles.icon}>+</span>
            <p>Drag & drop your bill here</p>
            <p className={styles.hint}>or click to browse</p>
            <p className={styles.formats}>JPG, PNG, PDF, or JSON (test mode)</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.json"
            onChange={handleInputChange}
            className={styles.hiddenInput}
          />
        </div>
      ) : (
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <span className={styles.filename}>
              {file.name}
              {isJson && <span className={styles.testBadge}>TEST MODE</span>}
            </span>
            <button onClick={handleRemove} className={styles.removeBtn}>
              Remove
            </button>
          </div>
          <div className={styles.previewBody}>
            {isJson ? (
              <div className={styles.jsonPreview}>
                Test data file — will skip AI parsing
              </div>
            ) : isPdf ? (
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
          {isPdf && pdfPageCount > 1 && (
            <div className={styles.pageSelector}>
              <label htmlFor="pdfPageSelect" className={styles.pageSelectorLabel}>
                This PDF has {pdfPageCount} pages. Which page is the bill on?
              </label>
              <div className={styles.pageSelectorControls}>
                <button
                  className={styles.pageArrowBtn}
                  onClick={() => setSelectedPage((p) => Math.max(1, p - 1))}
                  disabled={selectedPage <= 1}
                >
                  ‹
                </button>
                <input
                  id="pdfPageSelect"
                  type="number"
                  min={1}
                  max={pdfPageCount}
                  value={selectedPage}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(pdfPageCount, parseInt(e.target.value, 10) || 1));
                    setSelectedPage(v);
                  }}
                  className={styles.pageInput}
                />
                <span className={styles.pageTotal}>of {pdfPageCount}</span>
                <button
                  className={styles.pageArrowBtn}
                  onClick={() => setSelectedPage((p) => Math.min(pdfPageCount, p + 1))}
                  disabled={selectedPage >= pdfPageCount}
                >
                  ›
                </button>
              </div>
            </div>
          )}
          <button
            onClick={() => onConfirm(file, previewUrl, isPdf && pdfPageCount > 1 ? selectedPage : null)}
            className={styles.confirmBtn}
          >
            {isJson ? 'Load Test Data' : 'Confirm & Continue'}
          </button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}

      {history.length > 0 && !file && (
        <div className={styles.historySection}>
          <h3 className={styles.historyTitle}>Past Sessions</h3>
          <div className={styles.historyList}>
            {history.map((filename) => {
              const display = filename.replace('.json', '').replace(/-/g, ' ');
              return (
                <button
                  key={filename}
                  className={styles.historyItem}
                  onClick={() => handleLoadSession(filename)}
                  disabled={!!loadingFile}
                >
                  <span className={styles.historyName}>{display}</span>
                  {loadingFile === filename && (
                    <span className={styles.historyLoading}>Loading...</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
