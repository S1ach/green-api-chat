import { describe, expect, it } from 'vitest';
import { describeNotification, parseNotification } from './notification';

/** Уведомление по документации GREEN-API для MAX. */
const incomingText = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 3100000000, wid: '79991234567@c.us', typeInstance: 'v3' },
  timestamp: 1763115112,
  idMessage: '1763115112345',
  senderData: {
    chatId: '10000000',
    chatName: 'Иван Петров',
    chatType: 'user',
    sender: '10000000',
    senderName: 'Иван Петров',
    senderContactName: 'Иван П.',
    senderPhoneNumber: 79876543210,
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Привет!', isForwarded: false, forwardingScore: 0 },
  },
};

describe('parseNotification: сообщения', () => {
  it('разбирает входящее текстовое сообщение', () => {
    expect(parseNotification(incomingText)).toEqual({
      kind: 'message',
      message: {
        id: '1763115112345',
        chatId: '10000000',
        direction: 'incoming',
        text: 'Привет!',
        timestamp: 1763115112000,
      },
      chat: { name: 'Иван П.', phone: '79876543210', type: 'user' },
    });
  });

  it('разбирает текст со ссылкой и ответ с цитатой', () => {
    const extended = parseNotification({
      ...incomingText,
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'Ссылка: https://green-api.com', title: 'GREEN-API' },
      },
    });
    const quoted = parseNotification({
      ...incomingText,
      messageData: {
        typeMessage: 'quotedMessage',
        extendedTextMessageData: { text: 'Отвечаю на это', stanzaId: '1164' },
      },
    });

    expect(extended).toMatchObject({ message: { text: 'Ссылка: https://green-api.com' } });
    expect(quoted).toMatchObject({ message: { text: 'Отвечаю на это' } });
  });

  it('не теряет сообщение с файлом: показывает вложение и подпись', () => {
    const parsed = parseNotification({
      ...incomingText,
      messageData: {
        typeMessage: 'imageMessage',
        fileMessageData: {
          downloadUrl: 'https://storage.example/photo.webp',
          caption: 'Схема проезда',
          fileName: 'photo.webp',
          mimeType: 'image/webp',
        },
      },
    });

    expect(parsed).toMatchObject({
      kind: 'message',
      message: {
        text: 'Схема проезда',
        attachment: {
          kind: 'image',
          url: 'https://storage.example/photo.webp',
          name: 'photo.webp',
        },
      },
    });
  });

  it('разбирает геопозицию: координаты и ссылка на карту', () => {
    const parsed = parseNotification({
      ...incomingText,
      messageData: {
        typeMessage: 'locationMessage',
        locationMessageData: { latitude: 51.1035035, longitude: 71.3996933 },
      },
    });

    expect(parsed).toMatchObject({
      message: {
        text: '',
        attachment: {
          kind: 'location',
          url: 'https://yandex.ru/maps/?pt=71.3996933,51.1035035&z=16&l=map',
          name: '51.10350, 71.39969',
        },
      },
    });
  });

  it('геопозицию без координат показывает без ссылки', () => {
    const parsed = parseNotification({
      ...incomingText,
      messageData: { typeMessage: 'locationMessage', locationMessageData: { latitude: 'x' } },
    });

    expect(parsed).toMatchObject({
      message: { attachment: { kind: 'location', url: null, name: null } },
    });
  });

  it('разбирает контакт: имя, а если его нет — номер', () => {
    const named = parseNotification({
      ...incomingText,
      messageData: {
        typeMessage: 'contactMessage',
        contactMessageData: { chatId: '10000001', phoneNumber: 79991112233, displayName: 'Люся' },
      },
    });
    const unnamed = parseNotification({
      ...incomingText,
      messageData: {
        typeMessage: 'contactMessage',
        contactMessageData: { chatId: '10000001', phoneNumber: 79991112233, displayName: '' },
      },
    });

    expect(named).toMatchObject({
      message: { text: '', attachment: { kind: 'contact', url: null, name: 'Люся' } },
    });
    expect(unnamed).toMatchObject({
      message: { attachment: { kind: 'contact', name: '+7 (999) 111-22-33' } },
    });
  });

  it('не пропускает в ссылку вложения ничего, кроме http(s)', () => {
    const parsed = parseNotification({
      ...incomingText,
      messageData: {
        typeMessage: 'documentMessage',
        fileMessageData: { downloadUrl: 'javascript:alert(1)', fileName: 'x.pdf' },
      },
    });

    expect(parsed).toMatchObject({ message: { attachment: { kind: 'document', url: null } } });
  });

  it('разбирает сообщение, отправленное с телефона, как исходящее', () => {
    const parsed = parseNotification({
      ...incomingText,
      typeWebhook: 'outgoingMessageReceived',
      senderData: { ...incomingText.senderData, chatName: 'Иван Петров' },
    });

    expect(parsed).toMatchObject({
      kind: 'message',
      message: { direction: 'outgoing', status: 'sent', chatId: '10000000' },
      // Отправитель исходящего — владелец аккаунта: его номер к чату не относится.
      chat: { name: 'Иван Петров', phone: null },
    });
  });

  it('разбирает сообщение, отправленное через API', () => {
    expect(
      parseNotification({ ...incomingText, typeWebhook: 'outgoingAPIMessageReceived' }),
    ).toMatchObject({ kind: 'message', message: { direction: 'outgoing' } });
  });

  it('для группы берёт название чата, а не имя участника', () => {
    const parsed = parseNotification({
      ...incomingText,
      senderData: {
        chatId: '-69876543210123',
        chatName: 'Команда проекта',
        chatType: 'group',
        senderName: 'Пётр',
        senderPhoneNumber: 0,
      },
    });

    expect(parsed).toMatchObject({
      chat: { name: 'Команда проекта', phone: null, type: 'group' },
    });
  });

  it('не считает номером senderPhoneNumber = 0 (номер скрыт)', () => {
    const parsed = parseNotification({
      ...incomingText,
      senderData: { ...incomingText.senderData, senderPhoneNumber: 0 },
    });

    expect(parsed).toMatchObject({ chat: { phone: null } });
  });

  it('подставляет текущее время, если timestamp отсутствует', () => {
    const parsed = parseNotification({ ...incomingText, timestamp: undefined });

    expect(parsed?.kind === 'message' && parsed.message.timestamp).toBeGreaterThan(0);
  });
});

