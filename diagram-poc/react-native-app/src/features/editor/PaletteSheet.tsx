import { useQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius } from '../../theme';
import { BlockType, fetchPalette } from './catalogApi';

export default function PaletteSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (b: BlockType) => void;
}) {
  const q = useQuery({ queryKey: ['palette'], queryFn: fetchPalette, enabled: visible });

  const grouped = useMemo(() => {
    const cats: string[] = [];
    const by: Record<string, BlockType[]> = {};
    for (const b of q.data ?? []) {
      if (!by[b.category]) {
        by[b.category] = [];
        cats.push(b.category);
      }
      by[b.category].push(b);
    }
    return { cats, by };
  }, [q.data]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Add to canvas</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {q.isLoading ? (
            <View style={{ padding: 40 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView>
              {grouped.cats.map((cat) => (
                <View key={cat} style={{ marginBottom: 8 }}>
                  <Text style={styles.cat}>{cat.toUpperCase()}</Text>
                  <View style={styles.grid}>
                    {grouped.by[cat].map((b) => (
                      <Pressable
                        key={b.key}
                        style={styles.chip}
                        onPress={() => {
                          onPick(b);
                          onClose();
                        }}
                      >
                        <View style={[styles.dot, { backgroundColor: b.color }]} />
                        <Text style={styles.chipText} numberOfLines={2}>
                          {b.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '82%',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginVertical: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  close: { fontSize: 18, color: colors.subtext, paddingHorizontal: 8 },
  cat: { fontSize: 11, fontWeight: '700', color: colors.subtext, letterSpacing: 0.6, paddingHorizontal: 6, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    width: '48%',
    margin: '1%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  chipText: { flex: 1, fontSize: 13, color: colors.text },
});
