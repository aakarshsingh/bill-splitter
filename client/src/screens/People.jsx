import React, { useState, useEffect } from 'react';
import styles from './People.module.css';

const MEAT_OPTIONS = ['chicken', 'mutton', 'pork', 'beef', 'seafood'];
const DRINK_OPTIONS = ['beer', 'wine', 'whisky', 'vodka', 'gin', 'rum', 'cocktails'];

const DEFAULT_PREF = { diet: 'non-veg', meats: [], drinks: [] };

function getPref(preferences, name) {
  return { ...DEFAULT_PREF, ...(preferences[name] || {}) };
}

function prefSummary(pref) {
  const parts = [];
  parts.push(pref.diet === 'veg' ? 'Veg' : 'Non-Veg');
  if (pref.meats.length > 0) parts.push(pref.meats.join(', '));
  if (pref.drinks.length > 0) parts.push(pref.drinks.join(', '));
  else parts.push('non-drinker');
  return parts.join(' · ');
}

export default function People({ initialSelected, initialPreferences, onConfirm }) {
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState(initialSelected || []);
  const [preferences, setPreferences] = useState(initialPreferences || {});
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // person name being edited
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/people').then((r) => { if (!r.ok) throw new Error('Failed to load people'); return r.json(); }),
      fetch('/api/preferences').then((r) => { if (!r.ok) throw new Error('Failed to load preferences'); return r.json(); }),
    ])
      .then(([peopleData, prefsData]) => {
        setPeople(peopleData.sort((a, b) => a.name.localeCompare(b.name)));
        setPreferences(initialPreferences ? { ...prefsData, ...initialPreferences } : prefsData);
      })
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
      setPeople((prev) => [...prev, person].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected((prev) => [...prev, person]);
      setNewName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addPerson();
  };

  const updatePref = (name, updates) => {
    const current = getPref(preferences, name);
    const updated = { ...current, ...updates };
    if (updates.diet === 'veg') updated.meats = [];
    setPreferences((prev) => ({ ...prev, [name]: updated }));
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, prefs: updated }),
    });
  };

  const toggleArrayPref = (name, field, value) => {
    const current = getPref(preferences, name);
    const arr = current[field] || [];
    const updated = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
    updatePref(name, { [field]: updated });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading people...</p>
      </div>
    );
  }

  const editPref = editing ? getPref(preferences, editing) : null;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Who's splitting?</h2>

      {people.length > 0 && (
        <div className={styles.quickActions}>
          <button className={styles.quickBtn} onClick={() => setSelected([...people])}>Select All</button>
          <button className={styles.quickBtn} onClick={() => setSelected([])}>Select None</button>
        </div>
      )}

      <div className={styles.chips}>
        {people.map((person) => {
          const sel = isSelected(person.id);
          return (
            <div key={person.id} className={styles.chipWrap}>
              <button
                className={`${styles.chip} ${sel ? styles.chipSelected : ''}`}
                onClick={() => togglePerson(person)}
              >
                {person.name}
              </button>
              {sel && (
                <button
                  className={styles.editBtn}
                  onClick={(e) => { e.stopPropagation(); setEditing(person.name); }}
                  title="Edit preferences"
                >
                  ✎
                </button>
              )}
            </div>
          );
        })}
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
        onClick={() => onConfirm(selected, preferences)}
        className={styles.confirmBtn}
        disabled={selected.length === 0}
      >
        Confirm & Continue
      </button>

      {editing && (
        <div className={styles.overlay} onClick={() => setEditing(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editing}</h3>
              <button className={styles.modalClose} onClick={() => setEditing(null)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.prefGroup}>
                <span className={styles.prefLabel}>Diet</span>
                <div className={styles.prefOptions}>
                  {['veg', 'non-veg'].map((d) => (
                    <button
                      key={d}
                      className={`${styles.optionChip} ${editPref.diet === d ? styles.optionActive : ''} ${d === 'veg' ? styles.vegChip : styles.nonvegChip}`}
                      onClick={() => updatePref(editing, { diet: d })}
                    >
                      {d === 'veg' ? 'Veg' : 'Non-Veg'}
                    </button>
                  ))}
                </div>
              </div>

              {editPref.diet === 'non-veg' && (
                <div className={styles.prefGroup}>
                  <span className={styles.prefLabel}>Meats</span>
                  <div className={styles.prefOptions}>
                    {MEAT_OPTIONS.map((m) => (
                      <button
                        key={m}
                        className={`${styles.optionChip} ${editPref.meats.includes(m) ? styles.optionActive : ''}`}
                        onClick={() => toggleArrayPref(editing, 'meats', m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.prefGroup}>
                <span className={styles.prefLabel}>Drinks</span>
                <div className={styles.prefOptions}>
                  <button
                    className={`${styles.optionChip} ${editPref.drinks.length === 0 ? styles.optionActive : ''}`}
                    onClick={() => updatePref(editing, { drinks: [] })}
                  >
                    non-drinker
                  </button>
                  {DRINK_OPTIONS.map((d) => (
                    <button
                      key={d}
                      className={`${styles.optionChip} ${editPref.drinks.includes(d) ? styles.optionActive : ''}`}
                      onClick={() => toggleArrayPref(editing, 'drinks', d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.prefSummaryLine}>
                {prefSummary(editPref)}
              </div>
            </div>

            <button className={styles.modalDone} onClick={() => setEditing(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
