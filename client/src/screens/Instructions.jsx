import React, { useState, useRef, useEffect } from 'react';
import styles from './Instructions.module.css';

const ALL_MEATS = ['chicken', 'mutton', 'pork', 'beef', 'seafood'];

function describePref(pref) {
  if (!pref) return null;
  const parts = [];
  if (pref.diet === 'veg') parts.push('veg');
  if (pref.meats && pref.meats.length > 0) parts.push(pref.meats.join(', '));
  if (pref.drinks && pref.drinks.length > 0) parts.push(pref.drinks.join(', '));
  else parts.push('non-drinker');
  return parts.join(' · ');
}

function generateAutoInstructions(people, preferences) {
  const auto = [];

  for (const person of people) {
    const pref = preferences[person.name];
    if (!pref) continue;
    const name = person.name;

    // Diet
    if (pref.diet === 'veg') {
      auto.push(`${name} is vegetarian — only assign veg items`);
    }

    // Meat restrictions (only if non-veg and has specific meats, not all)
    if (pref.diet === 'non-veg' && pref.meats.length > 0 && pref.meats.length < ALL_MEATS.length) {
      const avoids = ALL_MEATS.filter((m) => !pref.meats.includes(m));
      if (avoids.length <= 2) {
        auto.push(`${name} doesn't eat ${avoids.join(' or ')}`);
      } else {
        auto.push(`${name} only eats ${pref.meats.join(', ')}`);
      }
    }

    // Drinks
    if (pref.drinks.length === 0) {
      auto.push(`${name} doesn't drink — no alcohol`);
    } else if (pref.drinks.length <= 2) {
      auto.push(`${name} drinks ${pref.drinks.join(' and ')}`);
    }
  }

  return auto;
}

function generateExamples(people, preferences) {
  const names = people.map((p) => p.name);
  if (names.length === 0) return [];
  const examples = [];

  // Split example
  if (names.length >= 3) {
    examples.push(`Split pizza between ${names[0]}, ${names[1]} and ${names[2]}`);
  } else if (names.length >= 2) {
    examples.push(`Split pizza between ${names[0]} and ${names[1]}`);
  }

  // Preference-aware drink examples
  for (const person of people) {
    const pref = preferences[person.name];
    if (pref && pref.drinks && pref.drinks.length > 0) {
      examples.push(`${person.name} had all the ${pref.drinks[0]}`);
      if (pref.drinks.length > 1) {
        examples.push(`${person.name} only had ${pref.drinks[1]}`);
      }
      break;
    }
  }

  // Preference-aware meat example
  for (const person of people) {
    const pref = preferences[person.name];
    if (pref && pref.meats && pref.meats.length > 0) {
      examples.push(`${person.name} had the ${pref.meats[0]} dishes`);
      break;
    }
  }

  // Shared items
  if (names.length >= 2) {
    examples.push(`Everyone shared the appetizers`);
  }

  return examples;
}

export default function Instructions({ people, preferences, initialInstructions, onConfirm }) {
  const autoInstructions = generateAutoInstructions(people, preferences);
  const startingInstructions = initialInstructions || (autoInstructions.length > 0 ? autoInstructions : []);

  const [instructions, setInstructions] = useState(startingInstructions);
  const [draft, setDraft] = useState('');
  const [mention, setMention] = useState(null); // { startIndex, query }
  const [mentionIdx, setMentionIdx] = useState(0); // highlighted index in dropdown
  const textareaRef = useRef(null);

  const examples = generateExamples(people, preferences);

  const mentionMatches = mention
    ? people
        .map((p) => p.name)
        .filter((n) => n.toLowerCase().startsWith(mention.query.toLowerCase()))
    : [];

  useEffect(() => {
    setMentionIdx(0);
  }, [mention?.query]);

  const addInstruction = () => {
    const text = draft.trim();
    if (!text) return;
    setInstructions((prev) => [...prev, text]);
    setDraft('');
  };

  const removeInstruction = (index) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const insertMention = (name) => {
    if (!mention) return;
    const before = draft.slice(0, mention.startIndex);
    const after = draft.slice(mention.startIndex + mention.query.length + 1); // +1 for @
    const newDraft = before + name + after;
    setDraft(newDraft);
    setMention(null);
    textareaRef.current?.focus();
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setDraft(val);

    const cursor = e.target.selectionStart;
    // Look backwards from cursor to find an unmatched @
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx !== -1 && (atIdx === 0 || /\s/.test(textBefore[atIdx - 1]))) {
      const query = textBefore.slice(atIdx + 1);
      if (!/\s/.test(query)) {
        setMention({ startIndex: atIdx, query });
        return;
      }
    }
    setMention(null);
  };

  const handleKeyDown = (e) => {
    if (mention && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionMatches[mentionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addInstruction();
    }
  };

  const prefEntries = people
    .map((p) => ({ name: p.name, desc: describePref(preferences[p.name]) }))
    .filter((e) => e.desc);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Assignment Instructions</h2>

      <div className={styles.peopleRef}>
        <span className={styles.peopleLabel}>People:</span>
        {people.map((p) => (
          <span key={p.name} className={styles.personTag}>{p.name}</span>
        ))}
      </div>

      {prefEntries.length > 0 && (
        <div className={styles.prefsSummary}>
          <span className={styles.prefsLabel}>Known preferences</span>
          {prefEntries.map((e) => (
            <div key={e.name} className={styles.prefEntry}>
              <strong>{e.name}</strong> — {e.desc}
            </div>
          ))}
        </div>
      )}

      {instructions.length > 0 && (
        <>
          <div className={styles.listHeader}>
            <span className={styles.listLabel}>
              Instructions ({instructions.length})
            </span>
            <button
              className={styles.clearAllBtn}
              onClick={() => setInstructions([])}
            >
              Clear all
            </button>
          </div>
          <ul className={styles.list}>
            {instructions.map((text, i) => (
              <li key={i} className={styles.listItem}>
                <span className={styles.listText}>{text}</span>
                <button onClick={() => removeInstruction(i)} className={styles.removeBtn}>x</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.inputArea}>
        <div className={styles.textareaWrap}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setMention(null), 150)}
            placeholder={examples.length > 0 ? `e.g. "${examples[0]}"` : 'Type an instruction... (use @ to mention people)'}
            className={styles.textarea}
            rows={2}
          />
          {mention && mentionMatches.length > 0 && (
            <div className={styles.mentionDropdown}>
              {mentionMatches.map((name, i) => (
                <button
                  key={name}
                  className={`${styles.mentionItem} ${i === mentionIdx ? styles.mentionActive : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(name); }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={addInstruction} className={styles.addBtn} disabled={!draft.trim()}>
          Add
        </button>
      </div>

      {examples.length > 0 && (
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Quick add:</span>
          {examples.map((ex, i) => (
            <button
              key={i}
              className={styles.exampleBtn}
              onClick={() => {
                setInstructions((prev) => [...prev, ex]);
              }}
            >
              + {ex}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => onConfirm(instructions)}
        className={styles.confirmBtn}
      >
        {instructions.length === 0 ? 'Skip — No Instructions' : 'Confirm & Continue'}
      </button>
    </div>
  );
}
