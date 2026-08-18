import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Sheet } from '../collab/CommentsModal';
import { DiagramGraph } from '../editor/model';
import { buildBom, extPrice, toCsv, totalCost } from '../editor/bom';

export default function BomModal({
  visible,
  onClose,
  graph,
  name,
}: {
  visible: boolean;
  onClose: () => void;
  graph: DiagramGraph | null;
  name: string;
}) {
  const rows = useMemo(() => (graph ? buildBom(graph) : []), [graph]);
  const total = totalCost(rows);

  const exportCsv = async () => {
    const csv = toCsv(rows);
    // Web: trigger a file download; native: hand off to the share sheet.
    if (typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(name || 'bom').replace(/\s+/g, '-')}-bom.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    try {
      await Share.share({ title: `${name} BOM`, message: csv });
    } catch {
      Alert.alert('Export failed', 'Could not open the share sheet.');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Bill of materials (${rows.length})`}>
      {rows.length === 0 ? (
        <Text style={styles.empty}>
          No parts yet. Attach catalogue parts to blocks, or link suggested components, to build a BOM.
        </Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={[styles.tr, styles.head]}>
                <Cell w={40} bold>#</Cell>
                <Cell w={130} bold>Part</Cell>
                <Cell w={110} bold>Mfr</Cell>
                <Cell w={110} bold>Supplier</Cell>
                <Cell w={40} bold>Qty</Cell>
                <Cell w={80} bold>Ext $</Cell>
              </View>
              <ScrollView style={{ maxHeight: 360 }}>
                {rows.map((r, i) => (
                  <View key={r.partNumber} style={styles.tr}>
                    <Cell w={40}>{`${i + 1}`}</Cell>
                    <Cell w={130} bold>{r.partNumber}</Cell>
                    <Cell w={110}>{r.manufacturer}</Cell>
                    <Cell w={110}>{r.supplier}</Cell>
                    <Cell w={40}>{`${r.quantity}`}</Cell>
                    <Cell w={80}>{extPrice(r) ? extPrice(r).toFixed(2) : '—'}</Cell>
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Text style={styles.total}>{total ? `Total: $${total.toFixed(2)}` : `${rows.length} line items`}</Text>
            <Pressable style={styles.export} onPress={exportCsv}>
              <Text style={styles.exportText}>⬇ Export CSV</Text>
            </Pressable>
          </View>
        </>
      )}
    </Sheet>
  );
}

function Cell({ children, w, bold }: { children: React.ReactNode; w: number; bold?: boolean }) {
  return (
    <Text numberOfLines={1} style={[styles.cell, { width: w }, bold && { fontWeight: '700', color: colors.text }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 24, lineHeight: 20 },
  tr: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  head: { borderBottomWidth: 1.5, borderBottomColor: colors.border },
  cell: { fontSize: 12, color: colors.subtext, paddingHorizontal: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  total: { fontWeight: '800', color: colors.text, fontSize: 15 },
  export: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 16, height: 42, alignItems: 'center', justifyContent: 'center' },
  exportText: { color: '#fff', fontWeight: '700' },
});
