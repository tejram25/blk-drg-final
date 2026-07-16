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
    { key: 'U1', category: 'symbol', shape: 'elec-ic555', text: 'U1', size: '120 140', loc: '300 60' },
    { key: 'R1', category: 'symbol', shape: 'elec-resistor', text: 'R1', size: '100 40', loc: '90 40' },
    { key: 'C1', category: 'symbol', shape: 'elec-capacitor', text: 'C1', size: '100 40', loc: '90 150' },
    { key: 'B1', category: 'block', text: 'Power 5V', color: '#1d4ed8', size: '150 64', loc: '60 380' },
    { key: 'S1', category: 'shape', shape: 'basic-diamond', color: '#fef3c7', size: '120 90', loc: '300 320' },
    { key: 'S2', category: 'shape', shape: 'basic-cylinder', color: '#e2e8f0', size: '110 90', loc: '520 90' },
    { key: 'S3', category: 'shape', shape: 'basic-hexagon', color: '#ede9fe', size: '120 90', loc: '520 220' },
    { key: 'A1', category: 'anim', shape: 'anim-spin', size: '80 80', loc: '90 250' },
    { key: 'A2', category: 'anim', shape: 'anim-pulse', size: '80 80', loc: '520 360' },
    { key: 'A3', category: 'anim', shape: 'anim-signal', size: '80 80', loc: '300 470' },
  ],
  linkDataArray: [
    { from: 'R1', to: 'U1', wire: true },
    { from: 'C1', to: 'U1', wire: true },
    { from: 'B1', to: 'U1', wire: true, flow: true, dash: [8, 6] },
    { from: 'U1', to: 'S2' },
    { from: 'U1', to: 'S1' },
    { from: 'S1', to: 'A3' },
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
