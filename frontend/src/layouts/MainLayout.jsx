import { Outlet } from "react-router-dom";

import Navbar from "../components/navbar/Navbar";
import Sidebar from "../components/sidebar/Sidebar";
import MobileLayout from "./MobileLayout";

export default function MainLayout() {
  return (
    <div className="app-shell">

      <Navbar/>

      <div className="app-body">
        <Sidebar/>

        <main className="main-content">
          <Outlet/>
        </main>
      </div>

      <MobileLayout/>

    </div>
  );
}