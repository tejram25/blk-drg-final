import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ApiError } from '../../api/client';
import { colors, font, glow, radius, shadow } from '../../theme';
import { ErrorText, Field, PrimaryButton } from '../../ui/components';
import { GradientFill, Icon } from '../../ui/kit';
import { ScreenProps } from '../../navigation';
import { useAuth } from './AuthContext';

/** Soft blue halo behind the hero — gives the black screen depth. */
function Glow() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="20%" r="55%">
          <Stop offset="0" stopColor={colors.primary} stopOpacity="0.16" />
          <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo)" />
    </Svg>
  );
}

export default function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.includes('@') || !password) {
      setError('Enter a valid email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // On success the auth state flips and the app swaps to the diagrams stack.
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Glow />
      <View style={styles.hero}>
        <View style={[styles.logo, glow()]}>
          <GradientFill />
          <Icon name="git-network" size={30} color="#fff" />
        </View>
        <Text style={styles.title}>Block Diagram Builder</Text>
        <Text style={styles.subtitle}>Design, source and collaborate</Text>
      </View>
      <View style={[styles.card, shadow(2)]}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="you@company.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          onSubmitEditing={submit}
        />
        <ErrorText>{error}</ErrorText>
        <PrimaryButton title="Sign in" onPress={submit} loading={busy} />
      </View>
      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
        Don&apos;t have an account? <Text style={styles.linkStrong}>Create one</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 22 },
  hero: { alignItems: 'center', marginBottom: 26 },
  logo: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { ...font.h2, color: colors.text, textAlign: 'center' },
  subtitle: { color: colors.subtext, textAlign: 'center', marginTop: 6, fontSize: 15 },
  card: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 22,
  },
  link: { color: colors.subtext, textAlign: 'center', marginTop: 22, fontSize: 14 },
  linkStrong: { color: colors.primaryDark, fontWeight: '800' },
});
