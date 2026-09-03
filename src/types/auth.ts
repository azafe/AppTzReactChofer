export type DriverAccount = {
  id: string;        // UUID from choferes table — used for registro_viajes.chofer_id
  driverId: string;  // driver_id TEXT field — used for picado compatibility
  name: string;
  username: string;
  vehicleLabel?: string;
  vehicleId?: string;
  modulos: string[];
};

export type LoginResult = { ok: true } | { ok: false; error: string };
