import React from "react";
import { useAuth } from "./auth";
import LoginPage from "../pages/LoginPage";
import SettingsPage from "../pages/SettingsPage";
import ReportsPage from "../pages/ReportsPage";
import KitchenOrdersPage from "../pages/KitchenOrdersPage";
import CompletedOrdersPage from "../pages/CompletedOrdersPage";
import POSRegister from "../App"; // cashier screen



export default function AppShell() {
  const { user, logout } = useAuth();
  const [hash, setHash] = React.useState<string>(
    typeof window !== "undefined" && window.location.hash
      ? window.location.hash
      : "#/register"
  );

  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/register");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  

  if (!user) return <LoginPage />;

  const page = hash.replace(/^#\/?/, "");
  const canAccessSettings = user.role === "ADMIN" || user.role === "MANAGER";
  const canAccessKitchen = canAccessSettings;

  const NavLink = ({
    to,
    children,
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a
      href={`#/${to}`}
      className={`underline-offset-4 hover:underline ${
        page === to ? "font-semibold" : ""
      }`}
      onClick={(e) => {
        e.preventDefault();
        window.location.hash = `/${to}`;
      }}
    >
      {children}
    </a>
  );
  

  return (
    <div className="min-h-screen">
      <header className="p-3 flex items-center gap-4 bg-white shadow print:hidden">
        <div className="font-semibold">POS</div>
        <nav className="flex gap-3 text-sm">
          <NavLink to="register">Register</NavLink>
          <NavLink to="completed">Completed</NavLink>
          {canAccessKitchen && <NavLink to="kitchen">Kitchen</NavLink>}
          {canAccessSettings && <NavLink to="reports">Reports</NavLink>}
          {canAccessSettings && <NavLink to="settings">Settings</NavLink>}
        </nav>
        <div className="ml-auto text-sm">
          {user.name} • {user.role}
          <button className="ml-3 underline" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="p-4">
        {page === "completed" ? (
          <CompletedOrdersPage />
        ) : page === "kitchen" ? (
          canAccessKitchen ? <KitchenOrdersPage /> : <div className="text-red-600">Forbidden</div>
        ) : page === "reports" ? (
          canAccessSettings ? <ReportsPage /> : <div className="text-red-600">Forbidden</div>
        ) : page === "settings" ? (
          canAccessSettings ? <SettingsPage /> : <div className="text-red-600">Forbidden</div>
        ) : (
          <POSRegister />
        )}
      </main>
    </div>
  );
}
