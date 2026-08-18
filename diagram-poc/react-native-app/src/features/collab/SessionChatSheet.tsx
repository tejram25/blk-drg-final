import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Sheet } from './CommentsModal';
import { ChatMessage } from './collab';

/**
 * Live session chat — the mobile counterpart of the desktop editor's chat
 * panel. Messages ride the room's Yjs doc, so both editors share one thread.
 */
export default function SessionChatSheet({
  visible,
  onClose,
  messages,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (visible) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }, [visible, messages.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText('');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Session chat">
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }}>
        {messages.length === 0 ? (
          <Text style={styles.empty}>No messages yet. Say hi to your collaborators.</Text>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.row, m.isSelf && styles.rowSelf]}>
              {!m.isSelf ? (
                <Text style={[styles.author, { color: m.color }]} numberOfLines={1}>
                  {m.name}
                </Text>
              ) : null}
              <View style={[styles.bubble, m.isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
                <Text style={[styles.text, m.isSelf && styles.textSelf]}>{m.text}</Text>
              </View>
              <Text style={styles.time}>
                {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the session…"
          placeholderTextColor={colors.faint}
          style={styles.input}
          multiline
          onSubmitEditing={send}
        />
        <Pressable style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  row: { marginVertical: 5, maxWidth: '82%', alignSelf: 'flex-start' },
  rowSelf: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  author: { fontSize: 11, fontWeight: '700', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOther: { backgroundColor: colors.chip, borderTopLeftRadius: 4 },
  bubbleSelf: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  text: { fontSize: 14, color: colors.text },
  textSelf: { color: colors.onPrimary },
  time: { fontSize: 10, color: colors.faint, marginTop: 2, marginHorizontal: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  send: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 16, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '700' },
});
