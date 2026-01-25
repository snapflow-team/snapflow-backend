export interface IBaseResponse<T = any[]> {
  success: boolean;
  statusCode: number;
  code: string;
  message: string;
  errors: T;
  timestamp: string;
  path: string;
  stack?: string;
}
