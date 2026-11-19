export type Location = {
  id: string;
  key: string;
  name: string;
  locationType: string;
  town: string;
  region: string;
};
export type InventoryEntry = {
  id: string;
  version: number;
  key?: string;
  sku: string;
  channelKey: string;
};
export type Service = {
  sku: string;
  name: string;
  family: string;
  durationMins: number;
  formats: string[];
};
export type GridCell = {
  startsAt: string;
  endsAt: string;
  capacity: number;
  free: number;
  held: number;
  booked: number;
  busy: number;
};
export type CalendarDay = {
  date: string;
  cells: GridCell[];
  capacity: number;
  free: number;
  used: number;
};
export type HeatRow = {
  key: string;
  name: string;
  type: string;
  town: string;
  days: { date: string; capacity: number; free: number; used: number }[];
};
export type AdminBooking = {
  reference: string;
  sku: string;
  locationKey: string;
  startsAt: string;
  audience: string;
  price: number | null;
  status: string;
  orderId: string | null;
};
