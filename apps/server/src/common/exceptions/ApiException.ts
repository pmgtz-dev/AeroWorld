import { HttpException } from "@nestjs/common";
import { EXCEPTION_REGISTRY, ErrorCode } from "./exceptions";

export class ApiException extends HttpException {
  constructor(code: ErrorCode, details?: any) {
    const error = EXCEPTION_REGISTRY[code];

    super(
      {
        ok: false,
        code,
        message: error.message,
        details: details ?? null,
      },
      error.httpCode,
    );
  }
}