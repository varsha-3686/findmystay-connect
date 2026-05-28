import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface HostelOption {
  id: string;
  name: string;
}

interface PeerRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_hostel_owner: boolean;
}

interface GroupMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface DmMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface UserChatProps {
  mode?: "resident" | "owner";
}

const OwnerBadge = () => (
  <Badge className="bg-primary/15 text-primary border border-primary/30 text-[9px] h-4 px-1.5 font-semibold">
    Owner
  </Badge>
);

const UserChat = ({ mode = "resident" }: UserChatProps) => {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState("");
  const [tab, setTab] = useState<"group" | "direct">("group");
  const [loading, setLoading] = useState(true);
  const [peers, setPeers] = useState<PeerRow[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<PeerRow | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, { name: string; isOwner: boolean }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchHostels = useCallback(async () => {
    if (!user) return;
    if (mode === "owner") {
      const { data, error } = await supabase
        .from("hostels")
        .select("id, hostel_name")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .order("hostel_name");
      if (error) { toast.error(error.message); return; }
      setHostels((data || []).map((h) => ({ id: h.id, name: h.hostel_name })));
    } else {
      const { data: memberships, error } = await supabase
        .from("hostel_members")
        .select("hostel_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (error) { toast.error(error.message); return; }
      const ids = [...new Set((memberships || []).map((m) => m.hostel_id))];
      if (!ids.length) { setHostels([]); return; }
      const { data: hostelRows, error: hErr } = await supabase
        .from("hostels")
        .select("id, hostel_name")
        .in("id", ids)
        .order("hostel_name");
      if (hErr) { toast.error(hErr.message); return; }
      setHostels((hostelRows || []).map((h) => ({ id: h.id, name: h.hostel_name })));
    }
  }, [user, mode]);

  const loadHostelChat = useCallback(async (hostelId: string) => {
    const [rosterRes, peersRes] = await Promise.all([
      supabase.rpc("list_active_hostel_roster", { p_hostel_id: hostelId }),
      supabase.rpc("list_active_hostel_peers", { p_hostel_id: hostelId }),
    ]);

    if (rosterRes.error) { toast.error(rosterRes.error.message); return; }
    if (peersRes.error) { toast.error(peersRes.error.message); return; }

    const roster = (rosterRes.data || []) as PeerRow[];
    const allowedIds = new Set(roster.map((r) => r.user_id));

    const map: Record<string, { name: string; isOwner: boolean }> = {};
    roster.forEach((r) => {
      map[r.user_id] = { name: r.full_name || "Member", isOwner: r.is_hostel_owner };
    });
    setNameMap(map);

    const filteredPeers = ((peersRes.data || []) as PeerRow[]).filter(
      (p) => allowedIds.has(p.user_id) && p.user_id !== user?.id
    );
    setPeers(filteredPeers);
  }, [user?.id]);

  const loadGroupMessages = useCallback(async (hostelId: string) => {
    const { data, error } = await supabase
      .from("hostel_group_messages")
      .select("id, sender_id, body, created_at")
      .eq("hostel_id", hostelId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) { toast.error(error.message); return; }
    setGroupMessages((data || []) as GroupMessage[]);
  }, []);

  const loadDmMessages = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from("hostel_dm_messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) { toast.error(error.message); return; }
    setDmMessages((data || []) as DmMessage[]);
  }, []);

  const clearDirectState = useCallback(() => {
    setSelectedPeer(null);
    setConversationId(null);
    setDmMessages([]);
    setDraft("");
  }, []);

  const openConversation = async (peer: PeerRow) => {
    if (!selectedHostelId) return;
    setSelectedPeer(peer);
    setDmMessages([]);
    const { data, error } = await supabase.rpc("ensure_hostel_dm_conversation", {
      p_hostel_id: selectedHostelId,
      p_peer_id: peer.user_id,
    });
    if (error) { toast.error(error.message); return; }
    const convId = data as string;
    setConversationId(convId);
    await loadDmMessages(convId);
  };

  const handleHostelChange = (hostelId: string) => {
    clearDirectState();
    setGroupMessages([]);
    setSelectedHostelId(hostelId);
  };

  useEffect(() => {
    if (!user) return;
    fetchHostels().finally(() => setLoading(false));
  }, [user, fetchHostels]);

  useEffect(() => {
    if (!hostels.length) {
      setSelectedHostelId("");
      return;
    }
    if (!selectedHostelId || !hostels.some((h) => h.id === selectedHostelId)) {
      setSelectedHostelId(hostels[0].id);
    }
  }, [hostels, selectedHostelId]);

  useEffect(() => {
    if (!selectedHostelId || !user) return;
    clearDirectState();
    loadHostelChat(selectedHostelId);
    loadGroupMessages(selectedHostelId);

    const groupChannel = supabase
      .channel(`group-chat-${selectedHostelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hostel_group_messages", filter: `hostel_id=eq.${selectedHostelId}` },
        (payload) => {
          setGroupMessages((prev) => [...prev, payload.new as GroupMessage]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(groupChannel); };
  }, [selectedHostelId, user, loadHostelChat, loadGroupMessages, clearDirectState]);

  useEffect(() => {
    if (!conversationId) return;
    const dmChannel = supabase
      .channel(`dm-chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hostel_dm_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setDmMessages((prev) => [...prev, payload.new as DmMessage]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(dmChannel); };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [groupMessages, dmMessages, tab]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !user || !selectedHostelId) return;
    setSending(true);
    try {
      if (tab === "group") {
        const { error } = await supabase.from("hostel_group_messages").insert({
          hostel_id: selectedHostelId,
          sender_id: user.id,
          body: text,
        });
        if (error) throw error;
      } else {
        if (!conversationId) {
          toast.error("Select someone to message first.");
          return;
        }
        const { error } = await supabase.from("hostel_dm_messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: text,
        });
        if (error) throw error;
      }
      setDraft("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const showOwnerBadge = mode === "resident";

  const renderMessage = (msg: { id: string; sender_id: string; body: string; created_at: string }, mine: boolean) => {
    const info = nameMap[msg.sender_id];
    return (
      <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
          {!mine && (
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <p className="text-[10px] font-medium opacity-70">{info?.name || "Member"}</p>
              {showOwnerBadge && info?.isOwner && <OwnerBadge />}
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
          <p className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {format(new Date(msg.created_at), "h:mm a")}
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hostels.length) {
    return (
      <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
        <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="font-heading font-semibold text-lg mb-1">No chat access yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          {mode === "owner"
            ? "Add an active property to start chatting with your residents."
            : "You need an active hostel membership to join property chats."}
        </p>
        <Link to={mode === "owner" ? "/owner/properties" : "/dashboard/my-hostel"}>
          <Button variant="outline" className="rounded-xl">
            {mode === "owner" ? "Manage properties" : "View my hostel"}
          </Button>
        </Link>
      </div>
    );
  }

  const selectedHostelName = hostels.find((h) => h.id === selectedHostelId)?.name;
  const hostelLabel = mode === "owner" ? "Property" : "Hostel";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Chat
        </h2>
        <p className="text-sm text-muted-foreground">
          Group and direct messages for your {mode === "owner" ? "properties" : "hostels"}.
        </p>
      </div>

      <div className="max-w-xl space-y-2">
        <Label>{hostelLabel}</Label>
        <Select value={selectedHostelId} onValueChange={handleHostelChange}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder={`Pick ${hostelLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {hostels.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Direct messages are limited to residents and the owner at this property.
          {selectedHostelName && ` Showing people at ${selectedHostelName} only.`}
          {hostels.length > 1 && " Use the menu above to switch between separate chats for each listing."}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "group" | "direct")} className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="group" className="rounded-lg gap-1.5">
            <Users className="w-4 h-4" /> House group
          </TabsTrigger>
          <TabsTrigger value="direct" className="rounded-lg gap-1.5">
            <User className="w-4 h-4" /> Direct
          </TabsTrigger>
        </TabsList>

        <TabsContent value="group" className="space-y-4 mt-0">
          <div
            ref={tab === "group" ? scrollRef : undefined}
            className="bg-card rounded-2xl border border-border/50 min-h-[320px] max-h-[420px] overflow-y-auto p-4 space-y-3"
          >
            {groupMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No messages yet. Say hello to your housemates!</p>
            ) : (
              groupMessages.map((m) => renderMessage(m, m.sender_id === user?.id))
            )}
          </div>
        </TabsContent>

        <TabsContent value="direct" className="space-y-4 mt-0">
          <div className="grid md:grid-cols-[220px_1fr] gap-4">
            <div className="bg-card rounded-2xl border border-border/50 p-2 space-y-1 max-h-[420px] overflow-y-auto">
              {peers.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No other residents at this hostel yet.</p>
              ) : (
                peers.map((peer) => (
                  <button
                    key={peer.user_id}
                    type="button"
                    onClick={() => openConversation(peer)}
                    className={`w-full flex items-center gap-2 rounded-xl p-2 text-left text-sm transition-colors ${
                      selectedPeer?.user_id === peer.user_id ? "bg-primary/10" : "hover:bg-secondary/80"
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{(peer.full_name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium truncate">{peer.full_name || "Member"}</p>
                        {showOwnerBadge && peer.is_hostel_owner && <OwnerBadge />}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="flex flex-col min-h-[320px] max-h-[420px]">
              {selectedPeer && (
                <div className="flex items-center gap-2 px-4 py-2 border border-border/50 border-b-0 rounded-t-2xl bg-card">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{(selectedPeer.full_name || "?")[0]}</AvatarFallback>
                  </Avatar>
                  <p className="font-medium text-sm truncate">{selectedPeer.full_name || "Member"}</p>
                  {showOwnerBadge && selectedPeer.is_hostel_owner && <OwnerBadge />}
                </div>
              )}
              <div
                ref={tab === "direct" ? scrollRef : undefined}
                className={`bg-card border border-border/50 flex-1 overflow-y-auto p-4 space-y-3 ${
                  selectedPeer ? "rounded-b-2xl" : "rounded-2xl min-h-[320px]"
                }`}
              >
                {!selectedPeer ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Select a person to start a direct chat.</p>
                ) : dmMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">No messages with {selectedPeer.full_name} yet.</p>
                ) : (
                  dmMessages.map((m) => renderMessage(m, m.sender_id === user?.id))
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {(tab === "group" || selectedPeer) && (
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder={tab === "group" ? "Message the house group…" : `Message ${selectedPeer?.full_name}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="rounded-xl min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button onClick={handleSend} disabled={sending || !draft.trim()} className="rounded-xl shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
};

export default UserChat;
