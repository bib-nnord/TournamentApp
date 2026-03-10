const prisma = require('./prisma');

/**
 * Send a tournament notification to a single user.
 * Fire-and-forget — errors are logged but never thrown.
 */
function notifyUser(recipientId, subject, body, referenceId) {
  // Look up recipient name for preservation
  prisma.user.findUnique({ where: { user_id: recipientId }, select: { username: true, display_name: true } })
    .then((user) => {
      const recipientName = user ? (user.display_name || user.username) : null;
      return prisma.message.create({
        data: {
          recipient_id: recipientId,
          recipient_name: recipientName,
          sender_id: null,
          category: 'tournaments',
          subject,
          body,
          reference_id: referenceId ?? null,
        },
      });
    })
    .catch((err) => console.error('[notify]', err));
}

/**
 * Send a tournament notification to multiple users.
 * Deduplicates and filters out null/undefined IDs.
 * Fire-and-forget — errors are logged but never thrown.
 */
function notifyUsers(recipientIds, subject, body, referenceId) {
  const unique = [...new Set(recipientIds.filter((id) => id != null))];
  if (unique.length === 0) return;

  // Look up recipient names for preservation
  prisma.user.findMany({
    where: { user_id: { in: unique } },
    select: { user_id: true, username: true, display_name: true },
  })
    .then((users) => {
      const nameMap = new Map(users.map((u) => [u.user_id, u.display_name || u.username]));
      return prisma.message.createMany({
        data: unique.map((id) => ({
          recipient_id: id,
          recipient_name: nameMap.get(id) ?? null,
          sender_id: null,
          category: 'tournaments',
          subject,
          body,
          reference_id: referenceId ?? null,
        })),
      });
    })
    .catch((err) => console.error('[notify]', err));
}

/**
 * Build a map from display_name → [user_id, ...] for a tournament's participants.
 * Includes direct account participants and team member snapshots.
 */
function buildNameToUserIds(participants) {
  const map = new Map();

  for (const p of participants) {
    // Direct account participant
    if (p.user_id) {
      const name = p.display_name;
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(p.user_id);
    }

    // Team members from snapshot
    if (Array.isArray(p.members_snapshot)) {
      for (const m of p.members_snapshot) {
        if (m.userId) {
          const teamName = p.display_name;
          if (!map.has(teamName)) map.set(teamName, []);
          if (!map.get(teamName).includes(m.userId)) {
            map.get(teamName).push(m.userId);
          }
        }
      }
    }
  }

  return map;
}

/**
 * Resolve participant display names to user IDs using the name map.
 * Returns a flat array of user IDs (deduplicated).
 */
function resolveNamesToUserIds(nameMap, names) {
  const ids = new Set();
  for (const name of names) {
    const userIds = nameMap.get(name);
    if (userIds) userIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

/**
 * Collect all user IDs from a tournament's participants.
 * Includes direct account user_ids and team member snapshot userIds.
 */
function collectAllUserIds(participants) {
  const ids = new Set();
  for (const p of participants) {
    if (p.user_id) ids.add(p.user_id);
    if (Array.isArray(p.members_snapshot)) {
      for (const m of p.members_snapshot) {
        if (m.userId) ids.add(m.userId);
      }
    }
  }
  return [...ids];
}

module.exports = { notifyUser, notifyUsers, buildNameToUserIds, resolveNamesToUserIds, collectAllUserIds };
