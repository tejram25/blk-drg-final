import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Sheet } from '../collab/CommentsModal';
import { DiagramNode } from '../editor/model';
import { linkedComponents } from '../editor/editorOps';
import { aiApi, BoxSuggestion } from './aiApi';

/** Human label for an electrical symbol shape (`elec-cap-pol` → `cap pol`). */
const symbolLabel = (shape: string) => shape.replace(/^elec-/, '').replace(/-/g, ' ');

/** Build the suggestion query for a node the way the web suggestQueryFor does. */
function queryFor(node: DiagramNode): { label: string; sub: string; kind: string } {
  const raw = node.raw as any;
  if (node.category === 'symbol' && node.shape) {
    const type = symbolLabel(node.shape);
    const value = String(raw.value || '');
    const pnLike = /[A-Za-z]/.test(value) && /\d/.test(value) && value.length >= 4;
    return { label: pnLike ? value : type, sub: type, kind: raw.kind || '' };
  }
  return { label: node.text || String(raw.text || ''), sub: String(raw.subtitle || raw.sub || ''), kind: raw.kind || '' };
}

function toComponent(s: BoxSuggestion, supplier: string): Record<string, unknown> {
  const offer = (s.suppliers || []).find((o) => o.name === supplier);
  return {
    partNumber: s.partNumber,
    manufacturer: s.manufacturer,
    description: s.description,
    supplier,
    suppliers: s.suppliers || [],
    quantity: 1,
    fieldProven: s.fieldProven,
    unitPrice: offer?.unitPrice ?? s.unitPrice,
    moq: offer?.moq ?? s.moq,
  };
}

export default function BoxSuggestModal({
  visible,
  onClose,
  node,
  onLink,
  onUnlink,
}: {
  visible: boolean;
  onClose: () => void;
  node: DiagramNode | null;
  onLink: (comp: Record<string, unknown>) => void;
  onUnlink: (partNumber: string) => void;
}) {
  const q = queryFor(node ?? ({ raw: {} } as DiagramNode));
  const [picked, setPicked] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ['box-suggest', node?.key, q.label, q.sub, q.kind],
    queryFn: () => aiApi.boxSuggest(q.label, q.sub, q.kind),
    enabled: visible && !!node,
  });
  const linked = node ? linkedComponents(node.raw) : [];

  return (
    <Sheet visible={visible} onClose={onClose} title="Suggest components">
      {!node ? (
        <Text style={styles.empty}>Select a block first.</Text>
      ) : (
        <ScrollView>
          <Text style={styles.for}>for “{node.text || q.label || 'block'}”</Text>

          {linked.length > 0 ? (
            <>
              <Text style={styles.section}>Linked ({linked.length})</Text>
              {linked.map((c, i) => (
                <View key={i} style={styles.linkedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pn}>{String(c.partNumber)}</Text>
                    <Text style={styles.meta}>
                      {[c.manufacturer, c.supplier].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Pressable hitSlop={8} onPress={() => onUnlink(String(c.partNumber))}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}

          <Text style={styles.section}>Suggestions</Text>
          {query.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : query.isError ? (
            <Text style={[styles.empty, { color: colors.danger }]}>{(query.error as Error).message}</Text>
          ) : (query.data?.suggestions ?? []).length === 0 ? (
            <Text style={styles.empty}>{query.data?.note || 'No component matches found.'}</Text>
          ) : (
            (query.data?.suggestions ?? []).map((s, i) => {
              const supplier = picked[s.partNumber] || s.suppliers?.[0]?.name || s.manufacturer;
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{s.partNumber}</Text>
                    {s.fieldProven ? <Text style={styles.proven}>field-proven</Text> : null}
                  </View>
                  <Text style={styles.meta}>{[s.manufacturer, s.description].filter(Boolean).join(' · ')}</Text>
                  <Text style={styles.meta}>
                    {s.status} · stock {s.stock} · lead {s.leadWeeks}
                    {s.unitPrice ? ` · $${s.unitPrice}` : ''}
                  </Text>
                  {(s.suppliers || []).length > 1 ? (
                    <View style={styles.suppliers}>
                      {s.suppliers.map((o) => (
                        <Pressable
                          key={o.name}
                          onPress={() => setPicked((p) => ({ ...p, [s.partNumber]: o.name }))}
                          style={[styles.supChip, supplier === o.name && styles.supChipOn]}
                        >
                          <Text style={[styles.supText, supplier === o.name && { color: '#fff' }]}>{o.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <Pressable style={styles.linkBtn} onPress={() => onLink(toComponent(s, supplier))}>
                    <Text style={styles.linkText}>＋ Link {supplier ? `(${supplier})` : ''}</Text>
                  </Pressable>
                </View>
              );
            })
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  for: { color: colors.subtext, marginBottom: 4 },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  proven: { fontSize: 11, color: '#15803d', fontWeight: '800' },
  meta: { color: colors.subtext, fontSize: 12, marginTop: 3 },
  suppliers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  supChip: { paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  supChipOn: { backgroundColor: colors.primary },
  supText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  linkBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 14, height: 38, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: '#fff', fontWeight: '700' },
  linkedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pn: { fontWeight: '700', color: colors.text },
  remove: { color: colors.danger, fontWeight: '700' },
});
