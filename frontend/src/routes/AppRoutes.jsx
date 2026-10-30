import { useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import VerifyEmail from "../pages/auth/VerifyEmail";

import Home from "../pages/Home";
import Profile from "../pages/Profile";
import EditProfile from "../pages/EditProfile";
import Friends from "../pages/Friends";
import FriendRequests from "../pages/FriendRequests";
import Notifications from "../pages/Notifications";
import Search from "../pages/Search";
import Messages from "../pages/Messages";
import Settings from "../pages/Settings";
import SocialHub from "../pages/SocialHub";
import NotFound from "../pages/NotFound";

import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";

function PushNotificationNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const openNotifications = () => navigate("/notifications");
    window.addEventListener("ricemarket:open-notifications", openNotifications);
    return () => {
      window.removeEventListener("ricemarket:open-notifications", openNotifications);
    };
  }, [navigate]);

  return null;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <PushNotificationNavigation />
      <Routes>

        <Route element={<AuthLayout />}>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/verify-email"
            element={<VerifyEmail />}
          />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>

            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/profile/:id"
              element={<Profile />}
            />

            <Route
              path="/profile/edit"
              element={<EditProfile />}
            />

            <Route
              path="/friends"
              element={<Friends />}
            />

            <Route
              path="/friend-requests"
              element={<FriendRequests />}
            />

            <Route
              path="/notifications"
              element={<Notifications />}
            />

            <Route
              path="/search"
              element={<Search />}
            />

            <Route
              path="/messages"
              element={<Messages />}
            />

            <Route
              path="/settings"
              element={<Settings />}
            />

            <Route
              path="/discover"
              element={<SocialHub />}
            />

          </Route>
        </Route>

        <Route
          path="*"
          element={<NotFound />}
        />

      </Routes>
    </BrowserRouter>
  );
}
