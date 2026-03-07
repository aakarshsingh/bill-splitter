import React, { useState } from 'react';
import Upload from './screens/Upload';
import Review from './screens/Review';
import styles from './App.module.css';

const STEP_LABELS = ['Upload', 'Review', 'People', 'Instructions', 'Assign', 'Split', 'Output'];

export default function App() {
  const [screen, setScreen] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [sessionData, setSessionData] = useState({});

  const updateSession = (updates) => {
    setSessionData((prev) => ({ ...prev, ...updates }));
  };

  const goTo = (step) => {
    if (step <= maxStep) setScreen(step);
  };

  const advance = (step) => {
    setScreen(step);
    setMaxStep((prev) => Math.max(prev, step));
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Bill Splitter</h1>
      </header>
      <nav className={styles.stepper}>
        {STEP_LABELS.map((label, i) => {
          const step = i + 1;
          const isActive = screen === step;
          const isCompleted = step < maxStep;
          const isReachable = step <= maxStep;
          return (
            <button
              key={step}
              className={`${styles.stepBtn} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}
              onClick={() => goTo(step)}
              disabled={!isReachable}
            >
              <span className={styles.stepNum}>{step}</span>
              <span className={styles.stepLabel}>{label}</span>
            </button>
          );
        })}
      </nav>
      <main className={styles.main}>
        {screen === 1 && (
          <Upload
            initialFile={sessionData.file}
            initialPreviewUrl={sessionData.previewUrl}
            onConfirm={(file, previewUrl) => {
              updateSession({ file, previewUrl });
              advance(2);
            }}
          />
        )}
        {screen === 2 && (
          <Review
            file={sessionData.file}
            previewUrl={sessionData.previewUrl}
            initialData={sessionData.reviewData}
            onConfirm={(reviewData) => {
              updateSession({ reviewData });
              advance(3);
            }}
          />
        )}
        {screen === 3 && (
          <p>Screen 3 — People (not yet implemented)</p>
        )}
      </main>
    </div>
  );
}
