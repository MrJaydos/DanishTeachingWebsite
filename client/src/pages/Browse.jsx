import { useEffect, useState } from "react";
import { api } from "../api.js";
import AudioButton from "../components/AudioButton.jsx";

export default function Browse() {
  const [decks, setDecks] = useState(null);
  const [selected, setSelected] = useState(null); // deck object
  const [cards, setCards] = useState(null);
  const [error, setError] = useState(null);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  async function loadDecks() {
    try {
      const { decks } = await api.decks();
      setDecks(decks);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadDecks();
  }, []);

  async function openDeck(deck) {
    setSelected(deck);
    setCards(null);
    try {
      const { cards } = await api.cards(deck.id);
      setCards(cards);
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteDeck(deck) {
    if (!confirm(`Delete deck "${deck.name}" and all its cards?`)) return;
    await api.deleteDeck(deck.id);
    setSelected(null);
    setCards(null);
    loadDecks();
  }

  async function deleteCard(card) {
    if (!confirm("Delete this card?")) return;
    await api.deleteCard(card.id);
    setCards((prev) => prev.filter((c) => c.id !== card.id));
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!decks) return <div className="spinner" />;

  // ----- Deck detail view -----
  if (selected) {
    return (
      <div>
        <div className="spread" style={{ marginBottom: 20 }}>
          <div>
            <button className="btn" onClick={() => setSelected(null)}>
              ← All decks
            </button>
          </div>
          <div className="row">
            {selected.isCustom && (
              <>
                <button className="btn" onClick={() => setShowCardModal(true)}>
                  + Add card
                </button>
                <button className="btn" onClick={() => deleteDeck(selected)}>
                  Delete deck
                </button>
              </>
            )}
          </div>
        </div>

        <h1>{selected.name}</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          <span className={`cat ${selected.category}`}>{selected.category}</span>
          {selected.isCustom ? " · your custom deck" : " · built-in deck"}
        </p>

        {!cards ? (
          <div className="spinner" />
        ) : cards.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            <p className="muted">No cards yet.</p>
            {selected.isCustom && (
              <button className="btn primary" onClick={() => setShowCardModal(true)}>
                Add your first card
              </button>
            )}
          </div>
        ) : (
          <div className="card">
            {cards.map((c) => (
              <div className="card-list-item" key={c.id}>
                <AudioButton text={c.danishText} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="da">{c.danishText}</div>
                  <div className="en">{c.englishText}</div>
                  {c.exampleSentence && (
                    <div className="muted" style={{ fontSize: "0.82rem", fontStyle: "italic" }}>
                      {c.exampleSentence}
                    </div>
                  )}
                </div>
                {c.progress?.repetitions > 0 && <span className="badge">learned</span>}
                {c.isCustom && (
                  <button className="icon-btn" title="Delete card" onClick={() => deleteCard(c)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {showCardModal && (
          <CardModal
            deck={selected}
            onClose={() => setShowCardModal(false)}
            onCreated={(card) => {
              setCards((prev) => [...(prev || []), card]);
              setShowCardModal(false);
            }}
          />
        )}
      </div>
    );
  }

  // ----- Deck grid view -----
  const customDecks = decks.filter((d) => d.isCustom);
  const builtInDecks = decks.filter((d) => !d.isCustom);

  return (
    <div>
      <div className="spread">
        <div>
          <p className="section-title">Decks & cards</p>
          <h1>Browse</h1>
        </div>
        <button className="btn primary" onClick={() => setShowDeckModal(true)}>
          + New deck
        </button>
      </div>

      <DeckGrid decks={builtInDecks} title="Built-in decks" onOpen={openDeck} />
      <DeckGrid
        decks={customDecks}
        title="Your decks"
        onOpen={openDeck}
        emptyHint="Create a deck to add your own cards."
      />

      {showDeckModal && (
        <DeckModal
          onClose={() => setShowDeckModal(false)}
          onCreated={() => {
            setShowDeckModal(false);
            loadDecks();
          }}
        />
      )}
    </div>
  );
}

function DeckGrid({ decks, title, onOpen, emptyHint }) {
  return (
    <div style={{ marginTop: 28 }}>
      <p className="section-title">{title}</p>
      {decks.length === 0 ? (
        <p className="muted">{emptyHint || "Nothing here yet."}</p>
      ) : (
        <div className="deck-grid">
          {decks.map((d) => (
            <div className="card deck-card" key={d.id} onClick={() => onOpen(d)}>
              <span className={`cat ${d.category}`}>{d.category}</span>
              <span className="name">{d.name}</span>
              {d.description && (
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {d.description}
                </span>
              )}
              <span className="meta">
                {d.cardCount} card{d.cardCount === 1 ? "" : "s"}
                {d.dueCount > 0 && ` · ${d.dueCount} due`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeckModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("vocab");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createDeck({ name, category, description });
      onCreated();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="New deck">
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>Deck name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="vocab">Vocab</option>
            <option value="grammar">Grammar</option>
            <option value="listening">Listening</option>
          </select>
        </div>
        <div className="field">
          <label>Description (optional)</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Creating…" : "Create deck"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CardModal({ deck, onClose, onCreated }) {
  const [danishText, setDanish] = useState("");
  const [englishText, setEnglish] = useState("");
  const [exampleSentence, setExample] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { card } = await api.createCard({
        deckId: deck.id,
        danishText,
        englishText,
        exampleSentence,
      });
      onCreated({ ...card, isCustom: true, progress: null });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Add card to ${deck.name}`}>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>Danish</label>
          <input className="input" value={danishText} onChange={(e) => setDanish(e.target.value)} required />
        </div>
        <div className="field">
          <label>English</label>
          <input className="input" value={englishText} onChange={(e) => setEnglish(e.target.value)} required />
        </div>
        <div className="field">
          <label>Example / note (optional)</label>
          <textarea
            className="input"
            rows={2}
            value={exampleSentence}
            onChange={(e) => setExample(e.target.value)}
          />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Adding…" : "Add card"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: 18 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
