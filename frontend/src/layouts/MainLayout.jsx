import { Outlet } from "react-router-dom";

import Navbar from "../components/navbar/Navbar.jsx";
import Sidebar from "../components/sidebar/Sidebar.jsx";
import MobileLayout from "./MobileLayout.jsx";

export default function MainLayout() {
  return (
    <div className="app-shell">

      <Navbar />

      <div className="app-body">
        <Sidebar />

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <MobileLayout />

    </div>
  );
}