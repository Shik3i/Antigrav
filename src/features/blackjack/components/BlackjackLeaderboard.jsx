import { Loader2, Trophy } from 'lucide-react';
import Avatar from '../../../components/Avatar';
import { formatKC } from '../utils/formatters';

export default function BlackjackLeaderboard({ rows, sortBy, setSortBy, loading }) {
  return (
    <section className="blackjack-surface blackjack-surface-board">
      <div className="blackjack-surface-header">
        <div>
          <div className="blackjack-surface-title">
            <Trophy size={18} />
            Blackjack Leaderboard
          </div>
          <div className="blackjack-surface-copy">Aggregierte Stats, ohne Hand-History im Backend.</div>
        </div>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="blackjack-sort-select"
        >
          <option value="totalWon">Net Profit</option>
          <option value="gamesPlayed">Games Played</option>
          <option value="blackjacksHit">Blackjacks</option>
          <option value="totalWagered">Total Wagered</option>
        </select>
      </div>

      {loading ? (
        <div className="blackjack-loading-row">
          <Loader2 size={16} className="spin" />
          Leaderboard wird geladen...
        </div>
      ) : (
        <div className="blackjack-grid-list">
          {(rows || []).slice(0, 10).map((row, index) => (
            <div
              key={row.userId}
              className={`blackjack-leaderboard-row${index === 0 ? ' is-top' : ''}`}
            >
              <div className={`blackjack-rank-cell${index < 3 ? ' is-podium' : ''}`}>{index + 1}</div>
              <div className="blackjack-user-cell">
                <Avatar user={{ username: row.username, preferences: typeof row.preferences === 'string' ? JSON.parse(row.preferences || '{}') : (row.preferences || {}) }} size={28} />
                <div className="blackjack-user-copy">
                  <div className="blackjack-user-name">{row.displayName || row.username}</div>
                  <div className="blackjack-user-handle">@{row.username}</div>
                </div>
              </div>
              <div className="blackjack-value-cell">{row.gamesPlayed}</div>
              <div className="blackjack-value-cell">{row.blackjacksHit}</div>
              <div className="blackjack-value-cell">{formatKC(row.totalWagered)}</div>
              <div className={`blackjack-profit-cell${row.totalWon >= 0 ? ' is-positive' : ' is-negative'}`}>{formatKC(row.totalWon)}</div>
            </div>
          ))}
          {!rows?.length && <div className="blackjack-empty-copy">Noch keine Blackjack-Einträge vorhanden.</div>}
        </div>
      )}
    </section>
  );
}
