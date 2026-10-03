import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { DEFAULT_API_URL } from '@/shared/config';
import { useAppDispatch } from '@/shared/lib/store';
import { Alert, Button, TextField } from '@/shared/ui';
import { connectInstance } from '../model/connectInstance';
import { credentialsSchema, type CredentialsFormValues } from '../model/credentialsSchema';
import styles from './CredentialsForm.module.scss';

export function CredentialsForm() {
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsFormValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { apiUrl: DEFAULT_API_URL, mediaUrl: '', idInstance: '', apiTokenInstance: '' },
  });

  const onSubmit = handleSubmit(async ({ mediaUrl, ...credentials }) => {
    // пустой mediaUrl не сохраняем
    const result = await dispatch(
      connectInstance(mediaUrl === '' ? credentials : { ...credentials, mediaUrl }),
    );
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
        label="mediaUrl — для отправки файлов, необязательно"
        placeholder="https://media.green-api.com"
        autoComplete="off"
        error={errors.mediaUrl?.message}
        {...register('mediaUrl')}
      />
      <TextField
        label="idInstance"
        placeholder="3100000001"
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

      <Button type="submit" size="medium" stretched isLoading={isSubmitting}>
        Войти
      </Button>
    </form>
  );
}
