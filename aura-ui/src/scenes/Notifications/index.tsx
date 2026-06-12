import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppCard } from "../../components/AppCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SegmentedControl } from "../../components/SegmentedControl";
import { TextLink } from "../../components/TextLink";
import { api } from "../../api/api";
import { useScreenScrollStyle } from "../../styles/screenStyles";
import { useTheme } from "../../theme/ThemeContext";

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
};

function notificationTint(type: string, colors: ReturnType<typeof useTheme>["colors"]) {
  switch (type) {
    case "achievement":
      return { backgroundColor: colors.chipYellow, textColor: colors.warning, icon: "trophy-outline" as const };
    case "task":
      return { backgroundColor: colors.chipBlue, textColor: colors.primary, icon: "checkbox-outline" as const };
    case "ai":
      return { backgroundColor: colors.chipPurple, textColor: colors.secondary, icon: "sparkles-outline" as const };
    default:
      return { backgroundColor: colors.chipGreen, textColor: colors.success, icon: "calendar-outline" as const };
  }
}

export function NotificationsScreen({
  notifications,
  onBack,
  onMarkAllRead,
  onRefresh,
}: {
  notifications: NotificationItem[];
  onBack: () => void;
  onMarkAllRead: () => void;
  onRefresh?: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const scrollStyle = useScreenScrollStyle();
  const [tab, setTab] = useState("All");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!onRefresh) return;
      setLoading(true);
      try {
        await onRefresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [onRefresh]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        notificationRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
        notificationIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
        title: { fontSize: 15, fontWeight: "800", color: colors.text },
        body: { color: colors.muted, lineHeight: 22, marginTop: 4, fontSize: 14 },
        helper: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
        unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
        empty: { textAlign: "center", color: colors.muted, paddingVertical: 24, fontWeight: "600" },
      }),
    [colors],
  );

  const visibleNotifications = tab === "Unread" ? notifications.filter((item) => !item.read) : notifications;

  return (
    <ScrollView contentContainerStyle={scrollStyle}>
      <ScreenHeader
        title="Notifications"
        subtitle={loading ? "Updating…" : "Stay updated with your progress"}
        onBack={onBack}
        rightAction={<TextLink label="Mark all read" onPress={onMarkAllRead} />}
      />

      <SegmentedControl options={["All", "Unread"]} value={tab} onChange={setTab} />

      <View style={{ gap: 16 }}>
        {visibleNotifications.length === 0 ? (
          <Text style={styles.empty}>No notifications yet. Check back after you complete tasks or visit the dashboard.</Text>
        ) : null}
        {visibleNotifications.map((notification) => {
          const tint = notificationTint(notification.type, colors);
          return (
            <AppCard key={notification.id} style={{ gap: 12 }}>
              <View style={styles.notificationRow}>
                <View style={[styles.notificationIcon, { backgroundColor: tint.backgroundColor }]}>
                  <Ionicons name={tint.icon} size={18} color={tint.textColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{notification.title}</Text>
                  <Text style={styles.body}>{notification.message}</Text>
                  <Text style={styles.helper}>{notification.time}</Text>
                </View>
                {!notification.read ? <View style={styles.unreadDot} /> : null}
              </View>
            </AppCard>
          );
        })}
      </View>
    </ScrollView>
  );
}
