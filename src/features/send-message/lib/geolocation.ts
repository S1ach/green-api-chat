const TIMEOUT_MS = 15_000;

const UNAVAILABLE = 'Не удалось определить местоположение. Введите координаты вручную.';

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error(UNAVAILABLE));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        // 1 — запрещено, 3 — таймаут
        if (error.code === 1) {
          reject(
            new Error('Доступ к местоположению запрещён. Разрешите его в настройках браузера.'),
          );
        } else if (error.code === 3) {
          reject(new Error('Браузер слишком долго определяет местоположение. Попробуйте ещё раз.'));
        } else {
          reject(new Error(UNAVAILABLE));
        }
      },
      { enableHighAccuracy: true, timeout: TIMEOUT_MS },
    );
  });
}
