import prisma from './prisma';

export async function publishTeamNews(
  teamId: number,
  subject: string,
  body: string,
  options?: { excludeRecipientIds?: number[] }
): Promise<void> {
  const members = await prisma.teamMember.findMany({
    where: { team_id: teamId },
    select: { user_id: true },
  });

  const excluded = new Set(options?.excludeRecipientIds ?? []);
  const recipientIds = [...new Set(members.map((member) => member.user_id).filter((id) => !excluded.has(id)))];

  if (recipientIds.length === 0) return;

  await prisma.message.createMany({
    data: recipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      category: 'teams',
      subject,
      body,
      reference_id: teamId,
    })),
  });
}

export async function publishTeamNewsToTeams(
  teamIds: number[],
  subject: string,
  body: string,
  options?: { excludeRecipientIds?: number[] }
): Promise<void> {
  const uniqueTeamIds = [...new Set(teamIds.filter((id): id is number => Number.isFinite(id)))];
  for (const teamId of uniqueTeamIds) {
    await publishTeamNews(teamId, subject, body, options);
  }
}
