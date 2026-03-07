import React, { useState, useRef, useCallback } from 'react';
import styles from './Upload.module.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export default function Upload({ onConfirm }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = useCallback((f) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Please upload a JPG, PNG, or PDF file.');
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
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
    if (inputRef.current) inputRef.current.value = '';
  };

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
            <p className={styles.formats}>JPG, PNG, or PDF</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleInputChange}
            className={styles.hiddenInput}
          />
        </div>
      ) : (
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <span className={styles.filename}>{file.name}</span>
            <button onClick={handleRemove} className={styles.removeBtn}>
              Remove
            </button>
          </div>
          <div className={styles.previewBody}>
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
          <button
            onClick={() => onConfirm(file, previewUrl)}
            className={styles.confirmBtn}
          >
            Confirm & Continue
          </button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
