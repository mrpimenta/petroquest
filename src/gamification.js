export function xpForAnswer({ correct, firstAttempt = true }) {
  if (!correct) return 2;
  return firstAttempt ? 12 : 7;
}

export function levelFromXp(xp) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  return { level, nextLevelXp: level * level * 100 };
}
