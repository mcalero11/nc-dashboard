export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface HealthCheckResponse {
  status: string;
  redis: string;
  uptime: number;
}
