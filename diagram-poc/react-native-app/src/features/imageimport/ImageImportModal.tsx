import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius } from '../../theme';
import { Sheet } from '../collab/CommentsModal';
import { DiagramGraph } from '../editor/model';
import { graphFromImageResult, imageApi, ImageDiagramResult } from './imageApi';

export default function ImageImportModal({
  visible,
  onClose,
  onImport,
}: {
  visible: boolean;
  onClose: () => void;
  onImport: (graph: DiagramGraph, title: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageDiagramResult | null>(null);

  const reset = () => {
    setPreview(null);
    setLoading(false);
    setError(null);
    setResult(null);
  };

  const pick = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.canAskAgain === false) {
      setError('Photo library permission is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const dataUrl = asset.base64
      ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
      : asset.uri;
    setPreview(asset.uri);
    setResult(null);
    setLoading(true);
    try {
      const out = await imageApi.extract(dataUrl);
      setResult(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doImport = () => {
    if (!result) return;
    onImport(graphFromImageResult(result), result.title || 'Imported diagram');
    reset();
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Image → diagram"
    >
      <ScrollView>
        <Text style={styles.hint}>
          Pick a photo or screenshot of a block diagram; the vision model detects the blocks and
          connections and drops them onto the canvas as editable components.
        </Text>
        <Pressable style={styles.pickBtn} onPress={pick}>
          <Text style={styles.pickText}>{preview ? '🔄 Choose another image' : '🖼 Choose image'}</Text>
        </Pressable>

        {preview ? <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" /> : null}

        {loading ? (
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.meta}>Reading the diagram…</Text>
          </View>
        ) : null}
        {error ? <Text style={[styles.meta, { color: colors.danger }]}>{error}</Text> : null}

        {result ? (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>{result.title || 'Untitled'}</Text>
            <Text style={styles.meta}>
              {result.nodes.length} blocks · {result.links.length} links
              {result.model ? ` · ${result.model}` : ''}
            </Text>
            {result.note ? <Text style={styles.meta}>{result.note}</Text> : null}
            <Pressable
              style={[styles.import, { opacity: result.nodes.length === 0 ? 0.5 : 1 }]}
              disabled={result.nodes.length === 0}
              onPress={doImport}
            >
              <Text style={styles.importText}>Add {result.nodes.length} blocks to canvas</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ height: 24 }} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.subtext, lineHeight: 20, marginBottom: 12 },
  pickBtn: { backgroundColor: colors.chip, borderRadius: radius.sm, height: 46, alignItems: 'center', justifyContent: 'center' },
  pickText: { color: colors.primary, fontWeight: '700' },
  preview: { width: '100%', height: 200, marginTop: 12, borderRadius: radius.md, backgroundColor: colors.bg },
  meta: { color: colors.subtext, fontSize: 12, marginTop: 8, textAlign: 'center' },
  result: { marginTop: 16, backgroundColor: colors.bg, borderRadius: radius.md, padding: 14 },
  resultTitle: { fontWeight: '800', color: colors.text, fontSize: 16 },
  import: { marginTop: 12, backgroundColor: colors.primary, borderRadius: radius.sm, height: 46, alignItems: 'center', justifyContent: 'center' },
  importText: { color: '#fff', fontWeight: '700' },
});
