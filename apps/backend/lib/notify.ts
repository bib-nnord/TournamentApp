import prisma from './prisma';

type SnapshotMember = { userId?: number | null };

type ParticipantLike = {
  user_id?: number | null;
  display_name?: string | null;
  members_snapshot?: unknown;
};

function readSnapshotMembers(snapshot: unknown): SnapshotMember[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.filter((member): member is SnapshotMember => typeof member === 'object' && member !== null);
}

export function notifyUser(recipientId: number, subject: string, body: string, referenceId?: number | null) {
  prisma.user
    .findUnique({ where: { user_id: recipientId }, select: { username: true, display_name: true } })
    .then((user) => {
      const recipientName = user ? user.display_name || user.username : null;
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
    .catch((err: unknown) => console.error('[notify]', err));
}

export function notifyUsers(recipientIds: Array<number | null | undefined>, subject: string, body: string, referenceId?: number | null) {
  const unique = [...new Set(recipientIds.filter((id): id is number => id != null))];
  if (unique.length === 0) return;

  prisma.user
    .findMany({
      where: { user_id: { in: unique } },
      select: { user_id: true, username: true, display_name: true },
    })
    .then((users) => {
      const nameMap = new Map(users.map((user) => [user.user_id, user.display_name || user.username]));
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
    .catch((err: unknown) => console.error('[notify]', err));
}

export function buildNameToUserIds(participants: ParticipantLike[]) {
  const map = new Map<string, number[]>();

  for (const participant of participants) {
    if (participant.user_id && participant.display_name) {
      const name = participant.display_name;
      if (!map.has(name)) map.set(name, []);
      map.get(name)?.push(participant.user_id);
    }

    if (participant.display_name) {
      for (const member of readSnapshotMembers(participant.members_snapshot)) {
        if (member.userId) {
          const teamName = participant.display_name;
          if (!map.has(teamName)) map.set(teamName, []);
          if (!map.get(teamName)?.includes(member.userId)) {
            map.get(teamName)?.push(member.userId);
          }
        }
      }
    }
  }

  return map;
}

export function resolveNamesToUserIds(nameMap: Map<string, number[]>, names: string[]) {
  const ids = new Set<number>();
  for (const name of names) {
    const userIds = nameMap.get(name);
    if (userIds) userIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

export function collectAllUserIds(participants: ParticipantLike[]) {
  const ids = new Set<number>();
  for (const participant of participants) {
    if (participant.user_id) ids.add(participant.user_id);
    for (const member of readSnapshotMembers(participant.members_snapshot)) {
      if (member.userId) ids.add(member.userId);
    }
  }
  return [...ids];
}
