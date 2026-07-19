import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../theme';

/** Open a native file picker and resolve the chosen file's text (web only). */
function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

export default function ImportModal({
  visible,
  onClose,
  onImport,
}: {
  visible: boolean;
  onClose: () => void;
  onImport: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const isWeb = Platform.OS === 'web';

  const submit = (json: string) => {
    if (!json.trim()) return;
    onImport(json);
    setText('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Import diagram</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Paste a GoJS model (the desktop app’s “Export → JSON”), or choose a file. This replaces the current canvas.
          </Text>

          {isWeb ? (
            <Pressable
              style={styles.fileBtn}
              onPress={async () => {
                const json = await pickJsonFile();
                if (json) submit(json);
              }}
            >
              <Text style={styles.fileBtnText}>Choose JSON file…</Text>
            </Pressable>
          ) : null}

          <ScrollView style={styles.editorWrap} keyboardShouldPersistTaps="handled">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder='{ "class": "GraphLinksModel", "nodeDataArray": [...], "linkDataArray": [...] }'
              placeholderTextColor={colors.faint}
              style={styles.editor}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
          </ScrollView>

          <Pressable style={[styles.importBtn, !text.trim() && { opacity: 0.5 }]} disabled={!text.trim()} onPress={() => submit(text)}>
            <Text style={styles.importText}>Import</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  close: { fontSize: 18, color: colors.subtext, paddingHorizontal: 6 },
  hint: { fontSize: 12, color: colors.subtext, marginTop: 6, marginBottom: 10 },
  fileBtn: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  fileBtnText: { color: colors.primary, fontWeight: '700' },
  editorWrap: { maxHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  editor: { minHeight: 160, padding: 10, color: colors.text, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  importBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  importText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
});
