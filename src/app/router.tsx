import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./Layout";
import { LoginPage } from "../pages/LoginPage";
import { MisViajesPage } from "../pages/MisViajesPage";
import { CargarViajePage } from "../pages/CargarViajePage";
import { AnticiposPage } from "../pages/AnticiposPage";
import { MiPagoPage } from "../pages/MiPagoPage";
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
      { index: true, element: <Navigate to="/mis-viajes" replace /> },
      { path: "mis-viajes", element: <MisViajesPage /> },
      { path: "cargar", element: <CargarViajePage /> },
      { path: "anticipos", element: <AnticiposPage /> },
      { path: "mi-pago", element: <MiPagoPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/mis-viajes" replace />,
  },
]);
