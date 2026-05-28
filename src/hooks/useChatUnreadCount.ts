import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ChatUnreadMode = "resident" | "owner";

export function useChatUnreadCount(mode: ChatUnreadMode, chatPath: string) {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hostelIds, setHostelIds] = useState<string[]>([]);
  const conversationIdsRef = useRef<Set<string>>(new Set());
  const nameCacheRef = useRef<Record<string, string>>({});
  const onChatPage = location.pathname.startsWith(chatPath);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const { data, error } = await supabase.rpc("get_hostel_chat_unread_count");
    if (error) {
      console.error("get_hostel_chat_unread_count:", error.message);
      return;
    }
    setUnreadCount(typeof data === "number" ? data : 0);
  }, [user]);

  const ensureBaseline = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.rpc("initialize_hostel_chat_read_baseline");
    if (error) {
      console.error("initialize_hostel_chat_read_baseline:", error.message);
    }
  }, [user]);

  const markGroupRead = useCallback(
    async (hostelId: string) => {
      if (!user) return;
      const { error } = await supabase.rpc("mark_hostel_chat_read", {
        p_hostel_id: hostelId,
        p_conversation_id: null,
      });
      if (error) {
        console.error("mark_hostel_chat_read (group):", error.message);
        return;
      }
      await refresh();
    },
    [user, refresh],
  );

  const markDmRead = useCallback(
    async (hostelId: string, conversationId: string) => {
      if (!user) return;
      const { error } = await supabase.rpc("mark_hostel_chat_read", {
        p_hostel_id: hostelId,
        p_conversation_id: conversationId,
      });
      if (error) {
        console.error("mark_hostel_chat_read (dm):", error.message);
        return;
      }
      await refresh();
    },
    [user, refresh],
  );

  const resolveSenderName = useCallback(async (senderId: string) => {
    if (nameCacheRef.current[senderId]) {
      return nameCacheRef.current[senderId];
    }
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", senderId)
      .maybeSingle();
    const name = data?.full_name?.trim() || "Someone";
    nameCacheRef.current[senderId] = name;
    return name;
  }, []);

  const isParticipantConversation = useCallback(
    async (conversationId: string) => {
      if (!user) return false;
      if (conversationIdsRef.current.has(conversationId)) return true;

      const { data } = await supabase
        .from("hostel_dm_conversations")
        .select("id")
        .eq("id", conversationId)
        .or(`participant_low.eq.${user.id},participant_high.eq.${user.id}`)
        .maybeSingle();

      if (data?.id) {
        conversationIdsRef.current.add(data.id);
        return true;
      }
      return false;
    },
    [user],
  );

  const handleIncomingMessage = useCallback(
    async (senderId: string) => {
      if (!user || senderId === user.id) return;

      setUnreadCount((count) => count + 1);

      if (!location.pathname.startsWith(chatPath)) {
        const name = await resolveSenderName(senderId);
        toast.info(`New message from ${name}`);
      }

      await refresh();
    },
    [user, refresh, location.pathname, chatPath, resolveSenderName],
  );

  const loadChatScope = useCallback(async () => {
    if (!user) {
      setHostelIds([]);
      conversationIdsRef.current = new Set();
      return;
    }

    let ids: string[] = [];

    if (mode === "owner") {
      const { data } = await supabase
        .from("hostels")
        .select("id")
        .eq("owner_id", user.id)
        .eq("is_active", true);
      ids = (data || []).map((h) => h.id);
    } else {
      const { data: memberships } = await supabase
        .from("hostel_members")
        .select("hostel_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      ids = [...new Set((memberships || []).map((m) => m.hostel_id))];
    }

    setHostelIds(ids);

    if (!ids.length) {
      conversationIdsRef.current = new Set();
      return;
    }

    const { data: conversations } = await supabase
      .from("hostel_dm_conversations")
      .select("id")
      .in("hostel_id", ids)
      .or(`participant_low.eq.${user.id},participant_high.eq.${user.id}`);

    conversationIdsRef.current = new Set((conversations || []).map((c) => c.id));
  }, [user, mode]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setHostelIds([]);
      return;
    }

    let cancelled = false;

    (async () => {
      await loadChatScope();
      await ensureBaseline();
      if (!cancelled) await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loadChatScope, ensureBaseline, refresh]);

  useEffect(() => {
    if (!user || !hostelIds.length) return;

    const channel = supabase.channel(`chat-unread-${user.id}-${hostelIds.join("-")}`);

    hostelIds.forEach((hostelId) => {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hostel_group_messages",
          filter: `hostel_id=eq.${hostelId}`,
        },
        (payload) => {
          const row = payload.new as { sender_id?: string };
          if (row.sender_id) void handleIncomingMessage(row.sender_id);
        },
      );
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "hostel_dm_messages",
      },
      (payload) => {
        void (async () => {
          const row = payload.new as { sender_id?: string; conversation_id?: string };
          if (!row.conversation_id || !row.sender_id) return;
          const allowed = await isParticipantConversation(row.conversation_id);
          if (!allowed) return;
          await handleIncomingMessage(row.sender_id);
        })();
      },
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, hostelIds, handleIncomingMessage, isParticipantConversation]);

  useEffect(() => {
    if (!user || onChatPage) return;
    void refresh();
  }, [location.pathname, user, refresh, onChatPage]);

  const badge =
    unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined;

  return {
    unreadCount,
    badge,
    refresh,
    markGroupRead,
    markDmRead,
    reloadScope: loadChatScope,
  };
}
