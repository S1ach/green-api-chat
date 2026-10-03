import { ArrowUp, FileText, X } from 'lucide-react';
import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { MAX_MESSAGE_LENGTH } from '@/shared/config';
import { useAppDispatch } from '@/shared/lib/store';
import { IconButton, Modal } from '@/shared/ui';
import { formatFileSize, validateFile } from '../lib/file';
import {
  sendContactMessage,
  sendFileMessage,
  sendLocationMessage,
  sendTextMessage,
  type Coordinates,
  type SharedContact,
} from '../model/sendMessage';
import { AttachMenu } from './AttachMenu';
import { ContactPicker } from './ContactPicker';
import { LocationForm } from './LocationForm';
import styles from './MessageInput.module.scss';

interface Props {
  chatId: string;
}

const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 200;
const MAX_HEIGHT_PX = 160;

export function MessageInput({ chatId }: Props) {
  const dispatch = useAppDispatch();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'contact' | 'location' | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmed = text.trim();
  const canSend = trimmed !== '' || file !== null;

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input !== null) {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, MAX_HEIGHT_PX)}px`;
    }
  }, [text]);

  const submit = () => {
    if (!canSend) {
      return;
    }
    // поле чистим сразу, чтобы двойной Enter не отправил дважды
    if (file !== null) {
      void dispatch(sendFileMessage(chatId, file, trimmed));
    } else {
      void dispatch(sendTextMessage(chatId, trimmed));
    }
    setText('');
    setFile(null);
    inputRef.current?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter в IME не отправляет
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    // иначе тот же файл нельзя выбрать повторно
    event.target.value = '';
    if (picked === undefined) {
      return;
    }
    const error = validateFile(picked);
    setFileError(error);
    setFile(error === null ? picked : null);
    inputRef.current?.focus();
  };

  const closeDialog = () => {
    setDialog(null);
    inputRef.current?.focus();
  };

  const handleContact = (contact: SharedContact) => {
    void dispatch(sendContactMessage(chatId, contact));
    closeDialog();
  };

  const handleLocation = (coordinates: Coordinates) => {
    void dispatch(sendLocationMessage(chatId, coordinates));
    closeDialog();
  };

  return (
    <div className={styles.composer}>
      {file !== null && (
        <div className={styles.file}>
          <FileText className={styles.fileIcon} size={20} aria-hidden="true" />
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
          <IconButton size="xsmall" onClick={() => setFile(null)} aria-label="Убрать файл">
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>
      )}
      {fileError !== null && (
        <p className={styles.fileError} role="alert">
          {fileError}
        </p>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <AttachMenu
          onFile={() => fileInputRef.current?.click()}
          onContact={() => setDialog('contact')}
          onLocation={() => setDialog('location')}
        />
        <input
          ref={fileInputRef}
          className={styles.fileInput}
          type="file"
          onChange={handleFileChange}
          aria-label="Файл для отправки"
          tabIndex={-1}
        />
        <div className={styles.field}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={file === null ? 'Сообщение' : 'Подпись к файлу'}
            aria-label="Текст сообщения"
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            autoFocus
          />
          {text.length > COUNTER_THRESHOLD && (
            <span className={styles.counter}>
              {text.length} / {MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        <IconButton variant="primary" type="submit" disabled={!canSend} aria-label="Отправить">
          <ArrowUp size={22} strokeWidth={2.4} aria-hidden="true" />
        </IconButton>
      </form>

      {dialog === 'contact' && (
        <Modal title="Отправить контакт" onClose={closeDialog}>
          <ContactPicker onSelect={handleContact} />
        </Modal>
      )}
      {dialog === 'location' && (
        <Modal title="Отправить геопозицию" onClose={closeDialog}>
          <LocationForm onSubmit={handleLocation} onCancel={closeDialog} />
        </Modal>
      )}
    </div>
  );
}
