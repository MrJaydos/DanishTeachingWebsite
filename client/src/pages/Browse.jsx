import { useEffect, useState } from "react";
import { api } from "../api.js";
import AudioButton from "../components/AudioButton.jsx";
import { useSettings } from "../context/SettingsContext.jsx";
import { labelFor } from "../studyLanguage.js";

export default function Browse() {
  const { studyLanguage } = useSettings();
  const [decks, setDecks] = useState(null);
  const [selected, setSelected] = useState(null); // deck object
  const [cards, setCards] = useState(null);
  const [error, setError] = useState(null);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState(false);
  const [editingCard, setEditingCard] = useState(null);

  const [search, setSearch] = useState("");
  const [allCards, setAllCards] = useState(null); // lazily loaded, for cross-deck search

  async function loadDecks() {
    try {
      const { decks } = await api.decks({ language: studyLanguage });
      setDecks(decks);
    } catch (e) {
      setError(e.message);
    }
  }

  // Re-fetch and back out of any open deck detail whenever the studied
  // language changes, so Browse never shows a stale cross-language view.
  useEffect(() => {
    setSelected(null);
    setCards(null);
    loadDecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyLanguage]);

  // Fetch the full card list once the user starts searching; invalidated
  // (see invalidateSearchCache) whenever a card/deck is created, edited, or
  // deleted so results don't go stale.
  useEffect(() => {
    if (search.trim() && allCards === null) {
      api
        .cards()
        .then(({ cards }) => setAllCards(cards))
        .catch((e) => setError(e.message));
    }
  }, [search, allCards]);

  function invalidateSearchCache() {
    setAllCards(null);
  }

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
    invalidateSearchCache();
    setSelected(null);
    setCards(null);
    loadDecks();
  }

  async function deleteCard(card) {
    if (!confirm("Delete this card?")) return;
    await api.deleteCard(card.id);
    invalidateSearchCache();
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
                <button className="btn" onClick={() => setEditingDeck(true)}>
                  Edit deck
                </button>
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
                <AudioButton text={c.targetText} langCode={c.language} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="da">{c.targetText}</div>
                  <div className="en">{c.nativeText}</div>
                  {c.exampleSentence && (
                    <div className="muted" style={{ fontSize: "0.82rem", fontStyle: "italic" }}>
                      {c.exampleSentence}
                    </div>
                  )}
                </div>
                {c.progress?.repetitions > 0 && <span className="badge">learned</span>}
                {c.isCustom && (
                  <>
                    <button
                      className="icon-btn"
                      title="Edit card"
                      onClick={() => setEditingCard(c)}
                    >
                      ✎
                    </button>
                    <button className="icon-btn" title="Delete card" onClick={() => deleteCard(c)}>
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {showCardModal && (
          <CardModal
            deck={selected}
            onClose={() => setShowCardModal(false)}
            onSaved={(card) => {
              setCards((prev) => [...(prev || []), card]);
              invalidateSearchCache();
              setShowCardModal(false);
            }}
          />
        )}

        {editingCard && (
          <CardModal
            deck={selected}
            card={editingCard}
            onClose={() => setEditingCard(null)}
            onSaved={(card) => {
              setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...card } : c)));
              invalidateSearchCache();
              setEditingCard(null);
            }}
          />
        )}

        {editingDeck && (
          <DeckModal
            deck={selected}
            onClose={() => setEditingDeck(false)}
            onSaved={(deck) => {
              setSelected((prev) => ({ ...prev, ...deck }));
              invalidateSearchCache();
              setEditingDeck(false);
              loadDecks();
            }}
          />
        )}
      </div>
    );
  }

  // ----- Search results view -----
  const searching = search.trim().length > 0;
  const searchResults = searching
    ? (allCards || []).filter((c) => {
        const q = search.trim().toLowerCase();
        return (
          c.targetText.toLowerCase().includes(q) ||
          c.nativeText.toLowerCase().includes(q) ||
          c.deckName.toLowerCase().includes(q)
        );
      })
    : null;

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

      <input
        className="input search-box"
        style={{ marginTop: 20 }}
        placeholder="Search all cards (either language, or deck name)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {searching ? (
        allCards === null ? (
          <div className="spinner" />
        ) : searchResults.length === 0 ? (
          <p className="muted" style={{ marginTop: 20 }}>
            No cards match “{search.trim()}”.
          </p>
        ) : (
          <div className="card" style={{ marginTop: 20 }}>
            {searchResults.map((c) => (
              <div className="card-list-item" key={c.id}>
                <AudioButton text={c.targetText} langCode={c.language} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="da">{c.targetText}</div>
                  <div className="en">{c.nativeText}</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>{c.deckName}</div>
                </div>
                {c.progress?.repetitions > 0 && <span className="badge">learned</span>}
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <DeckGrid decks={builtInDecks} title="Built-in decks" onOpen={openDeck} />
          <DeckGrid
            decks={customDecks}
            title="Your decks"
            onOpen={openDeck}
            emptyHint="Create a deck to add your own cards."
          />
        </>
      )}

      {showDeckModal && (
        <DeckModal
          language={studyLanguage}
          onClose={() => setShowDeckModal(false)}
          onSaved={() => {
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

// Used for both creating a new deck and editing an existing one — pass a
// `deck` prop to edit it in place.
function DeckModal({ deck, language, onClose, onSaved }) {
  const isEdit = Boolean(deck);
  const [name, setName] = useState(deck?.name || "");
  const [category, setCategory] = useState(deck?.category || "vocab");
  const [description, setDescription] = useState(deck?.description || "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isEdit) {
        const { deck: updated } = await api.updateDeck(deck.id, { name, description });
        onSaved(updated);
      } else {
        await api.createDeck({ name, category, description, language });
        onSaved();
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit deck" : "New deck"}>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>Deck name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Category</label>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isEdit}
            title={isEdit ? "Category can't be changed after creation" : undefined}
          >
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
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create deck"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Used for both creating a new card and editing an existing one — pass a
// `card` prop to edit it in place.
function CardModal({ deck, card, onClose, onSaved }) {
  const isEdit = Boolean(card);
  const [targetText, setTarget] = useState(card?.targetText || "");
  const [nativeText, setNative] = useState(card?.nativeText || "");
  const [exampleSentence, setExample] = useState(card?.exampleSentence || "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isEdit) {
        const { card: updated } = await api.updateCard(card.id, {
          targetText,
          nativeText,
          exampleSentence,
        });
        onSaved(updated);
      } else {
        const { card: created } = await api.createCard({
          deckId: deck.id,
          targetText,
          nativeText,
          exampleSentence,
        });
        onSaved({ ...created, isCustom: true, progress: null });
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit card" : `Add card to ${deck.name}`}>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>{labelFor(deck.language)}</label>
          <input className="input" value={targetText} onChange={(e) => setTarget(e.target.value)} required />
        </div>
        <div className="field">
          <label>English</label>
          <input className="input" value={nativeText} onChange={(e) => setNative(e.target.value)} required />
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
            {busy ? "Saving…" : isEdit ? "Save changes" : "Add card"}
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
