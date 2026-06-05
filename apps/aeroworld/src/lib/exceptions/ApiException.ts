import { NextResponse } from "next/server";
import { Exceptions, ExceptionKey } from "./Exceptions";
import { ApiExceptionObject } from "./types";

export function ApiException(code: ExceptionKey, details?: any) {
  const err = Exceptions[code];

  const body: ApiExceptionObject = {
    ok: false,
    code,
    httpCode: err.httpCode,
    message: err.message,
    ...(details ? { details } : {}),
  };

  return NextResponse.json(body, { status: err.httpCode });
}