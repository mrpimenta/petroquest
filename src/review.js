import { APP_CONFIG } from './config.js';

const DAY = 86_400_000;

export function scheduleReview(previous = {}, quality = 0) {
  const currentStep = Number(previous.step || 0);
  const passed = quality >= 3;
  const step = passed ? Math.min(currentStep + 1, APP_CONFIG.reviewIntervalsDays.length - 1) : 0;
  const intervalDays = APP_CONFIG.reviewIntervalsDays[step];
  return {
    step,
    quality,
    intervalDays,
    dueAt: new Date(Date.now() + intervalDays * DAY).toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function dueReviews(reviews) {
  const now = Date.now();
  return Object.entries(reviews || {}).filter(([, item]) => Date.parse(item.dueAt) <= now).map(([id]) => id);
}
