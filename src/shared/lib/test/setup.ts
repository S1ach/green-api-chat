import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { resetRateLimiter } from '@/shared/api';

// очередь запросов живёт на уровне модуля, сбрасываем между тестами
beforeEach(() => {
  resetRateLimiter();
});
