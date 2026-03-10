export type PicadoSheet = {
  id: string;
  sheet_date: string;
  sheet_number?: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  vehicle_id?: string | null;
  vehicle_label?: string | null;
  license_plate?: string | null;
  liters_loaded?: number | null;
  observations?: string | null;
  source_type?: string | null;
  trip_count?: number | null;
  total_trip_amount?: number | null;
  driver_amount?: number | null;
  lucas_fee_amount?: number | null;
  diesel_theoretical_amount?: number | null;
  diesel_price_snapshot?: number | null;
  diesel_real_value?: number | null;
  neto_tz_teorico?: number | null;
  neto_tz_real?: number | null;
  trips?: PicadoTrip[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PicadoTrip = {
  id?: string;
  sheet_id?: string;
  trip_number?: string | null;
  distance_km?: number | null;
  total_trip_amount?: number | null;
  driver_amount?: number | null;
  diesel_theoretical_amount?: number | null;
  created_at?: string | null;
};

export type PicadoConfig = {
  id: string;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  vehicleLabel?: string | null;
  driverPaymentPerTrip?: number | null;
  diesel_price?: number | null;
  [key: string]: unknown;
};

export type Anticipo = {
  id: string;
  fecha: string;
  chofer: string;
  monto: number;
  metodo: "EFECTIVO" | "TRANSFERENCIA";
  observacion?: string;
};

export type PicadoSummary = {
  total_trips?: number | null;
  total_trip_amount?: number | null;
  driver_amount?: number | null;
  liters_loaded?: number | null;
  sheet_count?: number | null;
  [key: string]: unknown;
};

export type ApiListResponse<T> = {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
};
