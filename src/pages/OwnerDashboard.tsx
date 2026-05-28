import { useMemo, useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import {
  BarChart3, Building2, Users, Star,
  Bed, ShirtIcon, WashingMachine, User, MessageSquare,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import OwnerAnalytics from "@/components/owner/OwnerAnalytics";
import OwnerPropertyManager from "@/components/owner/OwnerPropertyManager";
import OwnerBookingManager from "@/components/OwnerBookingManager";
import OwnerReviewManager from "@/components/owner/OwnerReviewManager";
import OwnerMembers from "@/components/owner/OwnerMembers";
import OwnerLaundryRequests from "@/components/owner/OwnerLaundryRequests";
import OwnerLaundryServices from "@/components/owner/OwnerLaundryServices";
import AddHostelForm from "@/components/owner/AddHostelForm";
import UserProfile from "@/components/user/UserProfile";
import UserChat from "@/components/user/UserChat";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const OwnerDashboard = () => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasLaundryProperties, setHasLaundryProperties] = useState(false);
  const handleRefresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    const loadLaundryEligibility = async () => {
      if (!user) return;
      const { data: hostels } = await supabase
        .from("hostels")
        .select("id")
        .eq("owner_id", user.id);
      const hostelIds = (hostels || []).map((h) => h.id);
      if (!hostelIds.length) {
        setHasLaundryProperties(false);
        return;
      }
      const { data: facilities } = await supabase
        .from("facilities")
        .select("hostel_id, laundry")
        .in("hostel_id", hostelIds)
        .eq("laundry", true);
      setHasLaundryProperties((facilities || []).length > 0);
    };
    loadLaundryEligibility();
  }, [user, refreshKey]);

  const sidebarGroups = useMemo(() => {
    const manageItems = [
      { title: "Properties", url: "/owner/properties", icon: Building2 },
      { title: "Bookings", url: "/owner/bookings", icon: Bed },
      { title: "Members", url: "/owner/members", icon: Users },
      { title: "Chat", url: "/owner/chat", icon: MessageSquare },
      ...(hasLaundryProperties
        ? [
            { title: "Laundry Services", url: "/owner/laundry-services", icon: WashingMachine },
            { title: "Laundry Requests", url: "/owner/laundry", icon: ShirtIcon },
          ]
        : []),
      { title: "Reviews", url: "/owner/reviews", icon: Star },
    ];

    return [
      {
        label: "Overview",
        items: [{ title: "Analytics", url: "/owner", icon: BarChart3 }],
      },
      {
        label: "Manage",
        items: manageItems,
      },
      {
        label: "Account",
        items: [{ title: "My Profile", url: "/owner/profile", icon: User }],
      },
    ];
  }, [hasLaundryProperties]);

  return (
    <ProtectedRoute allowedRoles={["owner"]} loginPath="/login" unauthorizedPath="/">
      <DashboardLayout
        title="StayNest"
        subtitle="Owner Portal"
        groups={sidebarGroups}
        pageTitle="Owner Dashboard"
        headerRight={<AddHostelForm onSuccess={handleRefresh} />}
      >
        <Routes>
          <Route index element={<OwnerAnalytics key={refreshKey} />} />
          <Route path="properties" element={<OwnerPropertyManager key={refreshKey} />} />
          <Route path="bookings" element={<OwnerBookingManager />} />
          <Route path="members" element={<OwnerMembers />} />
          <Route path="chat" element={<UserChat mode="owner" />} />
          <Route path="laundry-services" element={<OwnerLaundryServices />} />
          <Route path="laundry" element={<OwnerLaundryRequests />} />
          <Route path="reviews" element={<OwnerReviewManager />} />
          <Route path="profile" element={<UserProfile title="My Profile" subtitle="Manage your owner account information" showPreferences={false} />} />
        </Routes>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default OwnerDashboard;
