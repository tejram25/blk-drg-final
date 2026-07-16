import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, font, radius, shadow } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** App icon — thin wrapper over Ionicons so screens don't import the set directly. */
export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** Round tappable icon button (toolbars, headers). */
export function IconButton({
  name,
  onPress,
  color = colors.text,
  bg = 'transparent',
  size = 22,
  disabled,
  active,
  hitSlop = 8,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  bg?: string;
  size?: number;
  disabled?: boolean;
  active?: boolean;
  hitSlop?: number;
}) {
  return (
    <Pressable
      hitSlop={hitSlop}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: active ? colors.primary : bg, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={name} size={size} color={active ? colors.onPrimary : color} />
    </Pressable>
  );
}

type Variant = 'primary' | 'tonal' | 'ghost' | 'danger';

/** Primary action button with an optional leading icon. */
export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border ?? 'transparent', borderWidth: v.border ? 1 : 0 },
        { opacity: off ? 0.5 : pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Icon name={icon} size={18} color={v.fg} /> : null}
          <Text style={[styles.btnText, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  tonal: { bg: colors.primarySoft, fg: colors.primary },
  ghost: { bg: 'transparent', fg: colors.primary, border: colors.border },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

/** Elevated surface card. */
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const content = <View style={[styles.card, shadow(1), style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

/** Small pill badge (status, category). */
export function Badge({ label, color = colors.primary, soft = true }: { label: string; color?: string; soft?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: soft ? color + '22' : color }]}>
      <Text style={[styles.badgeText, { color: soft ? color : colors.onPrimary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btn: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { ...font.title },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { ...font.overline },
});
