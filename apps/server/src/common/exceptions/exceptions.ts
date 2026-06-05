export const EXCEPTION_REGISTRY = {
  USERNAME_ALREADY_TAKEN: {
    httpCode: 400,
    message: "Имя пользователя уже занято",
  },

  USER_NOT_FOUND: {
    httpCode: 404,
    message: "Пользователь не найден",
  },

  INVALID_CREDENTIALS: {
    httpCode: 400,
    message: "Не удалось войти. Проверьте логин и пароль",
  },

  UNAUTHORIZED: {
    httpCode: 401,
    message: "Пользователь не авторизован",
  },

  CHAT_NOT_FOUND: {
    httpCode: 404,
    message: "Чат не найден",
  },

  SERVER_ERROR: {
    httpCode: 500,
    message: "Ошибка обработки запроса на сервере",
  },
  MULTIPLE_SENDERS: {
    httpCode: 401,
    message: "Некорректные данные",
  },
  MESSAGE_NOT_FOUND:{
    httpCode: 404,
    message: "Сообщение не найдено",
  }
} as const;

export type ErrorCode = keyof typeof EXCEPTION_REGISTRY;