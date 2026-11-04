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
import ForYou from "../pages/ForYou";
import Profile from "../pages/Profile";
import EditProfile from "../pages/EditProfile";
import FriendRequests from "../pages/FriendRequests";
import Notifications from "../pages/Notifications";
import Search from "../pages/Search";
import Explore from "../pages/Explore";
import Hashtag from "../pages/Hashtag";
import Messages from "../pages/Messages";
import PostDetail from "../pages/PostDetail";
import Settings from "../pages/Settings";
import SocialHub from "../pages/SocialHub";
import NotFound from "../pages/NotFound";
import CreateContent from "../pages/CreateContent";
import StoryViewer from "../pages/StoryViewer";
import Stories from "../pages/Stories";
import HelpSupport from "../pages/HelpSupport";
import AdminDashboardPage from "../pages/admin/AdminDashboard";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminUserDetails from "../pages/admin/AdminUserDetails";
import AdminReports from "../pages/admin/AdminReports";
import AdminReportDetails from "../pages/admin/AdminReportDetails";
import AdminPosts from "../pages/admin/AdminPosts";
import AdminSettings from "../pages/admin/AdminSettings";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import TermsOfService from "../pages/TermsOfService";
import DeleteAccount from "../pages/DeleteAccount";
import Billing from "../pages/Billing";
import Suggestions from "../pages/Suggestions";
import useAuth from "../hooks/useAuth";

import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import AdminLayout from "../layouts/AdminLayout";
import AdminRoute from "./AdminRoute";
import LegalLayout from "../layouts/LegalLayout";
import { getNotificationPath } from "../utils/notificationNavigation";
import notificationService from "../services/notificationService";

function PushNotificationNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const openNotifications = (event) => {
      const notification = event.detail || {};
      navigate(getNotificationPath(notification));

      if (notification.notification_id) {
        notificationService
          .markRead(notification.notification_id)
          .then(() => {
            window.dispatchEvent(new Event("ricemarket:notifications-refresh"));
          })
          .catch((error) => {
            console.error("Push notification could not be marked as read:", error);
          });
      }
    };
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
        <Route element={<LegalLayout />}>
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
        </Route>

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
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetails />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/reports/:id" element={<AdminReportDetails />} />
              <Route path="/admin/posts" element={<AdminPosts />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>

          <Route element={<MainLayout />}>

            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/for-you"
              element={<ForYou />}
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
              path="/stories"
              element={<Stories />}
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
              path="/explore"
              element={<Explore />}
            />

            <Route
              path="/hashtag/:tag"
              element={<Hashtag />}
            />

            <Route
              path="/messages"
              element={<Messages />}
            />

            <Route
              path="/posts/:id"
              element={<PostDetail />}
            />

            <Route
              path="/settings"
              element={<Settings />}
            />

            <Route
              path="/billing"
              element={<Billing />}
            />

            <Route
              path="/suggestions"
              element={<Suggestions />}
            />

            <Route
              path="/help-support"
              element={<HelpSupport />}
            />

            <Route
              path="/admin-dashboard"
              element={<Navigate to="/admin" replace />}
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
