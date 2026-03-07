import React, { useState } from 'react';
import Upload from './screens/Upload';
import Review from './screens/Review';
import styles from './App.module.css';

export default function App() {
  const [screen, setScreen] = useState(1);
  const [sessionData, setSessionData] = useState({});

  const updateSession = (updates) => {
    setSessionData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Bill Splitter</h1>
        <span className={styles.step}>Step {screen} of 7</span>
      </header>
      <main className={styles.main}>
        {screen === 1 && (
          <Upload
            onConfirm={(file, previewUrl) => {
              updateSession({ file, previewUrl });
              setScreen(2);
            }}
          />
        )}
        {screen === 2 && (
          <Review
            file={sessionData.file}
            previewUrl={sessionData.previewUrl}
            onConfirm={(reviewData) => {
              updateSession(reviewData);
              setScreen(3);
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
