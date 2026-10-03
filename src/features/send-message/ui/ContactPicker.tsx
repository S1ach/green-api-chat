import { useState } from 'react';
import { getApiErrorMessage, useGetContactsQuery, type RemoteContact } from '@/shared/api';
import { formatPhone } from '@/shared/lib/phone';
import { Alert, Avatar, Button, Loader, TextField } from '@/shared/ui';
import type { SharedContact } from '../model/sendMessage';
import styles from './ContactPicker.module.scss';

interface Props {
  onSelect: (contact: SharedContact) => void;
}

function displayName(contact: RemoteContact): string {
  return contact.name || (contact.phone !== null ? formatPhone(contact.phone) : contact.chatId);
}

function matches(contact: RemoteContact, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (text === '') {
    return true;
  }
  const digits = text.replace(/\D/g, '');
  return (
    displayName(contact).toLowerCase().includes(text) ||
    (digits !== '' && contact.phone !== null && contact.phone.includes(digits))
  );
}

// SendContact принимает только контакты аккаунта, поэтому выбираем из GetContacts
export function ContactPicker({ onSelect }: Props) {
  const { data: contacts, error, isFetching, refetch } = useGetContactsQuery();
  const [query, setQuery] = useState('');

  if (contacts === undefined) {
    return error !== undefined && !isFetching ? (
      <Alert
        action={
          <Button variant="ghost" size="xsmall" onClick={() => void refetch()}>
            Повторить
          </Button>
        }
      >
        Не удалось загрузить контакты. {getApiErrorMessage(error)}
      </Alert>
    ) : (
      <Loader label="Загружаем контакты…" />
    );
  }

  if (contacts.length === 0) {
    return (
      <div className={styles.empty}>
        <p>
          В контактах аккаунта MAX пока никого нет. GREEN-API обновляет список с задержкой до 5
          минут.
        </p>
        <Button variant="secondary" onClick={() => void refetch()} isLoading={isFetching}>
          Обновить
        </Button>
      </div>
    );
  }

  const found = contacts.filter((contact) => matches(contact, query));

  return (
    <div className={styles.picker}>
      <TextField
        label="Имя или номер телефона"
        size="medium"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {found.length === 0 ? (
        <p className={styles.notFound}>Ничего не найдено.</p>
      ) : (
        <ul className={styles.list}>
          {found.map((contact) => {
            const name = displayName(contact);
            return (
              <li key={contact.chatId}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => onSelect({ chatId: contact.chatId, name })}
                >
                  <Avatar name={name} seed={contact.chatId} size={40} />
                  <span className={styles.text}>
                    <span className={styles.name}>{name}</span>
                    {contact.phone !== null && contact.name !== '' && (
                      <span className={styles.phone}>{formatPhone(contact.phone)}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
