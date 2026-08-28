import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./index.css";
import { AppLayout, RequireAuth } from "./App";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Staff from "./pages/Staff";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Coupons from "./pages/Coupons";
import Appointments from "./pages/Appointments";
import Orders from "./pages/Orders";
import Push from "./pages/Push";
import Settings from "./pages/Settings";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "appointments", element: <Appointments /> },
      { path: "orders", element: <Orders /> },
      { path: "services", element: <Services /> },
      { path: "staff", element: <Staff /> },
      { path: "products", element: <Products /> },
      { path: "categories", element: <Categories /> },
      { path: "coupons", element: <Coupons /> },
      { path: "push", element: <Push /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
