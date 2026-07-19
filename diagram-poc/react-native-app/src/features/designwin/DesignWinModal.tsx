import React, { useEffect, useState } from 'react';
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
import { Part } from '../parts/partsApi';
import {
  designwinApi,
  DwBoard,
  dwPartToPart,
  DwCustomer,
  DwPart,
  DwProject,
} from './designwinApi';

type Step = 'customers' | 'projects' | 'boards' | 'parts';

export default function DesignWinModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (part: Part, quantity: number) => void;
}) {
  const [step, setStep] = useState<Step>('customers');
  const [customer, setCustomer] = useState<DwCustomer | null>(null);
  const [project, setProject] = useState<DwProject | null>(null);
  const [board, setBoard] = useState<DwBoard | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Customer-first search, like the desktop Design Win explorer.
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('customers');
      setItems([]);
      setQuery('');
      setSearched(false);
      setError(null);
      setCustomer(null);
      setProject(null);
      setBoard(null);
    }
  }, [visible]);

  const searchCustomers = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      setItems(await designwinApi.customers(q));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const load = async (s: Step, c: DwCustomer | null, p: DwProject | null, b: DwBoard | null) => {
    setLoading(true);
    setError(null);
    try {
      if (s === 'projects') setItems(await designwinApi.projects(c!.customerName));
      else if (s === 'boards') setItems(await designwinApi.boards(p!.projectId));
      else if (s === 'parts')
        setItems(await designwinApi.custParts(p!.projectId, b!.boardNum, c?.customerName, c?.billTo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    if (step === 'customers') return onClose();
    const prev: Step = step === 'parts' ? 'boards' : step === 'boards' ? 'projects' : 'customers';
    setStep(prev);
    if (prev === 'customers') return; // keep the customer search results
    load(prev, customer, project, board);
  };

  const title =
    step === 'customers'
      ? 'Design Win — Customers'
      : step === 'projects'
        ? customer?.customerName ?? 'Projects'
        : step === 'boards'
          ? project?.projectName ?? 'Boards'
          : board?.boardName ?? 'Parts';

  const renderItem = ({ item }: { item: any }) => {
    if (step === 'customers') {
      const c = item as DwCustomer;
      return (
        <Row title={c.customerName} sub={[c.accountNumber, c.status].filter(Boolean).join(' · ')} chevron
          onPress={() => { setCustomer(c); setStep('projects'); load('projects', c, null, null); }} />
      );
    }
    if (step === 'projects') {
      const p = item as DwProject;
      return (
        <Row title={p.projectName} sub={`${p.stage} · EAU ${p.eau}`} chevron
          onPress={() => { setProject(p); setStep('boards'); load('boards', customer, p, null); }} />
      );
    }
    if (step === 'boards') {
      const b = item as DwBoard;
      return (
        <Row title={b.boardName} sub={`${b.boardNum} · ${b.status}`} chevron
          onPress={() => { setBoard(b); setStep('parts'); load('parts', customer, project, b); }} />
      );
    }
    const part = item as DwPart;
    return (
      <Row title={part.partNumber} sub={[part.mfrName, part.description, `Qty ${part.quantity}`].filter(Boolean).join(' · ')}
        onPress={() => { onPick(dwPartToPart(part), part.quantity); onClose(); }} />
    );
  };

  const emptyText =
    step === 'customers' && !searched
      ? 'Search a customer name to begin.'
      : loading
        ? ''
        : 'Nothing here.';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable hitSlop={10} onPress={back}>
              <Text style={styles.back}>{step === 'customers' ? '✕' : '‹'}</Text>
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>

          {step === 'customers' ? (
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Customer name (e.g. Tesla)"
                placeholderTextColor={colors.faint}
                style={styles.input}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={searchCustomers}
              />
              <Pressable style={styles.searchBtn} onPress={searchCustomers}>
                <Text style={styles.searchBtnText}>Search</Text>
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : error ? (
            <Text style={styles.msg}>{error}</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(_, i) => `${i}`}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={emptyText ? <Text style={styles.msg}>{emptyText}</Text> : null}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Row({ title, sub, onPress, chevron }: { title: string; sub: string; onPress: () => void; chevron?: boolean }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>{sub}</Text>
      </View>
      <Text style={styles.chevron}>{chevron ? '›' : '＋'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, height: '82%', padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  back: { fontSize: 20, color: colors.text, paddingHorizontal: 6, width: 32 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 44,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  searchBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 18, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: colors.onPrimary, fontWeight: '700' },
  msg: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.subtext, paddingLeft: 10 },
});
