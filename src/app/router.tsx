import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./Layout";
import { LoginPage } from "../pages/LoginPage";
import { MisViajesPage } from "../pages/MisViajesPage";
import { CargarViajePage } from "../pages/CargarViajePage";
import { AnticiposPage } from "../pages/AnticiposPage";
import { MiPagoPage } from "../pages/MiPagoPage";
import { ZafraCargarPage } from "../pages/ZafraCargarPage";
import { ZafraMisViajesPage } from "../pages/ZafraMisViajesPage";
import { LimonesCargarPage } from "../pages/LimonesCargarPage";
import { LimonesMisViajesPage } from "../pages/LimonesMisViajesPage";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/picado/nuevo" replace /> },
      // Picado
      { path: "picado", element: <Navigate to="/picado/nuevo" replace /> },
      { path: "picado/nuevo", element: <CargarViajePage /> },
      { path: "picado/mis-viajes", element: <MisViajesPage /> },
      // Rutas viejas → redirigen al nuevo esquema
      { path: "mis-viajes", element: <Navigate to="/picado/mis-viajes" replace /> },
      { path: "cargar", element: <Navigate to="/picado/nuevo" replace /> },
      // Zafra
      { path: "zafra", element: <Navigate to="/zafra/nuevo" replace /> },
      { path: "zafra/nuevo", element: <ZafraCargarPage /> },
      { path: "zafra/mis-viajes", element: <ZafraMisViajesPage /> },
      // Limones
      { path: "limones", element: <Navigate to="/limones/nuevo" replace /> },
      { path: "limones/nuevo", element: <LimonesCargarPage /> },
      { path: "limones/mis-viajes", element: <LimonesMisViajesPage /> },
      // Siempre visible
      { path: "anticipos", element: <AnticiposPage /> },
      { path: "mi-pago", element: <MiPagoPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/picado/nuevo" replace />,
  },
]);
