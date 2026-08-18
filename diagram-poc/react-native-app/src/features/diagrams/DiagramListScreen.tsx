import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, fonts, glow, radius, shadow } from '../../theme';
import { ScreenProps } from '../../navigation';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../auth/authApi';
import { useI18n } from '../../i18n/I18nContext';
import { GradientFill, Icon } from '../../ui/kit';
import { diagramsApi, DiagramSummary } from './diagramsApi';

const CLASS_TINT: Record<string, string> = {
  PUBLIC: colors.success,
  INTERNAL: '#0084D5',
  RESTRICTED: colors.danger,
};

export default function DiagramListScreen({ navigation }: ScreenProps<'Diagrams'>) {
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const diagrams = useQuery({ queryKey: ['diagrams'], queryFn: diagramsApi.list });

  const create = useMutation({
    mutationFn: () => diagramsApi.create('Untitled diagram'),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['diagrams'] });
      navigation.navigate('Editor', { id: d.id, name: d.name });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => diagramsApi.del(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diagrams'] }),
  });

  const confirmDelete = (d: DiagramSummary) =>
    Alert.alert('Delete diagram?', `"${d.name}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(d.id) },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Image
            source={require('../../../assets/brand/arrow-logo-white.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>{t('list.title')}</Text>
          <Text style={styles.headerSub}>
            {diagrams.data ? `${diagrams.data.length} ${t('list.title').toLowerCase()}` : ' '}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            Alert.alert(user?.name ?? 'Account', user?.email ?? '', [
              { text: 'Close', style: 'cancel' },
              { text: t('list.logout'), onPress: () => void logout() },
            ])
          }
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{user ? initials(user.name, user.email) : '?'}</Text>
        </Pressable>
      </View>

      {diagrams.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : diagrams.isError ? (
        <View style={styles.center}>
          <Icon name="cloud-offline-outline" size={40} color={colors.faint} />
          <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 12 }}>
            {(diagrams.error as Error).message}
          </Text>
          <Pressable onPress={() => diagrams.refetch()} style={styles.retry}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: colors.bg }}
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          data={diagrams.data}
          keyExtractor={(d) => `${d.id}`}
          onRefresh={() => diagrams.refetch()}
          refreshing={diagrams.isFetching}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Icon name="documents-outline" size={48} color={colors.faint} />
              <Text style={styles.empty}>{t('list.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const tint = CLASS_TINT[item.classification] ?? colors.primary;
            return (
              <Pressable
                style={({ pressed }) => [styles.cardRow, shadow(1), pressed && { opacity: 0.96 }]}
                onPress={() => navigation.navigate('Editor', { id: item.id, name: item.name })}
              >
                <View style={styles.cardIcon}>
                  <Icon name="git-network" size={20} color={colors.subtext} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.cardMeta}>
                    <View style={[styles.classDot, { backgroundColor: tint }]} />
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.classification}
                      {item.ownerEmail ? ` · ${item.ownerEmail}` : ''}
                    </Text>
                  </View>
                </View>
                <Pressable hitSlop={10} onPress={() => confirmDelete(item)} style={styles.delete}>
                  <Icon name="trash-outline" size={18} color={colors.faint} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        style={({ pressed }) => [styles.fab, glow(), { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        onPress={() => create.mutate()}
      >
        <GradientFill />
        {create.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Icon name="add" size={22} color="#fff" />
            <Text style={styles.fabText}>{t('list.new')}</Text>
          </>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Black top chrome (arrow.com nav); the list body sits on the light page.
  root: { flex: 1, backgroundColor: colors.chrome },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.chrome,
  },
  brandLogo: { width: 118, height: 26, marginBottom: 8 },
  headerTitle: { ...font.h1, color: colors.chromeText },
  headerSub: { ...font.caption, color: colors.chromeSubtext, marginTop: 2, textTransform: 'capitalize' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.chromeAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.chromeBorder,
  },
  avatarText: { color: colors.chromeText, fontWeight: '800', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  retry: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: radius.md },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 12 },
  empty: { textAlign: 'center', color: colors.subtext, fontSize: 15 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chip },
  cardTitle: { ...font.title, color: colors.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  classDot: { width: 7, height: 7, borderRadius: 4 },
  cardSub: { fontSize: 12, color: colors.subtext, flex: 1 },
  delete: { padding: 6 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    height: 54,
    borderRadius: radius.pill,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fabText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
});
