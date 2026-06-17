export const Exceptions = {
  MISSING_FIELDS: {
    httpCode: 400,
    message: "Все поля обязательны для заполнения",
  },

  USERNAME_ALREADY_TAKEN: {
    httpCode: 409,
    message: "Имя пользователя уже занято",
  },

  PASSWORD_TOO_WEAK: {
    httpCode: 400,
    message: "Пароль слишком слабый",
  },

  UNAUTHORIZED: {
    httpCode: 401,
    message: "Пользователь не авторизован",
  },

  SERVER_ERROR: {
    httpCode: 500,
    message: "Ошибка обработки запроса на сервере",
  },
  USER_DOES_NOT_EXIST: {
    httpCode: 404,
    message: "Пользователя не существует",
  },
  REQUEST_BODY_HAS_MISSING_FIELDS: {
    httpCode: 400,
    message: "Запрос на сервер не содержит нужных данных",
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

export type ExceptionKey = keyof typeof Exceptions;
