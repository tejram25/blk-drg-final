import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../theme';
import StarRating from '../../ui/StarRating';
import { Sheet } from '../collab/CommentsModal';
import { templatesApi } from './templatesApi';

export default function TemplatesModal({
  visible,
  onClose,
  currentContent,
  onUse,
}: {
  visible: boolean;
  onClose: () => void;
  currentContent: () => string;
  onUse: (contentJson: string) => void;
}) {
  const qc = useQueryClient();
  const [publishing, setPublishing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const q = useQuery({ queryKey: ['templates'], queryFn: () => templatesApi.list(), enabled: visible });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['templates'] });

  const use = useMutation({
    mutationFn: (id: number) => templatesApi.use(id),
    onSuccess: (t) => {
      onUse(t.contentJson);
      invalidate();
      onClose();
    },
  });
  const publish = useMutation({
    mutationFn: () =>
      templatesApi.create({ name: name.trim(), description: description.trim(), category: category.trim(), contentJson: currentContent() }),
    onSuccess: () => {
      setPublishing(false);
      setName('');
      setDescription('');
      setCategory('');
      invalidate();
    },
  });
  const rate = useMutation({
    mutationFn: ({ id, r }: { id: number; r: number }) => templatesApi.rate(id, r),
    onSuccess: invalidate,
  });

  const confirmUse = (id: number, nm: string) =>
    Alert.alert('Use template?', `Replace the canvas with “${nm}”.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use', onPress: () => use.mutate(id) },
    ]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Templates">
      <Pressable style={styles.newBtn} onPress={() => setPublishing((v) => !v)}>
        <Text style={styles.newText}>{publishing ? '× Cancel' : '＋ Publish current canvas'}</Text>
      </Pressable>
      {publishing ? (
        <View style={styles.form}>
          <TextInput value={name} onChangeText={setName} placeholder="Template name" placeholderTextColor={colors.subtext} style={styles.input} />
          <TextInput value={category} onChangeText={setCategory} placeholder="Category (optional)" placeholderTextColor={colors.subtext} style={styles.input} />
          <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={colors.subtext} style={[styles.input, styles.multiline]} multiline />
          <Pressable
            style={[styles.publish, { opacity: !name.trim() || publish.isPending ? 0.5 : 1 }]}
            disabled={!name.trim() || publish.isPending}
            onPress={() => publish.mutate()}
          >
            <Text style={styles.publishText}>{publish.isPending ? '…' : 'Publish'}</Text>
          </Pressable>
        </View>
      ) : null}

      {q.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : q.isError ? (
        <Text style={[styles.empty, { color: colors.danger }]}>{(q.error as Error).message}</Text>
      ) : (
        <ScrollView>
          {(q.data ?? []).length === 0 ? (
            <Text style={styles.empty}>No templates yet. Publish one to get started.</Text>
          ) : (
            (q.data ?? []).map((t) => (
              <View key={t.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{t.name}</Text>
                  {t.description ? <Text style={styles.desc} numberOfLines={2}>{t.description}</Text> : null}
                  <View style={styles.metaRow}>
                    <StarRating rating={t.avgRating} size={13} onChange={(r) => rate.mutate({ id: t.id, r })} />
                    <Text style={styles.meta}>
                      {[t.category, `used ${t.usageCount}×`, t.authorName].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.use} onPress={() => confirmUse(t.id, t.name)}>
                  <Text style={styles.useText}>Use</Text>
                </Pressable>
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  newBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  newText: { color: colors.primary, fontWeight: '700' },
  form: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, marginBottom: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, height: 42, color: colors.text },
  multiline: { height: 64, paddingTop: 10, textAlignVertical: 'top' },
  publish: { backgroundColor: colors.primary, borderRadius: radius.sm, height: 42, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 10 },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  desc: { color: colors.subtext, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  meta: { color: colors.subtext, fontSize: 11 },
  use: { backgroundColor: colors.chip, borderRadius: radius.sm, paddingHorizontal: 16, height: 40, alignItems: 'center', justifyContent: 'center' },
  useText: { color: colors.primary, fontWeight: '700' },
});
