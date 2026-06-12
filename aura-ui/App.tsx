import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-gesture-handler";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { setTheme } from "./src/theme";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { Route, TabRoute, UserProfile } from "./src/types";
import { initialProfile, tabRoutes } from "./src/constants";
import { NotificationItem } from "./src/scenes/Notifications";

// Components
import { BottomTabs } from "./src/components/BottomTabs";

// Scenes
import { SplashScreen } from "./src/scenes/Splash";
import { SignInScreen } from "./src/scenes/SignIn";
import { SignUpScreen } from "./src/scenes/SignUp";
import { ResetPasswordScreen } from "./src/scenes/ResetPassword";
import { OnboardingScreen } from "./src/scenes/Onboarding";
import { DashboardScreen } from "./src/scenes/Dashboard";
import { AICoachScreen, PendingTaskAnswerPayload } from "./src/scenes/AICoach";
import { TasksScreen } from "./src/scenes/Tasks";
import { GoalsScreen } from "./src/scenes/Goals";
import { ProfileScreen } from "./src/scenes/Profile";
import { SettingsScreen } from "./src/scenes/Settings";
import { NotificationsScreen } from "./src/scenes/Notifications";
import { CalendarScreen } from "./src/scenes/Calendar";
import { CareerTrackScreen } from "./src/scenes/CareerTrack";
import { TermsScreen } from "./src/scenes/Terms";

import { api } from "./src/api/api";

const goalIdToLabel: Record<number, string> = {
  1: "Software Engineer",
  2: "Backend Developer",
  3: "QA Engineer",
  4: "DevOps Engineer",
};

