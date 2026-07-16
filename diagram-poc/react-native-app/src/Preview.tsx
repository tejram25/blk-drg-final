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
    { key: 'R2', category: 'symbol', shape: 'elec-resistor', text: 'R2', size: '100 40', loc: '90 140' },
    { key: 'C1', category: 'symbol', shape: 'elec-capacitor', text: 'C1', size: '100 40', loc: '90 250' },
    { key: 'B1', category: 'block', text: 'Power 5V', color: '#1d4ed8', size: '150 64', loc: '70 380' },
    { key: 'B2', category: 'block', text: 'LED Load', color: '#15803d', size: '150 64', loc: '520 380' },
  ],
  linkDataArray: [
    { from: 'R1', to: 'U1', wire: true },
    { from: 'R2', to: 'U1', wire: true },
    { from: 'C1', to: 'U1', wire: true },
    { from: 'B1', to: 'U1' },
    { from: 'U1', to: 'B2' },
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
