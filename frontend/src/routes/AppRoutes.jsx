import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useNavigate,
  Navigate,
} from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import Loader from "../components/common/Loader";
import useAuth from "../hooks/useAuth";

import AdminRoute from "./AdminRoute";
import { getNotificationPath } from "../utils/notificationNavigation";
import notificationService from "../services/notificationService";

const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const VerifyEmail = lazy(() => import("../pages/auth/VerifyEmail"));
const Home = lazy(() => import("../pages/Home"));
const ForYou = lazy(() => import("../pages/ForYou"));
const Profile = lazy(() => import("../pages/Profile"));
const EditProfile = lazy(() => import("../pages/EditProfile"));
const FriendRequests = lazy(() => import("../pages/FriendRequests"));
const Notifications = lazy(() => import("../pages/Notifications"));
const Search = lazy(() => import("../pages/Search"));
const Explore = lazy(() => import("../pages/Explore"));
const Hashtag = lazy(() => import("../pages/Hashtag"));
const Messages = lazy(() => import("../pages/Messages"));
const PostDetail = lazy(() => import("../pages/PostDetail"));
const Settings = lazy(() => import("../pages/Settings"));
const SocialHub = lazy(() => import("../pages/SocialHub"));
const NotFound = lazy(() => import("../pages/NotFound"));
const CreateContent = lazy(() => import("../pages/CreateContent"));
const StoryViewer = lazy(() => import("../pages/StoryViewer"));
const Stories = lazy(() => import("../pages/Stories"));
const HelpSupport = lazy(() => import("../pages/HelpSupport"));
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("../pages/admin/AdminUsers"));
const AdminUserDetails = lazy(() => import("../pages/admin/AdminUserDetails"));
const AdminReports = lazy(() => import("../pages/admin/AdminReports"));
const AdminReportDetails = lazy(() => import("../pages/admin/AdminReportDetails"));
const AdminPosts = lazy(() => import("../pages/admin/AdminPosts"));
const AdminSettings = lazy(() => import("../pages/admin/AdminSettings"));
const PrivacyPolicy = lazy(() => import("../pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("../pages/TermsOfService"));
const DeleteAccount = lazy(() => import("../pages/DeleteAccount"));
const Billing = lazy(() => import("../pages/Billing"));
const Suggestions = lazy(() => import("../pages/Suggestions"));
const MainLayout = lazy(() => import("../layouts/MainLayout"));
const SearchLayout = lazy(() => import("../layouts/SearchLayout"));
const AuthLayout = lazy(() => import("../layouts/AuthLayout"));
const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const LegalLayout = lazy(() => import("../layouts/LegalLayout"));

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
      <Suspense fallback={<Loader />}>
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
          <Route element={<SearchLayout />}>
            <Route path="/search" element={<Search />} />
            <Route path="/search/profile/:id" element={<Profile />} />
            <Route path="/search/posts/:id" element={<PostDetail />} />
          </Route>

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
            <Route
              path="/marketplace"
              element={<Navigate to="/discover?tab=Marketplace" replace />}
            />

          </Route>
        </Route>

        <Route
          path="*"
          element={<NotFound />}
        />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
