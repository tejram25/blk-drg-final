import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../../theme';
import { ScreenProps } from '../../navigation';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../auth/authApi';
import { useI18n } from '../../i18n/I18nContext';
import { diagramsApi, DiagramSummary } from './diagramsApi';

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('list.title')}</Text>
        <Pressable
          onPress={() =>
            Alert.alert(user?.name ?? 'Account', user?.email ?? '', [
              { text: 'Close', style: 'cancel' },
              { text: t('list.logout'), onPress: () => void logout() },
            ])
          }
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {user ? initials(user.name, user.email) : '?'}
          </Text>
        </Pressable>
      </View>

      {diagrams.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : diagrams.isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.danger, textAlign: 'center' }}>
            {(diagrams.error as Error).message}
          </Text>
          <Pressable onPress={() => diagrams.refetch()} style={styles.retry}>
            <Text style={{ color: '#fff' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 12 }}
          data={diagrams.data}
          keyExtractor={(d) => `${d.id}`}
          onRefresh={() => diagrams.refetch()}
          refreshing={diagrams.isFetching}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('list.empty')}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.cardRow}
              onPress={() => navigation.navigate('Editor', { id: item.id, name: item.name })}
            >
              <Text style={styles.cardIcon}>▤</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>
                  {item.classification}
                  {item.ownerEmail ? ` · ${item.ownerEmail}` : ''}
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={() => confirmDelete(item)}>
                <Text style={styles.delete}>🗑</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => create.mutate()}>
        <Text style={styles.fabText}>{create.isPending ? '…' : `＋ ${t('list.new')}`}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dbe4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  retry: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 40 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 8,
  },
  cardIcon: { fontSize: 20 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardSub: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  delete: { fontSize: 18 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
