import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { colors, font, radius, shadow } from '../../theme';
import { ErrorText, Field, PrimaryButton } from '../../ui/components';
import { ScreenProps } from '../../navigation';
import { authApi } from './authApi';
import { useAuth } from './AuthContext';

export default function RegisterScreen({ navigation }: ScreenProps<'Register'>) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi.inviteRequired().then(setInviteRequired).catch(() => {});
  }, []);

  const submit = async () => {
    if (!name.trim() || !email.includes('@') || password.length < 8) {
      setError('Enter your name, a valid email, and an 8+ character password.');
      return;
    }
    if (inviteRequired && !invite.trim()) {
      setError('Invite code required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        inviteCode: invite.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Create account</Text>
        <View style={{ height: 16 }} />
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <Field
          label="Password (min 8 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {inviteRequired ? (
          <Field label="Invite code" value={invite} onChangeText={setInvite} />
        ) : null}
        <ErrorText>{error}</ErrorText>
        <PrimaryButton title="Create account" onPress={submit} loading={busy} />
        <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
          Already have an account? Sign in
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 22 },
  card: { maxWidth: 420, width: '100%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.xl, padding: 26, ...shadow(2) },
  title: { ...font.h2, color: colors.text, textAlign: 'center' },
  link: { color: colors.primary, textAlign: 'center', marginTop: 18, fontWeight: '700' },
});
