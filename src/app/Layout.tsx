import { Outlet } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { BottomNav } from "../components/BottomNav";
import { SideNav } from "../components/SideNav";
import { ToastContainer } from "../components/Toast";

export function Layout() {
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 lg:px-6 lg:pb-6">
          <div className="mx-auto max-w-4xl">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}
