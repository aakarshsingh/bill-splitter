import React, { useState } from 'react';
import Upload from './screens/Upload';
import Review from './screens/Review';
import People from './screens/People';
import Instructions from './screens/Instructions';
import Assign from './screens/Assign';
import Split from './screens/Split';
import Output from './screens/Output';
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

  const loadSession = (session, historyFilename) => {
    const reviewData = {
      establishment: session.establishment,
      items: session.items,
      tax: session.tax,
      serviceCharge: session.serviceCharge,
      billTotal: session.billTotal,
      billDate: session.billDate || session.date || null,
      formulaMode: session.formulaMode || 'indian-gst',
    };
    const newSessionData = {
      reviewData,
      selectedPeople: session.people,
      preferences: session.preferences || {},
      instructions: session.instructions || [],
      assignments: session.assignments || {},
      splitData: session.splitData || null,
      historyFilename: historyFilename || null,
    };
    setSessionData(newSessionData);
    // Jump to the furthest screen that has data
    if (session.splitData) {
      setScreen(7);
      setMaxStep(7);
    } else if (session.assignments && Object.keys(session.assignments).length > 0) {
      setScreen(6);
      setMaxStep(6);
    } else {
      setScreen(2);
      setMaxStep(2);
    }
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
            onConfirm={(file, previewUrl) => {
              updateSession({ file, previewUrl });
              advance(2);
            }}
            onLoadSession={loadSession}
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
          <People
            initialSelected={sessionData.selectedPeople}
            initialPreferences={sessionData.preferences}
            onConfirm={(selectedPeople, preferences) => {
              updateSession({ selectedPeople, preferences });
              advance(4);
            }}
          />
        )}
        {screen === 4 && (
          <Instructions
            people={sessionData.selectedPeople || []}
            preferences={sessionData.preferences || {}}
            items={sessionData.reviewData?.items || []}
            initialInstructions={sessionData.instructions}
            onConfirm={(instructions) => {
              updateSession({ instructions });
              advance(5);
            }}
          />
        )}
        {screen === 5 && (
          <Assign
            reviewData={sessionData.reviewData || { items: [], tax: 0, serviceCharge: 0 }}
            people={sessionData.selectedPeople || []}
            preferences={sessionData.preferences || {}}
            instructions={sessionData.instructions || []}
            initialAssignments={sessionData.assignments}
            isTestMode={sessionData.file?.type === 'application/json'}
            testAssignments={sessionData.reviewData?.testAssignments}
            onConfirm={(assignments) => {
              updateSession({ assignments });
              advance(6);
            }}
          />
        )}
        {screen === 6 && (
          <Split
            reviewData={sessionData.reviewData || { items: [], tax: 0, serviceCharge: 0 }}
            people={sessionData.selectedPeople || []}
            assignments={sessionData.assignments || {}}
            initialDiscount={sessionData.splitDiscount}
            onConfirm={(splitData, discount) => {
              updateSession({ splitData, splitDiscount: discount });
              advance(7);
            }}
          />
        )}
        {screen === 7 && (
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
