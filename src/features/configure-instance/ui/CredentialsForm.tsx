import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { DEFAULT_API_URL } from '@/shared/config';
import { useAppDispatch } from '@/shared/lib/store';
import { Alert, Button, TextField } from '@/shared/ui';
import { connectInstance } from '../model/connectInstance';
import { credentialsSchema, type CredentialsFormValues } from '../model/credentialsSchema';
import styles from './CredentialsForm.module.scss';

/** Форма подключения инстанса GREEN-API: данные вводит пользователь, в коде их нет. */
export function CredentialsForm() {
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsFormValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { apiUrl: DEFAULT_API_URL, idInstance: '', apiTokenInstance: '' },
  });

  const onSubmit = handleSubmit(async (credentials) => {
    // При успехе форма размонтируется: приложение переходит к чатам.
    const result = await dispatch(connectInstance(credentials));
    if (!result.ok) {
      setError('root', { message: result.error });
    }
  });

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
      <TextField
        label="apiUrl"
        placeholder={DEFAULT_API_URL}
        autoComplete="off"
        error={errors.apiUrl?.message}
        {...register('apiUrl')}
      />
      <TextField
        label="idInstance"
        placeholder="1101000001"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        error={errors.idInstance?.message}
        {...register('idInstance')}
      />
      <TextField
        label="apiTokenInstance"
        type="password"
        placeholder="Токен из личного кабинета"
        autoComplete="off"
        error={errors.apiTokenInstance?.message}
        {...register('apiTokenInstance')}
      />

      {errors.root?.message !== undefined && <Alert>{errors.root.message}</Alert>}

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? 'Проверяем…' : 'Войти'}
      </Button>
    </form>
  );
}
