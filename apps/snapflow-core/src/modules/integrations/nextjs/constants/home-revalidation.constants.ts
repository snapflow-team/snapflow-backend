export const HOME_REVALIDATION_REDIS_KEYS = {
  posts: 'revalidate:posts_count',
  signups: 'revalidate:signups_count',
} as const;

export const HOME_REVALIDATION_THRESHOLDS = {
  posts: 4,
  signups: 5,
} as const;

export enum HomeRevalidationActivitySource {
  Post = 'post',
  Signup = 'signup',
}
