export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: any;
  partition?: number;
  timestamp?: number;
}