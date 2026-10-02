import { zodResolver } from '@hookform/resolvers/zod';
import { LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, TextField } from '@/shared/ui';
import { getCurrentCoordinates, isGeolocationSupported } from '../lib/geolocation';
import {
  locationSchema,
  type LocationFormInput,
  type LocationFormValues,
} from '../model/locationSchema';
import styles from './LocationForm.module.scss';

interface Props {
  onSubmit: (coordinates: LocationFormValues) => void;
  onCancel: () => void;
}

/** Координаты для SendLocation: вводятся вручную или берутся у браузера. */
export function LocationForm({ onSubmit, onCancel }: Props) {
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LocationFormInput, unknown, LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { latitude: '', longitude: '' },
  });

  const locate = async () => {
    setLocateError(null);
    setIsLocating(true);
    try {
      const { latitude, longitude } = await getCurrentCoordinates();
      setValue('latitude', latitude.toFixed(6), { shouldValidate: true });
      setValue('longitude', longitude.toFixed(6), { shouldValidate: true });
    } catch (error) {
      setLocateError(
        error instanceof Error ? error.message : 'Не удалось определить местоположение.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
    >
      <div className={styles.fields}>
        <TextField
          label="Широта"
          size="medium"
          placeholder="55.7558"
          inputMode="decimal"
          autoComplete="off"
          error={errors.latitude?.message}
          {...register('latitude')}
        />
        <TextField
          label="Долгота"
          size="medium"
          placeholder="37.6173"
          inputMode="decimal"
          autoComplete="off"
          error={errors.longitude?.message}
          {...register('longitude')}
        />
      </div>

      {isGeolocationSupported() && (
        <Button variant="ghost" onClick={() => void locate()} isLoading={isLocating}>
          <span className={styles.locate}>
            <LocateFixed size={18} aria-hidden="true" />
            Моё местоположение
          </span>
        </Button>
      )}
      {locateError !== null && <Alert tone="warning">{locateError}</Alert>}

      <div className={styles.actions}>
        <Button type="submit" stretched>
          Отправить
        </Button>
        <Button variant="secondary" stretched onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
