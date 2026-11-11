export interface ClassInfo {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreateClassRequest {
  name: string;
  totalSeats: number;
}

export interface CreateClassResponse {
  id: string;
  name: string;
  totalSeats: number;
}

export interface HoldCreatedResponse {
  holdId: string;
  classId: string;
  studentId: string;
  status: 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | string;
  expiresAt: string;
  className: string;
  serverTime: string;
}

export interface HoldDetailsResponse {
  holdId: string;
  classId: string;
  status: 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | string;
  expiresAt: string;
  className: string;
  serverTime: string;
}

export interface ConfirmHoldResponse {
  holdId: string;
  status: string;
}

export interface MyHoldResponse {
  holdId: string;
  classId: string;
  className: string;
  status: 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | string;
  expiresAt: string;
}
