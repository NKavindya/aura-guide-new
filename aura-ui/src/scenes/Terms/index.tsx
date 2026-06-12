import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, commonStyles } from "../../theme";
import { useThemedScreen } from "../../theme/useThemedScreen";
import { AppCard } from "../../components/AppCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { termsIntroduction, termsSections, termsUpdatedSubtitle } from "./termsContent";

export function TermsScreen({ onBack }: { onBack: () => void }) {
  const { styles: themed } = useThemedScreen();
  return (
    <ScrollView contentContainerStyle={[styles.screenContent, themed.screenBg]}>
      <ScreenHeader title="Terms and Conditions" subtitle={termsUpdatedSubtitle} onBack={onBack} />

      <AppCard style={commonStyles.stackMd}>
        <Text style={[styles.intro, themed.body]}>{termsIntroduction}</Text>
        {termsSections.map((section) => (
          <View key={section.title}>
            <Text style={[styles.termsTitle, themed.title]}>{section.title}</Text>
            <Text style={[styles.termsText, themed.body]}>{section.body}</Text>
          </View>
        ))}
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 16,
  },
  intro: {
    color: palette.text,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: 12,
    fontSize: 14,
  },
  termsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
    marginBottom: 4,
  },
  termsText: {
    color: palette.muted,
    lineHeight: 22,
    marginBottom: 8,
  },
});
