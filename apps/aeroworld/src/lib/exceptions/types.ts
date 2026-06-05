export interface ApiExceptionObject {
  ok: false;
  code: string;
  httpCode: number;
  message: string;
  details?: any;
}