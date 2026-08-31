/**
 * Removes the `passwordHash` field from any user object before it is
 * serialized into an API response.
 *
 * Applied at every User-returning boundary to guarantee that password hashes
 * are never exposed to clients.
 *
 * Satisfies Requirements 1.6, 14.2.
 *
 * @example
 * const user = await prisma.user.findUniqueOrThrow({ where: { id } });
 * return NextResponse.json(stripPasswordHash(user));
 */
export function stripPasswordHash<T extends { passwordHash?: unknown }>(
  user: T
): Omit<T, "passwordHash"> {
  // Destructure passwordHash out and return the rest
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _removed, ...safeUser } = user;
  return safeUser as Omit<T, "passwordHash">;
}
