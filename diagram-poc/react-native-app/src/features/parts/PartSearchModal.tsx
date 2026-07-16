import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius } from '../../theme';
import { Part, searchParts } from './partsApi';

export default function PartSearchModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (p: Part) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }, [visible]);

  const onChange = (v: string) => {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(v), 400);
  };

  const run = async (v: string) => {
    if (!v.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await searchParts(v));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TextInput
              value={query}
              onChangeText={onChange}
              placeholder="Search parts (MPN, keyword)…"
              placeholderTextColor={colors.subtext}
              style={styles.input}
              autoFocus
            />
            <Pressable hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : error ? (
            <Text style={styles.msg}>{error}</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(p, i) => `${p.partNumber}-${i}`}
              ListEmptyComponent={
                <Text style={styles.msg}>{query.trim() ? 'No matches.' : 'Type to search.'}</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onPick(item);
                    onClose();
                  }}
                >
                  <Text style={styles.mpn}>{item.partNumber}</Text>
                  <Text style={styles.sub} numberOfLines={2}>
                    {[item.manufacturer, item.description].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, height: '80%', padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, height: 44, color: colors.text },
  close: { fontSize: 18, color: colors.subtext, paddingHorizontal: 6 },
  msg: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  mpn: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.subtext, marginTop: 2 },
});
