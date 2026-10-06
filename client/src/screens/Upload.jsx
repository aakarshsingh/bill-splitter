import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import styles from './Upload.module.css';
import { captureVideoFrame } from '../imageUtils';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/json'];

// Live camera needs a secure context (https or localhost). Elsewhere — e.g. a
// phone hitting the dev server over LAN — fall back to the OS camera picker.
const canUseLiveCamera = () =>
  typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef();
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        videoRef.current.srcObject = s;
      })
      .catch((err) => setError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : err.message));
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = async () => {
    try {
      onCapture(await captureVideoFrame(videoRef.current));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.cameraOverlay}>
      <div className={styles.cameraModal}>
        {error ? (
          <p className={styles.cameraError}>{error}</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className={styles.cameraVideo}
          />
        )}
        <div className={styles.cameraControls}>
          <button onClick={onClose} className={styles.cameraCancel}>Cancel</button>
          {!error && (
            <button onClick={capture} className={styles.cameraShutter} disabled={!ready} aria-label="Capture">
              <span className={styles.cameraShutterInner} />
            </button>
          )}
          <span className={styles.cameraSpacer} />
        </div>
      </div>
    </div>
  );
}

export default function Upload({ initialFile, initialPreviewUrl, onConfirm }) {
  const [file, setFile] = useState(initialFile || null);
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl || null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const inputRef = useRef();
  const captureInputRef = useRef();
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleFile = useCallback(async (f) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Please upload a JPG, PNG, WebP, PDF, or JSON file.');
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

  const openCamera = () => {
    if (canUseLiveCamera()) setCameraOpen(true);
    else captureInputRef.current.click();
  };

  const handleCapture = (f) => {
    setCameraOpen(false);
    handleFile(f);
  };

  const handleRemove = () => {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setPdfPageCount(0);
    setSelectedPage(1);
    if (inputRef.current) inputRef.current.value = '';
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
            <p className={styles.formats}>JPG, PNG, WebP, PDF, or JSON (test mode)</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.json"
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
      {!file && (
        <>
          <button onClick={openCamera} className={styles.cameraBtn}>
            Take a photo
          </button>
          <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
            className={styles.hiddenInput}
          />
        </>
      )}
      {cameraOpen && <CameraModal onCapture={handleCapture} onClose={() => setCameraOpen(false)} />}
      {error && <p className={styles.error}>{error}</p>}

    </div>
  );
}
