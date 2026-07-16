import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import { DiagramLink } from './model';
import { WireStyle } from './editorOps';

const WIRE_COLORS = ['#22d3ee', '#22c55e', '#f5a623', '#ef4444', '#a78bfa', '#64748b'];
const WIDTHS = [1, 2, 3, 4];
const STYLES: WireStyle['style'][] = ['solid', 'dashed', 'flow'];
const ROUTERS: WireStyle['routing'][] = ['manhattan', 'normal', 'smooth'];

/** Wire property dock: colour, style, width, router, delete — mirrors the web edge popover. */
export default function EdgeStyleSheet({
  visible,
  link,
  onClose,
  onChange,
  onDelete,
}: {
  visible: boolean;
  link: DiagramLink | null;
  onClose: () => void;
  onChange: (patch: WireStyle) => void;
  onDelete: () => void;
}) {
  const cur = {
    color: link?.color,
    width: link?.width ?? 2,
    style: (link?.dashed ? (link?.raw.flow ? 'flow' : 'dashed') : 'solid') as WireStyle['style'],
    routing: (link?.routing ?? 'manhattan') as WireStyle['routing'],
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Wire style</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Colour</Text>
          <View style={styles.row}>
            {WIRE_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => onChange({ color: c })}
                style={[styles.swatch, { backgroundColor: c }, cur.color === c && styles.swatchOn]}
              />
            ))}
          </View>

          <Text style={styles.label}>Style</Text>
          <View style={styles.row}>
            {STYLES.map((s) => (
              <Chip key={s} label={s!} on={cur.style === s} onPress={() => onChange({ style: s })} />
            ))}
          </View>

          <Text style={styles.label}>Width</Text>
          <View style={styles.row}>
            {WIDTHS.map((w) => (
              <Chip key={w} label={`${w}px`} on={cur.width === w} onPress={() => onChange({ width: w })} />
            ))}
          </View>

          <Text style={styles.label}>Router</Text>
          <View style={styles.row}>
            {ROUTERS.map((r) => (
              <Chip key={r} label={r!} on={cur.routing === r} onPress={() => onChange({ routing: r })} />
            ))}
          </View>

          <Pressable style={styles.delete} onPress={onDelete}>
            <Text style={styles.deleteText}>🗑  Delete wire</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  close: { fontSize: 18, color: colors.subtext, paddingHorizontal: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.subtext, marginTop: 14, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.text },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: radius.pill, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
  delete: { marginTop: 22, height: 46, borderRadius: radius.sm, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#b91c1c', fontWeight: '700' },
});
