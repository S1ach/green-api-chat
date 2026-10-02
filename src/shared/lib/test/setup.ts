import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { resetRateLimiter } from '@/shared/api';

// Очередь запросов живёт на уровне модуля: без сброса тесты ждали бы слотов друг друга.
beforeEach(() => {
  resetRateLimiter();
});
