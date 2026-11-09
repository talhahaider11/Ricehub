import Navbar from "../components/navbar/Navbar.jsx";
import Sidebar from "../components/sidebar/Sidebar.jsx";
import PageTransition from "../components/common/PageTransition.jsx";
import MobileLayout from "./MobileLayout.jsx";

export default function MainLayout() {
  return (
    <div className="app-shell">

      <Navbar />

      <div className="app-body">
        <Sidebar />

        <main className="main-content">
          <PageTransition />
        </main>
      </div>

      <MobileLayout />

    </div>
  );
}