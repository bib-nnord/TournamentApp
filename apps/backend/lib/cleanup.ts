import prisma from './prisma';

/**
 * Cleans up expired ghost users and their invite tokens.
 * - Deletes expired GuestInviteTokens
 * - For ghost users with no remaining tokens, nulls out user_id on their
 *   TournamentParticipant rows and deletes the ghost user
 */
export async function cleanupExpiredGhosts(): Promise<void> {
  try {
    // Delete all expired tokens
    await prisma.guestInviteToken.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });

    // Find ghost users with no remaining invite tokens
    const orphanedGhosts = await prisma.user.findMany({
      where: {
        site_role: 'guest',
        guest_invite_tokens: { none: {} },
      },
      select: { user_id: true },
    });

    if (orphanedGhosts.length === 0) return;

    const ghostIds = orphanedGhosts.map((g) => g.user_id);

    // Null out their user_id on tournament participants (keep guest entries intact)
    await prisma.tournamentParticipant.updateMany({
      where: { user_id: { in: ghostIds } },
      data: { user_id: null },
    });

    // Delete the ghost users
    await prisma.user.deleteMany({
      where: { user_id: { in: ghostIds } },
    });

    if (ghostIds.length > 0) {
      console.log(`[cleanup] Removed ${ghostIds.length} expired ghost user(s)`);
    }
  } catch (err) {
    console.error('[cleanup]', err);
  }
}
