import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatPhone } from '@/shared/lib/phone';
import { useAppDispatch } from '@/shared/lib/store';
import { Alert, Button, TextField } from '@/shared/ui';
import { createChatSchema, type CreateChatFormValues } from '../model/createChatSchema';
import { openChatByPhone } from '../model/openChatByPhone';
import styles from './CreateChatForm.module.scss';

interface Props {
  onClose: () => void;
}

/** Новый чат по номеру телефона получателя. */
export function CreateChatForm({ onClose }: Props) {
  const dispatch = useAppDispatch();
  const [warning, setWarning] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateChatFormValues>({
    resolver: zodResolver(createChatSchema),
    defaultValues: { phone: '' },
  });

  const onSubmit = handleSubmit(async ({ phone }) => {
    setWarning(null);
    const result = await dispatch(openChatByPhone(phone));

    if (result.status === 'failed') {
      setError('root', { message: result.error });
    } else if (result.status === 'notRegistered') {
      setError('phone', { message: `Номер ${formatPhone(phone)} не зарегистрирован в MAX.` });
    } else if (result.warning !== null) {
      // Чат создан, но номер проверить не удалось — предупреждаем и оставляем форму открытой.
      setWarning(result.warning);
    } else {
      onClose();
    }
  });

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
      <TextField
        label="Номер телефона получателя"
        placeholder="+7 999 123-45-67"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        autoFocus
        error={errors.phone?.message}
        {...register('phone')}
      />

      {errors.root?.message !== undefined && <Alert>{errors.root.message}</Alert>}
      {warning !== null && <Alert tone="warning">{warning}</Alert>}

      <div className={styles.actions}>
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? 'Проверяем…' : 'Создать чат'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
