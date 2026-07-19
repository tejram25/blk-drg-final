import React from 'react';
import { Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Icon } from '../../ui/kit';
import { captureDiagramImage } from './DiagramCanvas';

/** Trigger a browser download of a URL/data-URL (web only). */
function webDownload(filename: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const safeName = (name: string) => (name || 'diagram').replace(/[^\w.-]+/g, '_');

export default function ExportModal({
  visible,
  onClose,
  name,
  getJson,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  getJson: () => string;
}) {
  const isWeb = Platform.OS === 'web';

  const exportJson = async () => {
    const json = getJson();
    if (isWeb) {
      const href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      webDownload(`${safeName(name)}.json`, href);
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } else {
      await Share.share({ title: `${safeName(name)}.json`, message: json });
    }
    onClose();
  };

  const exportPng = () => {
    const uri = captureDiagramImage();
    if (uri) webDownload(`${safeName(name)}.png`, uri);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Export diagram</Text>

          {isWeb ? (
            <Row icon="image" label="Download PNG image" sub="High-resolution snapshot of the canvas" onPress={exportPng} />
          ) : null}
          <Row
            icon="download"
            label={isWeb ? 'Download model (JSON)' : 'Share model (JSON)'}
            sub="GoJS model — reopens in this app or the desktop editor"
            onPress={exportJson}
          />

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Icon name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 11, color: colors.subtext, marginTop: 1 },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.subtext },
});
