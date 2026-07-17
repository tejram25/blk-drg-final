import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, font, glow, radius, shadow } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** App icon — thin wrapper over Ionicons so screens don't import the set directly. */
export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/**
 * Absolute-fill vertical gradient (react-native-svg — no extra native deps).
 * Parent needs `overflow: 'hidden'` + a borderRadius for rounded corners.
 */
export function GradientFill({
  from = colors.primaryLight,
  to = colors.primaryDark,
}: {
  from?: string;
  to?: string;
}) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#gf)" />
    </Svg>
  );
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
        {
          backgroundColor: active ? colors.primary : pressed ? colors.surfaceAlt : bg,
          opacity: disabled ? 0.35 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Icon name={name} size={size} color={active ? colors.onPrimary : color} />
    </Pressable>
  );
}

type Variant = 'primary' | 'tonal' | 'ghost' | 'danger';

/** Primary action button — gradient + glow for `primary`, flat containers otherwise. */
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
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border ?? 'transparent', borderWidth: v.border ? 1 : 0 },
        isPrimary && !off ? glow() : null,
        { opacity: off ? 0.45 : 1, transform: [{ scale: pressed && !off ? 0.98 : 1 }] },
        style,
      ]}
    >
      {isPrimary ? <GradientFill /> : null}
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
  tonal: { bg: colors.primarySoft, fg: colors.primaryLight, border: colors.primary + '3D' },
  ghost: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger + '33' },
};

/** Elevated surface card. */
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const content = <View style={[styles.card, shadow(1), style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

/** Small pill badge (status, category). */
export function Badge({ label, color = colors.primary, soft = true }: { label: string; color?: string; soft?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: soft ? color + '24' : color }]}>
      <Text style={[styles.badgeText, { color: soft ? color : colors.onPrimary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { ...font.title },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { ...font.overline },
});
