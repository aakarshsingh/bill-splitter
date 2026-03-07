import React, { useState, useEffect } from 'react';
import styles from './People.module.css';

export default function People({ initialSelected, onConfirm }) {
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState(initialSelected || []);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/people')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load people');
        return res.json();
      })
      .then((data) => setPeople(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const togglePerson = (person) => {
    setSelected((prev) => {
      const exists = prev.find((p) => p.id === person.id);
      if (exists) return prev.filter((p) => p.id !== person.id);
      return [...prev, person];
    });
  };

  const isSelected = (id) => selected.some((p) => p.id === id);

  const addPerson = async () => {
    const name = newName.trim();
    if (!name) return;
    if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setError('Person already exists');
      return;
    }
    try {
      setError(null);
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to add person');
      const person = await res.json();
      setPeople((prev) => [...prev, person]);
      setSelected((prev) => [...prev, person]);
      setNewName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addPerson();
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading people...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Who's splitting?</h2>

      <div className={styles.chips}>
        {people.map((person) => (
          <button
            key={person.id}
            className={`${styles.chip} ${isSelected(person.id) ? styles.chipSelected : ''}`}
            onClick={() => togglePerson(person)}
          >
            {person.name}
          </button>
        ))}
        {people.length === 0 && (
          <p className={styles.empty}>No people yet. Add someone below.</p>
        )}
      </div>

      <div className={styles.addRow}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a person..."
          className={styles.addInput}
        />
        <button onClick={addPerson} className={styles.addBtn} disabled={!newName.trim()}>
          Add
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.selectedSummary}>
        {selected.length > 0
          ? `${selected.length} selected: ${selected.map((p) => p.name).join(', ')}`
          : 'No one selected'}
      </div>

      <button
        onClick={() => onConfirm(selected)}
        className={styles.confirmBtn}
        disabled={selected.length === 0}
      >
        Confirm & Continue
      </button>
    </div>
  );
}
