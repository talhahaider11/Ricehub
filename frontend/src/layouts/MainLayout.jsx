import Navbar from "../components/navbar/Navbar.jsx";
import Sidebar from "../components/sidebar/Sidebar.jsx";
import PageTransition from "../components/common/PageTransition.jsx";
import MobileLayout from "./MobileLayout.jsx";
import { useLocation } from "react-router-dom";

export default function MainLayout() {
  const { pathname } = useLocation();
  const isMessagesPage = pathname === "/messages";

  return (
    <div className={`app-shell${isMessagesPage ? " messages-shell" : ""}`}>
      {!isMessagesPage && <Navbar />}

      <div className="app-body">
        {!isMessagesPage && <Sidebar />}

        <main className="main-content">
          <PageTransition />
        </main>
      </div>

      {!isMessagesPage && <MobileLayout />}
    </div>
  );
}