import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import { TabRoute } from "../../types";
import { tabRoutes } from "../../constants";

function TabIcon({ route, active, color }: { route: TabRoute; active: boolean; color: string }) {
  switch (route) {
    case "dashboard":
      return <Ionicons name={active ? "home" : "home-outline"} size={20} color={color} />;
    case "aiCoach":
      return (
        <Ionicons
          name={active ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
          size={20}
          color={color}
        />
      );
    case "tasks":
      return <MaterialCommunityIcons name="format-list-checks" size={20} color={color} />;
    case "goals":
      return <Ionicons name={active ? "flag" : "flag-outline"} size={20} color={color} />;
    case "profile":
      return <Ionicons name={active ? "person" : "person-outline"} size={20} color={color} />;
  }
}

function tabLabel(route: TabRoute) {
  switch (route) {
    case "dashboard":
      return "Dashboard";
    case "aiCoach":
      return "AI Coach";
    case "tasks":
      return "Tasks";
    case "goals":
      return "Goals";
    case "profile":
      return "Profile";
  }
}

export function BottomTabs({ current, onNavigate }: { current: TabRoute; onNavigate: (route: TabRoute) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabsBar: {
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: 8,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? 14 : 10,
        },
        tabItem: { flex: 1, alignItems: "center", gap: 4 },
        tabIconWrap: {
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
        },
        tabIconWrapActive: { backgroundColor: colors.chipBlue },
        tabLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
        tabLabelActive: { color: colors.primary },
      }),
    [colors],
  );

  return (
    <View style={styles.tabsBar}>
      {tabRoutes.map((route) => {
        const active = current === route;
        const color = active ? colors.primary : colors.muted;
        return (
          <Pressable key={route} onPress={() => onNavigate(route)} style={styles.tabItem}>
            <View style={[styles.tabIconWrap, active ? styles.tabIconWrapActive : undefined]}>
              <TabIcon route={route} active={active} color={color} />
            </View>
            <Text style={[styles.tabLabel, active ? styles.tabLabelActive : undefined]}>{tabLabel(route)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
