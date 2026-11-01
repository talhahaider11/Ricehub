import { useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useNavigate,
  Navigate,
} from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import VerifyEmail from "../pages/auth/VerifyEmail";

import Home from "../pages/Home";
import Profile from "../pages/Profile";
import EditProfile from "../pages/EditProfile";
import FriendRequests from "../pages/FriendRequests";
import Notifications from "../pages/Notifications";
import Search from "../pages/Search";
import Messages from "../pages/Messages";
import Settings from "../pages/Settings";
import SocialHub from "../pages/SocialHub";
import NotFound from "../pages/NotFound";
import CreateContent from "../pages/CreateContent";
import StoryViewer from "../pages/StoryViewer";
import HelpSupport from "../pages/HelpSupport";
import useAuth from "../hooks/useAuth";

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

function FriendsProfileRedirect() {
  const { user } = useAuth();
  return user?.id ? <Navigate to={`/profile/${user.id}`} replace /> : null;
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
              path="/create"
              element={<CreateContent />}
            />

            <Route
              path="/stories/:id"
              element={<StoryViewer />}
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
              element={<FriendsProfileRedirect />}
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
              path="/help-support"
              element={<HelpSupport />}
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
