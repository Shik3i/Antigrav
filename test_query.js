const db = require('./database/connection');

const friendsQuery = `
  SELECT f.status, f.userId AS requesterId, f.friendId AS targetId,
    u.id, u.displayName, u.username
  FROM Friends f
  JOIN Users u ON u.id = f.friendId
  WHERE f.userId = ? AND (f.status = 'accepted' OR f.status = 'pending')
  UNION
  SELECT f.status, f.userId AS requesterId, f.friendId AS targetId,
    u.id, u.displayName, u.username
  FROM Friends f
  JOIN Users u ON u.id = f.userId
  WHERE f.friendId = ? AND (f.status = 'accepted' OR f.status = 'pending')
`;

const result = db.prepare(friendsQuery).all('2ca1d6d3-7218-488f-9321-2f0f1531cca9', '2ca1d6d3-7218-488f-9321-2f0f1531cca9');
console.log('Query result:', result);