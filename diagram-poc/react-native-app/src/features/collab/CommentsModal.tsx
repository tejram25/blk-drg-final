import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius } from '../../theme';
import { commentsApi } from './commentsApi';

export default function CommentsModal({
  visible,
  onClose,
  diagramId,
}: {
  visible: boolean;
  onClose: () => void;
  diagramId: number;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const q = useQuery({
    queryKey: ['comments', diagramId],
    queryFn: () => commentsApi.list(diagramId),
    enabled: visible,
  });
  const add = useMutation({
    mutationFn: () => commentsApi.add(diagramId, text.trim()),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['comments', diagramId] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => commentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', diagramId] }),
  });

  return (
    <Sheet visible={visible} onClose={onClose} title="Comments">
      {q.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={q.data ?? []}
          keyExtractor={(c) => `${c.id}`}
          ListEmptyComponent={<Text style={styles.empty}>No comments yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.author}>{item.authorName}</Text>
                <Text style={styles.text}>{item.text}</Text>
              </View>
              {item.self ? (
                <Pressable hitSlop={8} onPress={() => remove.mutate(item.id)}>
                  <Text style={styles.del}>🗑</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a comment…"
          placeholderTextColor={colors.subtext}
          style={styles.input}
          multiline
        />
        <Pressable
          style={styles.send}
          onPress={() => text.trim() && add.mutate()}
          disabled={add.isPending}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>{add.isPending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, height: '80%', padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  close: { fontSize: 18, color: colors.subtext, paddingHorizontal: 6 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  author: { fontWeight: '600', color: colors.text },
  text: { color: colors.text, marginTop: 2 },
  del: { fontSize: 16, paddingLeft: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, maxHeight: 100, color: colors.text },
  send: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 16, height: 40, alignItems: 'center', justifyContent: 'center' },
});
