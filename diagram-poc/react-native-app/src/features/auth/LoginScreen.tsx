import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { colors } from '../../theme';
import { ErrorText, Field, PrimaryButton } from '../../ui/components';
import { ScreenProps } from '../../navigation';
import { useAuth } from './AuthContext';

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
      <View style={styles.card}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>◧</Text>
        </View>
        <Text style={styles.title}>Block Diagram Builder</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
        <View style={{ height: 20 }} />
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
        <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
          Don&apos;t have an account? Create one
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  card: { maxWidth: 420, width: '100%', alignSelf: 'center' },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#fff', fontSize: 30 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { color: colors.subtext, textAlign: 'center', marginTop: 4 },
  link: { color: colors.primary, textAlign: 'center', marginTop: 16, fontWeight: '600' },
});
