import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Sheet } from './CommentsModal';
import { versionsApi } from './versionsApi';

export default function VersionsModal({
  visible,
  onClose,
  diagramId,
  currentContent,
  onRestore,
}: {
  visible: boolean;
  onClose: () => void;
  diagramId: number;
  currentContent: () => string;
  onRestore: (contentJson: string) => void;
}) {
  const qc = useQueryClient();
  const [label, setLabel] = useState('Snapshot');
  const q = useQuery({
    queryKey: ['versions', diagramId],
    queryFn: () => versionsApi.list(diagramId),
    enabled: visible,
  });
  const snap = useMutation({
    mutationFn: () => versionsApi.snapshot(diagramId, label.trim() || 'Snapshot', currentContent()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['versions', diagramId] }),
  });
  const restore = useMutation({
    mutationFn: (id: number) => versionsApi.get(id),
    onSuccess: (v) => {
      onRestore(v.contentJson);
      onClose();
    },
  });

  const confirmRestore = (id: number, lbl: string) =>
    Alert.alert('Restore version?', `The canvas will be replaced with “${lbl}”.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', onPress: () => restore.mutate(id) },
    ]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Version history">
      <View style={styles.snapRow}>
        <TextInput value={label} onChangeText={setLabel} style={styles.input} placeholder="Label" placeholderTextColor={colors.subtext} />
        <Pressable style={styles.snap} onPress={() => snap.mutate()} disabled={snap.isPending}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{snap.isPending ? '…' : '＋ Snapshot'}</Text>
        </Pressable>
      </View>
      {q.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(v) => `${v.id}`}
          ListEmptyComponent={<Text style={styles.empty}>No versions saved yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.sub}>
                  {[item.authorName, item.createdAt?.slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable onPress={() => confirmRestore(item.id, item.label)}>
                <Text style={styles.restore}>Restore</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  snapRow: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, height: 40, color: colors.text },
  snap: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 14, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  restore: { color: colors.primary, fontWeight: '700', paddingLeft: 12 },
});
