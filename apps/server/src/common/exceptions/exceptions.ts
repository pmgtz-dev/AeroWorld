export const EXCEPTION_REGISTRY = {
  MISSING_FIELDS: {
    httpCode: 400,
    message: "РќРµ С…РІР°С‚Р°РµС‚ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РґР°РЅРЅС‹С…",
  },

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

  FORBIDDEN: {
    httpCode: 403,
    message: "Недостаточно прав для выполнения действия",
  },

  INVALID_DELETE_SCOPE: {
    httpCode: 400,
    message: "Некорректный тип удаления",
  },

  SERVER_ERROR: {
    httpCode: 500,
    message: "Ошибка обработки запроса на сервере",
  },

  MULTIPLE_SENDERS: {
    httpCode: 401,
    message: "Некорректные данные",
  },

  MESSAGE_NOT_FOUND: {
    httpCode: 404,
    message: "Сообщение не найдено",
  },
  INVALID_FILE_TYPE: {
    httpCode: 400,
    message: "РќСѓР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ С„Р°Р№Р» РёР·РѕР±СЂР°Р¶РµРЅРёСЏ",
  },

  FILE_TOO_LARGE: {
    httpCode: 400,
    message: "Р¤Р°Р№Р» РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ Р±РѕР»СЊС€Рµ 5 РњР‘",
  },
} as const;

export type ErrorCode = keyof typeof EXCEPTION_REGISTRY;