describe('parseNotification: статусы', () => {
  const status = {
    typeWebhook: 'outgoingMessageStatus',
    chatId: '10000000',
    timestamp: 1755591519,
    idMessage: '115054445839974415',
    status: 'delivered',
    description: '',
  };

  it('разбирает «доставлено» и «прочитано»', () => {
    expect(parseNotification(status)).toEqual({
      kind: 'status',
      chatId: '10000000',
      idMessage: '115054445839974415',
      status: 'delivered',
    });
    expect(parseNotification({ ...status, status: 'read' })).toMatchObject({ status: 'read' });
  });

  it('превращает сбой доставки в ошибку с объяснением', () => {
    expect(parseNotification({ ...status, status: 'noAccount' })).toMatchObject({
      kind: 'status',
      status: 'error',
      error: 'У получателя нет аккаунта MAX.',
    });
  });
});

describe('parseNotification: то, что сообщением не является', () => {
  it('игнорирует служебные уведомления', () => {
    expect(
      parseNotification({ typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' }),
    ).toBeNull();
    expect(parseNotification({ typeWebhook: 'quotaExceeded' })).toBeNull();
  });

  it('игнорирует реакции, правки и удаления', () => {
    for (const typeMessage of ['reactionMessage', 'editedMessage', 'deletedMessage']) {
      expect(parseNotification({ ...incomingText, messageData: { typeMessage } })).toBeNull();
    }
  });

  it('не падает на мусорных данных', () => {
    expect(parseNotification(null)).toBeNull();
    expect(parseNotification('null')).toBeNull();
    expect(parseNotification({})).toBeNull();
    expect(parseNotification({ ...incomingText, senderData: {} })).toBeNull();
    expect(
      parseNotification({ ...incomingText, messageData: { typeMessage: 'textMessage' } }),
    ).toBeNull();
    expect(parseNotification({ typeWebhook: 'outgoingMessageStatus', status: 'read' })).toBeNull();
  });
});

describe('describeNotification', () => {
  it('описывает уведомление для логов без текста сообщения', () => {
    expect(describeNotification(incomingText)).toBe('incomingMessageReceived/textMessage');
    expect(describeNotification({ typeWebhook: 'stateInstanceChanged' })).toBe(
      'stateInstanceChanged',
    );
    expect(describeNotification(null)).toBe('unknown');
  });
});
