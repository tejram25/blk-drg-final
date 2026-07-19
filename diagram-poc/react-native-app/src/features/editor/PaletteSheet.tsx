import { useQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors, font, radius, shadow } from '../../theme';
import { Icon } from '../../ui/kit';
import { BlockType, fetchPalette, isAnim, isShape, isSymbol } from './catalogApi';
import { ShapeGeometry } from './shapes';
import { ELECTRICAL_SYMBOLS } from './symbols';

const PW = 46;
const PH = 34;

/** A crisp mini-preview of what a palette item draws on the canvas. */
function Preview({ block }: { block: BlockType }) {
  if (isSymbol(block) && block.shape && ELECTRICAL_SYMBOLS[block.shape]) {
    const sym = ELECTRICAL_SYMBOLS[block.shape];
    const pad = 4;
    const s = Math.min((PW - pad * 2) / sym.width, (PH - pad * 2) / sym.height);
    const tx = (PW - sym.width * s) / 2;
    const ty = (PH - sym.height * s) / 2;
    return (
      <Svg width={PW} height={PH}>
        <G transform={`translate(${tx},${ty}) scale(${s})`}>
          {sym.paths.map((p, i) => (
            <Path key={i} d={p.d} fill={p.fill ? '#33404C' : 'none'} stroke="#33404C" strokeWidth={2.4 / s} />
          ))}
        </G>
      </Svg>
    );
  }
  if (isShape(block) && block.shape) {
    return (
      <Svg width={PW} height={PH}>
        <G transform="translate(4,3)">
          <ShapeGeometry shape={block.shape} w={PW - 8} h={PH - 6} fill={block.color} stroke="#475569" sw={1.4} />
        </G>
      </Svg>
    );
  }
  if (isAnim(block)) {
    const cx = PW / 2;
    const cy = PH / 2;
    return (
      <Svg width={PW} height={PH}>
        <Circle cx={cx} cy={cy} r={11} fill="none" stroke="#f59e0b" strokeWidth={1.4} opacity={0.5} />
        <Circle cx={cx} cy={cy} r={6} fill="#f59e0b" />
      </Svg>
    );
  }
  return (
    <Svg width={PW} height={PH}>
      <Rect x={3} y={5} width={PW - 6} height={PH - 10} rx={6} fill={block.color} stroke="#00000022" strokeWidth={1} />
    </Svg>
  );
}

const CAT_ICON: Record<string, React.ComponentProps<typeof Icon>['name']> = {
  Electrical: 'flash',
  Shapes: 'shapes',
  Blocks: 'cube',
  Animated: 'sparkles',
};

/** The grouped, preview-rich palette grid — shared by the mobile sheet and the desktop rail. */
export function PaletteGrid({ onPick, columns }: { onPick: (b: BlockType) => void; columns?: 1 | 2 }) {
  const q = useQuery({ queryKey: ['palette'], queryFn: fetchPalette });
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

  if (q.isLoading) {
    return (
      <View style={{ padding: 48 }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const chipStyle = columns === 1 ? styles.chip1 : styles.chip;
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {grouped.cats.map((cat) => (
        <View key={cat} style={{ marginBottom: 10 }}>
          <View style={styles.catRow}>
            <Icon name={CAT_ICON[cat] ?? 'ellipse'} size={13} color={colors.primary} />
            <Text style={styles.cat}>{cat}</Text>
            <Text style={styles.catCount}>{grouped.by[cat].length}</Text>
          </View>
          <View style={styles.grid}>
            {grouped.by[cat].map((b) => (
              <Pressable
                key={b.key}
                style={({ pressed }) => [chipStyle, pressed && styles.chipPressed]}
                onPress={() => onPick(b)}
              >
                <View style={styles.previewBox}>
                  <Preview block={b} />
                </View>
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
  );
}

export default function PaletteSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (b: BlockType) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Add to canvas</Text>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={18} color={colors.subtext} />
            </Pressable>
          </View>
          <PaletteGrid
            onPick={(b) => {
              onPick(b);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '84%', paddingHorizontal: 14, paddingBottom: 14 },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: 'center', marginVertical: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 10 },
  title: { flex: 1, ...font.h3, color: colors.text },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 8 },
  cat: { ...font.overline, color: colors.subtext },
  catCount: { ...font.caption, color: colors.faint, backgroundColor: colors.chip, paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chip1: {
    width: '100%',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chipPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  previewBox: { width: PW, height: PH, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow(1) },
  chipText: { flex: 1, ...font.label, color: colors.text },
});
