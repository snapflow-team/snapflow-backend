export function createJobId(jobType: string, subscriptionId: number) {
  return `${jobType}-${subscriptionId.toString()}`;
}
