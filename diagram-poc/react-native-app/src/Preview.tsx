import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DiagramCanvas from './features/editor/DiagramCanvas';
import { parseModel } from './features/editor/model';
import { colors } from './theme';

// A no-network preview of the editor canvas, used to screenshot the SVG
// rendering (symbols + wires + blocks). Enabled with EXPO_PUBLIC_PREVIEW=1.
const SAMPLE = JSON.stringify({
  class: 'GraphLinksModel',
  nodeDataArray: [
    { key: 'VCC', category: 'block', text: '+5V', color: '#dc2626', size: '90 46', loc: '360 40' },
    { key: 'U1', category: 'symbol', shape: 'elec-ic555', text: 'U1 · 555', size: '120 140', loc: '340 200' },
    { key: 'R1', category: 'symbol', shape: 'elec-resistor', text: 'R1 10k', size: '100 40', loc: '110 120' },
    { key: 'R2', category: 'symbol', shape: 'elec-resistor', text: 'R2 47k', size: '100 40', loc: '110 220' },
    { key: 'C1', category: 'symbol', shape: 'elec-capacitor', text: 'C1 10n', size: '100 40', loc: '110 340' },
    { key: 'LED', category: 'symbol', shape: 'elec-led', text: 'D1', size: '60 70', loc: '600 210' },
    { key: 'GND', category: 'symbol', shape: 'elec-ground', text: 'GND', size: '44 44', loc: '378 430' },
    { key: 'OUT', category: 'block', text: 'Output', color: '#059669', size: '110 52', loc: '600 340' },
  ],
  linkDataArray: [
    { from: 'VCC', to: 'U1', wire: true, flow: true, dash: [8, 6] },
    { from: 'R1', to: 'U1', wire: true },
    { from: 'R2', to: 'U1', wire: true },
    { from: 'C1', to: 'U1', wire: true },
    { from: 'U1', to: 'LED', wire: true },
    { from: 'LED', to: 'OUT', wire: true },
    { from: 'U1', to: 'GND', wire: true },
  ],
});

export default function Preview() {
  const [graph] = useState(() => parseModel(SAMPLE));
  const [selected, setSelected] = useState<string | null>('U1');
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.back}>‹ Back</Text>
          <Text style={styles.title}>555 Timer Astable</Text>
          <Text style={styles.save}>Save</Text>
        </View>
        <View style={{ flex: 1 }}>
          <DiagramCanvas
            graph={graph}
            selectedKey={selected}
            onSelect={setSelected}
            onNodeMove={() => {}}
          />
        </View>
        <View style={styles.status}>
          <Text style={styles.statusText}>
            {graph.nodes.length} nodes · {graph.links.length} links · Selected: U1
          </Text>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvasBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.canvasSurface,
  },
  back: { color: colors.canvasText, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', color: colors.canvasText, fontSize: 17, fontWeight: '700' },
  save: { color: colors.canvasText, fontWeight: '600' },
  status: { padding: 10, backgroundColor: colors.canvasSurface },
  statusText: { color: colors.canvasSubtext, fontSize: 12 },
});
