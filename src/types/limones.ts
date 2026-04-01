export interface LimonFinca {
  id: string;
  nombre: string;
  km_distancia: number;
  precio_bins: number;
  precio_granel: number;
  activa: boolean;
  vigente_desde: string;
  created_at: string;
  updated_at: string;
}

export interface LimonPrecioGasoil {
  id: string;
  precio: number;
  proveedor: string;
  vigente_desde: string;
  created_at: string;
}
