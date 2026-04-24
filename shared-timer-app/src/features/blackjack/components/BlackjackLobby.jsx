import { Crown } from 'lucide-react';
import { normalizeRoomSlug } from '../utils/formatters';

const TABLE_OPTIONS = [3, 5];

export default function BlackjackLobby({
  actionBusy,
  availableRooms,
  handleAddBot,
  handleRemoveBot,
  handleCreateRoom,
  handleSwitchRoom,
  loadRooms,
  roomDraft,
  roomId,
  selectedTable,
  setCurrentRoomId,
  setRoomDraft,
  setRoomState,
  setSelectedTable
}) {
  const filteredRooms = (availableRooms || []).filter((room) => room.maxPlayers === selectedTable);

  return (
    <section className="blackjack-surface blackjack-surface-dark">
      <div className="blackjack-surface-header">
        <div>
          <div className="blackjack-surface-title">
            <Crown size={18} />
            Blackjack Lobby
          </div>
          <div className="blackjack-surface-copy">
            Mehrere Tische parallel. Aktiv: <strong>{roomId || 'kein Raum'}</strong>
          </div>
        </div>
        <button className="btn-ghost" onClick={loadRooms} disabled={actionBusy}>Tische aktualisieren</button>
      </div>

      <div className="blackjack-lobby-grid">
        <div className="blackjack-card-panel">
          <div className="blackjack-panel-title">Neuen Tisch erstellen</div>
          <div className="blackjack-panel-copy">
            Optionalen Namen angeben oder automatisch erzeugen lassen.
          </div>
          <div className="blackjack-choice-row">
            {TABLE_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setSelectedTable(option);
                  setCurrentRoomId(`blackjack-main-${option}`);
                  setRoomState(null);
                }}
                className={`blackjack-choice-pill${selectedTable === option ? ' is-active' : ''}`}
              >
                {option} Seats
              </button>
            ))}
          </div>
          <input
            value={roomDraft}
            onChange={(event) => setRoomDraft(event.target.value)}
            placeholder="z. B. friday-run"
            className="blackjack-room-input"
          />
          <div className="blackjack-room-slug">
            Raum-ID: <code>{normalizeRoomSlug(roomDraft || 'dein-tisch', selectedTable)}</code>
          </div>
          <button className="btn-primary" onClick={handleCreateRoom} disabled={actionBusy}>
            Tisch erstellen
          </button>
        </div>

        <div className="blackjack-room-list">
          <div className="blackjack-room-list-header">
            <div className="blackjack-panel-title">Offene {selectedTable}er-Tische</div>
          </div>
          {filteredRooms.length === 0 && (
            <div className="blackjack-room-empty">
              Noch kein aktiver Tisch für {selectedTable} Plätze offen.
            </div>
          )}
          {filteredRooms.map((room) => (
            <div
              key={room.roomId}
              className={`blackjack-room-row${String(room.roomId) === String(roomId) ? ' is-active' : ''}`}
            >
              <div>
                <div className="blackjack-room-name">{room.roomId}</div>
                <div className="blackjack-room-status">{room.status}</div>
              </div>
              <div className="blackjack-room-count">{room.connectedCount}/{room.maxPlayers}</div>
              <div className={`blackjack-room-shoe${room.needsShuffle ? ' is-alert' : ''}`}>
                {room.needsShuffle ? 'Reshuffle' : `${room.shoeRemaining} Karten`}
              </div>
              <div className="blackjack-room-actions">
                <button
                  className="btn-ghost"
                  onClick={() => handleAddBot(room.roomId, room.maxPlayers)}
                  disabled={actionBusy || room.connectedCount >= room.maxPlayers}
                >
                  Bot hinzufügen
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => handleRemoveBot(room.roomId)}
                  disabled={actionBusy || !room.occupiedSeats?.some((seat) => seat.isBot)}
                >
                  Bot kicken
                </button>
                <button
                  className={room.roomId === roomId ? 'btn-primary' : 'btn-ghost'}
                  onClick={() => handleSwitchRoom(room.roomId, room.maxPlayers)}
                >
                  {room.roomId === roomId ? 'Aktiv' : 'Beitreten'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
