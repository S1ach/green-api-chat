# Чат для MAX на GREEN-API

Веб-чат для мессенджера MAX через [GREEN-API](https://green-api.com): вводишь `idInstance`
и `apiTokenInstance`, создаёшь чат по номеру телефона и переписываешься. Тестовое задание
на frontend-разработчика.

Открыть: https://s1ach.github.io/green-api-chat/

Бэкенда нет, браузер ходит в GREEN-API напрямую. Отправка — `SendMessage`, приём —
`ReceiveNotification` + `DeleteNotification`, без вебхуков.

Основа по ТЗ — текстовые сообщения. Отправка файлов, контактов и геопозиции (через скрепку)
добавлена сверх задания.

React 18, TypeScript, Vite, Redux Toolkit + RTK Query, SCSS Modules, Vitest.

![Экран входа](docs/login.png)

![Экран переписки](docs/chat.png)

## Запуск

Нужен Node.js 20+.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # сборка в dist/
npm test
```

Переменные окружения не нужны: `idInstance` и `apiTokenInstance` вводятся в форме входа
и хранятся в `localStorage`. Кнопка «Выйти» удаляет их вместе с историей переписки.

Если запросы к GREEN-API режет сеть или расширение, их можно пустить через dev-прокси:
`VITE_USE_PROXY=1 npm run dev` и в форме входа указать `apiUrl = /green-api`.

## Как пользоваться

1. В [консоли GREEN-API](https://console.green-api.com) создать инстанс для MAX и авторизовать его
   по QR-коду.
2. Скопировать `idInstance` и `apiTokenInstance` в форму, нажать «Войти».
3. «+» → «Новый чат», ввести номер России (+7) или Беларуси (+375) в любом формате.
4. Написать сообщение, `Enter` — отправить. Ответ появится без перезагрузки страницы.

Если входящие не приходят, проверьте настройки инстанса: `webhookUrl` должен быть пустым,
а `incomingWebhook` — включён. Когда `incomingWebhook` выключен, чат показывает предупреждение
с кнопкой «Включить» — она включает настройку сама. `webhookUrl` нужно очистить вручную
в консоли GREEN-API.
