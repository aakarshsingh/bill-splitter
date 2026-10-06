import React, { useState } from 'react';
import Upload from './screens/Upload';
import Review from './screens/Review';
import People from './screens/People';
import Assign from './screens/Assign';
import Split from './screens/Split';
import Output from './screens/Output';
import styles from './App.module.css';

const STEP_LABELS = ['Upload', 'Review', 'People', 'Assign', 'Split', 'Output'];

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
        <span className={styles.byline}>by Aakarsh</span>
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
            onConfirm={(file, previewUrl, pdfPage) => {
              updateSession({ file, previewUrl, pdfPage });
              advance(2);
            }}
          />
        )}
        {screen === 2 && (
          <Review
            file={sessionData.file}
            previewUrl={sessionData.previewUrl}
            pdfPage={sessionData.pdfPage}
            initialData={sessionData.reviewData}
            onConfirm={(reviewData) => {
              updateSession({ reviewData });
              advance(3);
            }}
          />
        )}
        {screen === 3 && (
          <People
            initialSelected={sessionData.selectedPeople}
            onConfirm={(selectedPeople) => {
              updateSession({ selectedPeople });
              advance(4);
            }}
          />
        )}
        {screen === 4 && (
          <Assign
            reviewData={sessionData.reviewData || { items: [] }}
            people={sessionData.selectedPeople || []}
            initialAssignments={sessionData.assignments}
            onConfirm={(assignments) => {
              updateSession({ assignments });
              advance(5);
            }}
          />
        )}
        {screen === 5 && (
          <Split
            reviewData={sessionData.reviewData || { items: [] }}
            people={sessionData.selectedPeople || []}
            assignments={sessionData.assignments || {}}
            initialDiscount={sessionData.splitDiscount}
            onConfirm={(splitData, discountInfo) => {
              updateSession({ splitData, splitDiscount: discountInfo });
              advance(6);
            }}
          />
        )}
        {screen === 6 && (
          <Output
            sessionData={sessionData}
            onStartOver={() => {
              setSessionData({});
              setScreen(1);
              setMaxStep(1);
            }}
          />
        )}
      </main>
    </div>
  );
}