export default function App() {
  const [route, setRoute] = useState<Route>("splash");
  const [tab, setTab] = useState<TabRoute>("dashboard");
  const [user, setUser] = useState<UserProfile>(initialProfile);
  const [tempPassword, setTempPassword] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    language: "English (US)",
  });
  const [termsBackRoute, setTermsBackRoute] = useState<Route>("signup");
  const [pendingAgentTask, setPendingAgentTask] = useState<PendingTaskAnswerPayload | undefined>(undefined);
  const [isReturningUser, setIsReturningUser] = useState(true);

  const clearPendingAgentTask = useCallback(() => {
    setPendingAgentTask(undefined);
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(list);
    } catch {
      setNotifications([]);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const profileData = await api.getUserProfile();
      const pct =
        typeof profileData.skill_score_percent === "number"
          ? profileData.skill_score_percent
          : typeof profileData.current_score === "number"
            ? profileData.current_score
            : 0;
      const readiness =
        typeof profileData.skill_readiness_label === "string"
          ? profileData.skill_readiness_label
          : "";
      setUser({
        firstName: profileData.first_name || "",
        lastName: profileData.last_name || "",
        email: profileData.email,
        university: profileData.university || "",
        degreeProgram: profileData.degree_program || "",
        studyYear: profileData.study_year ? String(profileData.study_year) : "",
        technicalSkillLevel: profileData.technical_skill_level || "",
        softSkillLevel: profileData.soft_skill_level || "",
        availabilityType: profileData.availability_type || "",
        availabilityHours: profileData.availability_hours ? String(profileData.availability_hours) : "",
        goal: goalIdToLabel[profileData.goal_id || 1] || "Software Engineer",
        goalId: profileData.goal_id || 1,
        currentScore: pct,
        skillReadinessLabel: readiness || undefined,
        recommendation: profileData.recommendation ?? "",
        joinedDate: initialProfile.joinedDate,
      });
      return true;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const returning = (await AsyncStorage.getItem("aura_returning_user")) === "1";
      setIsReturningUser(returning);
      const ok = await fetchProfile();
      if (ok) {
        await api.recordCheckIn().catch(() => {});
        await loadNotifications();
        setRoute("dashboard");
      } else {
        setRoute("signin");
      }
    };

    const timer = setTimeout(checkAuth, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("aura_returning_user").then((v) => setIsReturningUser(v === "1"));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("aura_dark_mode").then((v) => {
      if (v === "1") setSettings((s) => ({ ...s, darkMode: true }));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("aura_dark_mode", settings.darkMode ? "1" : "0");
    setTheme(settings.darkMode);
  }, [settings.darkMode]);

  const handleSignIn = async (email?: string, password?: string) => {
    const normalizedEmail = (email ?? "").trim().toLowerCase();
    const passwordValue = password ?? "";
    if (!normalizedEmail || !passwordValue) {
      alert("Enter your email and password to sign in.");
      return;
    }
    try {
      await api.login({ email: normalizedEmail, password: passwordValue });
      await api.recordCheckIn().catch(() => {});
      const ok = await fetchProfile();
      if (ok) {
        await AsyncStorage.setItem("aura_returning_user", "1");
        setIsReturningUser(true);
        await loadNotifications();
        setRoute("dashboard");
      }
    } catch (err) {
      alert("Login failed: " + (err as Error).message);
    }
  };

  const handleSignUp = (email: string, password?: string) => {
    setUser((prev) => ({ ...prev, email }));
    if (password) setTempPassword(password);
    setRoute("onboarding");
  };

  const handleOnboardingComplete = async (profile: any) => {
    try {
      await api.signup(profile);
      await api.login({ email: profile.email, password: profile.password });
      const ok = await fetchProfile();
      if (ok) {
        setIsReturningUser(false);
        setRoute("dashboard");
      }
    } catch (err) {
      alert("Signup failed: " + (err as Error).message);
    }
  };

  const handleSignOut = async () => {
    await api.logout();
    setUser(initialProfile);
    setNotifications([]);
    setRoute("signin");
    setTab("dashboard");
  };

  const handleDeleteAccount = async () => {
    await api.deleteAccount();
    setUser(initialProfile);
    setNotifications([]);
    setPendingAgentTask(undefined);
    setIsReturningUser(false);
    setRoute("signin");
    setTab("dashboard");
  };

  const activeRoute = tabRoutes.includes(route as any) ? tab : route;
  const appBg = settings.darkMode ? "#0F172A" : "#F8FAFC";

  const renderContent = () => {
    switch (activeRoute) {
      case "splash":
        return <SplashScreen />;
      case "signin":
        return (
          <SignInScreen
            onSignIn={(email: string | undefined, password: string | undefined) => handleSignIn(email, password)}
            onOpenSignUp={() => setRoute("signup")}
            onOpenReset={() => setRoute("resetPassword")}
          />
        );
      case "signup":
        return (
          <SignUpScreen
            onOpenTerms={() => {
              setTermsBackRoute("signup");
              setRoute("terms");
            }}
            onOpenSignIn={() => setRoute("signin")}
            onContinue={handleSignUp}
          />
        );
      case "resetPassword":
        return <ResetPasswordScreen onBack={() => setRoute("signin")} />;
      case "onboarding":
        return (
          <OnboardingScreen
            initialEmail={user.email}
            initialPassword={tempPassword}
            onBack={() => setRoute("signup")}
            onComplete={handleOnboardingComplete}
          />
        );
      case "dashboard":
        return (
          <DashboardScreen
            user={user}
            isReturningUser={isReturningUser}
            onNavigate={setRoute}
            onNavigateTab={setTab}
            onSignOut={handleSignOut}
          />
        );
      case "aiCoach":
        return (
          <AICoachScreen pendingTaskAnswer={pendingAgentTask} onConsumedPendingTask={clearPendingAgentTask} />
        );
      case "tasks":
        return (
          <TasksScreen
            onNavigateCalendar={() => setRoute("calendar")}
            onRequestAgentTaskAnswer={(p) => {
              setRoute("dashboard");
              setPendingAgentTask(p);
              setTab("aiCoach");
            }}
          />
        );
      case "goals":
        return <GoalsScreen />;
      case "profile":
        return (
          <ProfileScreen
            user={user}
            onNavigateSettings={() => setRoute("settings")}
            onSignOut={handleSignOut}
            onProfileUpdated={async () => {
              await fetchProfile();
            }}
          />
        );
      case "settings":
        return (
          <SettingsScreen
            values={settings}
            onChange={setSettings}
            onOpenTerms={() => {
              setTermsBackRoute("settings");
              setRoute("terms");
            }}
            onBack={() => setRoute("profile")}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />
        );
      case "notifications":
        return (
          <NotificationsScreen
            notifications={notifications}
            onBack={() => setRoute("dashboard")}
            onRefresh={loadNotifications}
            onMarkAllRead={async () => {
              try {
                await api.markAllNotificationsRead();
              } catch {
                /* ignore */
              }
              setNotifications((n) => n.map((item) => ({ ...item, read: true })));
            }}
          />
        );
      case "calendar":
        return <CalendarScreen onBack={() => setRoute("dashboard")} />;
      case "careerTrack":
        return <CareerTrackScreen onBack={() => setRoute("dashboard")} />;
      case "terms":
        return <TermsScreen onBack={() => setRoute(termsBackRoute)} />;
      default:
        return null;
    }
  };

  const showTabs = tabRoutes.includes(activeRoute as any);

  return (
    <SafeAreaProvider>
      <ThemeProvider isDark={settings.darkMode}>
        <View style={styles.container}>
          <StatusBar style={settings.darkMode ? "light" : "dark"} />
          <SafeAreaView style={[styles.safeArea, { backgroundColor: appBg }]} edges={["top", "left", "right"]}>
            {renderContent()}
          </SafeAreaView>
          {showTabs && <BottomTabs current={tab} onNavigate={(route: TabRoute) => setTab(route)} />}
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
