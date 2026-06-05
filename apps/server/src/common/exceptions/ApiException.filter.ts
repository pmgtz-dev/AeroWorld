import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return response.status(status).json(res);
    }

    return response.status(500).json({
      ok: false,
      code: "SERVER_ERROR",
      message: "Неизвестная ошибка сервера",
      details: exception?.message ?? null,
    });
  }
}
