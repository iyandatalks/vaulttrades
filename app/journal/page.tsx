"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: string;
  setup: string;
  result: string;
  notes: string;
  createdAt: string;
};

const KEY = "vaulttrades-journal";

export default function JournalPage() {
  const [setup, setSetup] = useState("");
  const [result, setResult] = useState("Win");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      setEntries(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {
      setEntries([]);
    }
  }, []);

  const persist = (next: Entry[]) => {
    setEntries(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const save = () => {
    if (!setup.trim() && !notes.trim()) return;

    if (editingId) {
      persist(
        entries.map((entry) =>
          entry.id === editingId
            ? { ...entry, setup: setup.trim(), result, notes: notes.trim() }
            : entry,
        ),
      );
      setEditingId(null);
    } else {
      persist([
        {
          id: crypto.randomUUID(),
          setup: setup.trim(),
          result,
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
        },
        ...entries,
      ]);
    }

    setSetup("");
    setNotes("");
    setResult("Win");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const edit = (entry: Entry) => {
    setEditingId(entry.id);
    setSetup(entry.setup);
    setResult(entry.result);
    setNotes(entry.notes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSetup("");
    setNotes("");
    setResult("Win");
  };

  const remove = (id: string) => {
    if (!window.confirm("Delete this journal entry? This cannot be undone.")) return;
    persist(entries.filter((entry) => entry.id !== id));
    if (editingId === id) cancelEdit();
  };

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">JOURNAL</div>
        <h1 className="title">Trading Journal</h1>
        <p className="muted">
          Record your trades, outcomes and lessons. Journal data is stored in this browser for the Preview test.
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <input
            className="coach-question"
            value={setup}
            onChange={(e) => setSetup(e.target.value)}
            placeholder="Instrument / setup"
          />
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            <option>Win</option>
            <option>Loss</option>
            <option>Break Even</option>
          </select>
          <textarea
            className="coach-question"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Trade notes..."
            rows={6}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="primary" type="button" onClick={save}>
              {editingId ? "Update Journal Entry" : "Save Journal Entry"}
            </button>
            {editingId && (
              <button className="secondary" type="button" onClick={cancelEdit}>
                Cancel Edit
              </button>
            )}
          </div>
          {saved && <div className="condition-box">Journal entry saved.</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-label">RECENT ENTRIES</div>
        {entries.length === 0 ? (
          <p className="muted">No journal entries yet.</p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="condition-box" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <strong>{entry.setup || "Untitled setup"} — {entry.result}</strong>
                  <p style={{ whiteSpace: "pre-wrap" }}>{entry.notes}</p>
                  <small className="muted">{new Date(entry.createdAt).toLocaleString()}</small>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="secondary" type="button" onClick={() => edit(entry)}>Edit</button>
                  <button className="secondary" type="button" onClick={() => remove(entry.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
