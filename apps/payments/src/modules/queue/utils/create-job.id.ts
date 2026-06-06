export function createJobId(jobType: string, userId: number, expireAt: Date) {
  return `${jobType}-${userId.toString()}-${expireAt.toISOString()}`;
}
