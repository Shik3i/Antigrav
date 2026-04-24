import { UserRound } from 'lucide-react';
import Avatar from '../../../components/Avatar';
import BlackjackCelebration from './BlackjackCelebration';
import ChipStack from './ChipStack';
import PlayingCard from './PlayingCard';
import SettlementToast from './SettlementToast';

function getSeatClass(maxPlayers, seat) {
  return `blackjack-seat blackjack-seat-${maxPlayers}-${seat}`;
}

function SeatControls({
  isLocalPlayer,
  roomState,
  isCurrentTurn,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onChipAdd,
  onBetSubmit,
  pendingBet,
  canDouble,
  canSplit,
  balance
}) {
  if (!isLocalPlayer) return null;

  const isBetting = roomState?.status === 'betting' || roomState?.status === 'waiting';
  const hasEnoughForSplit = balance >= (roomState?.players?.find((player) => player.userId === roomState?.currentPlayerTurn)?.hands[0]?.bet || 0);

  return (
    <div className="blackjack-seat-controls-wrapper">
      {isBetting && (
        <div className="blackjack-chip-tray vertical-side">
          {[1, 5, 25, 100, 500].map((value) => (
            <button
              key={value}
              className="blackjack-casino-chip"
              onClick={() => onChipAdd(value * 100)}
              style={{
                '--chip-color': value >= 500 ? '#7c3aed' : value >= 100 ? '#dc2626' : value >= 25 ? '#ec4899' : value >= 5 ? '#f59e0b' : '#f8fafc',
                color: value >= 25 ? '#fff' : '#111827'
              }}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      {isCurrentTurn && roomState?.status === 'player_turns' && (
        <div className="blackjack-action-column">
          <button className="blackjack-action-btn-long hit" onClick={onHit}>Hit</button>
          <button className="blackjack-action-btn-long stand" onClick={onStand}>Stand</button>
          {canDouble && (
            <button className="blackjack-action-btn-long double" onClick={onDouble}>Double</button>
          )}
          {canSplit && (
            <div style={{ position: 'relative' }}>
              <button
                className="blackjack-action-btn-long split"
                onClick={onSplit}
                disabled={!hasEnoughForSplit}
              >
                Split
              </button>
              {!hasEnoughForSplit && (
                <div style={{ position: 'absolute', top: '100%', right: 0, whiteSpace: 'nowrap', fontSize: '0.65rem', color: '#f87171', marginTop: '4px', fontWeight: 700 }}>
                  Low Balance
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BlackjackSeat({
  player,
  selectedTable,
  roomState,
  settlements,
  isCurrentTurn,
  isLocalPlayer,
  canSelectEmptySeat,
  onSelectEmptySeat,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onChipAdd,
  onChipSub,
  onBetSubmit,
  pendingBet,
  balance
}) {
  const isWinningSeat = (settlements || []).some((settlement) => Number(settlement.netProfit || 0) > 0);
  const seatClassName = `${getSeatClass(roomState?.maxPlayers || selectedTable, player.visualSeat)}${isCurrentTurn ? ' current-turn' : ''}${isWinningSeat ? ' winner-seat' : ''}${isLocalPlayer ? ' local-seat' : ''}`;

  if (!player.userId) {
    return (
      <div className={`${getSeatClass(roomState?.maxPlayers || selectedTable, player.visualSeat)} blackjack-seat-empty`}>
        <button
          type="button"
          className={`blackjack-seat-empty-shell${canSelectEmptySeat ? ' is-clickable' : ''}`}
          onClick={() => canSelectEmptySeat && onSelectEmptySeat?.(player)}
          disabled={!canSelectEmptySeat}
        >
          <UserRound size={18} />
          <div className="blackjack-seat-empty-title">Open seat</div>
          <div className="blackjack-seat-empty-copy">Seat {player.visualSeat}</div>
        </button>
      </div>
    );
  }

  const activeHand = player.hands?.[player.activeHandIndex] || null;
  const canSplit = player.hands?.length === 1 && player.hands[0].cards?.length === 2 && player.hands[0].cards[0].rank === player.hands[0].cards[1].rank;
  const isBettingPhase = roomState?.status === 'betting' || roomState?.status === 'waiting';

  return (
    <div className={seatClassName}>
      <div className="blackjack-seat-layout-horizontal">
        <SeatControls
          isLocalPlayer={isLocalPlayer}
          roomState={roomState}
          isCurrentTurn={isCurrentTurn}
          onHit={onHit}
          onStand={onStand}
          onDouble={onDouble}
          onSplit={onSplit}
          onChipAdd={onChipAdd}
          onBetSubmit={onBetSubmit}
          pendingBet={pendingBet}
          canDouble={activeHand?.cards?.length === 2}
          canSplit={canSplit}
          balance={balance}
        />

        <div className="blackjack-seat-content">
          <div className="blackjack-seat-box-actual">
            <BlackjackCelebration active={(player.hands || []).some((hand) => hand.blackjack)} />
            {isCurrentTurn && <div className="blackjack-turn-arrow">{isLocalPlayer ? 'YOUR TURN' : 'TURN'}</div>}

            <div className="blackjack-seat-hands">
              {(player.hands || []).map((hand, handIndex) => {
                const isActive = isCurrentTurn && player.activeHandIndex === handIndex;
                return (
                  <div
                    key={`hand-${handIndex}`}
                    className={`blackjack-hand-card-slot ${isActive ? 'active' : ''}`}
                  >
                    <div className="blackjack-hand-header">
                      <div className="blackjack-value-badge blackjack-hand-value-badge">
                        {hand.blackjack ? 'BJ' : hand.value}
                      </div>
                    </div>

                    <div className="blackjack-hand-wrap blackjack-hand-cards">
                      {(hand.cards || []).map((card, index) => (
                        <PlayingCard key={`${handIndex}-${card.code}-${index}`} card={card} index={index} compact />
                      ))}
                    </div>

                    <div
                      className={`blackjack-hand-state${hand.busted ? ' is-busted' : hand.stood ? ' is-stood' : ''}`}
                    >
                      {hand.busted ? 'BUST' : hand.blackjack ? 'BLACKJACK' : hand.stood ? 'STAND' : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {roomState?.status === 'settlement' && <SettlementToast settlements={settlements} />}

            <div className="blackjack-seat-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar user={player} size={38} />
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, lineHeight: 1 }}>
                  <div className="blackjack-seat-name" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                    {player.displayName || player.username}
                  </div>
                  <div className="blackjack-seat-subline" style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                    {isLocalPlayer ? 'You' : player.isBot ? 'Bot' : 'Player'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="blackjack-footer-chips" style={{ minHeight: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              {isBettingPhase && isLocalPlayer && pendingBet > 0 && (
                <ChipStack amount={pendingBet} isPending onClick={() => onChipSub(pendingBet)} />
              )}
              {(!isLocalPlayer || !isBettingPhase || (isLocalPlayer && pendingBet === 0)) && player.currentBet > 0 && (
                <ChipStack amount={player.currentBet} />
              )}
            </div>

            {isBettingPhase && isLocalPlayer && pendingBet > 0 && (
              <button
                className="blackjack-bet-submit-btn"
                onClick={() => onBetSubmit(pendingBet)}
                style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '60px',
                  padding: '8px 20px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(event) => { event.target.style.transform = 'scale(1.08)'; event.target.style.filter = 'brightness(1.1)'; }}
                onMouseLeave={(event) => { event.target.style.transform = 'scale(1)'; event.target.style.filter = 'none'; }}
              >
                DEAL
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
