import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Sheet } from './CommentsModal';
import { feedbackApi, FeedbackThread } from './feedbackApi';

const STATUS_COLOR: Record<string, string> = {
  open: '#1d4ed8',
  'changes-requested': '#b45309',
  approved: '#15803d',
  closed: '#6b7280',
};
const DECISIONS = ['comment', 'request-changes', 'approve', 'close'];

export default function FeedbackModal({
  visible,
  onClose,
  diagramId,
}: {
  visible: boolean;
  onClose: () => void;
  diagramId: number;
}) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ['feedback', diagramId],
    queryFn: () => feedbackApi.board(diagramId),
    enabled: visible,
  });
  const roles = q.data?.roles ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['feedback', diagramId] });

  return (
    <Sheet visible={visible} onClose={onClose} title="Feedback loop">
      {q.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : q.isError ? (
        <Text style={[styles.empty, { color: colors.danger }]}>{(q.error as Error).message}</Text>
      ) : (
        <ScrollView>
          <Pressable style={styles.newBtn} onPress={() => setCreating((v) => !v)}>
            <Text style={styles.newText}>{creating ? '× Cancel' : '＋ New feedback thread'}</Text>
          </Pressable>
          {creating ? (
            <NewThread
              roles={roles}
              onCreate={async (req) => {
                await feedbackApi.create(diagramId, req);
                setCreating(false);
                invalidate();
              }}
            />
          ) : null}

          {(q.data?.threads ?? []).length === 0 ? (
            <Text style={styles.empty}>No feedback yet. Start a thread to request a review.</Text>
          ) : (
            (q.data?.threads ?? []).map((t) => <Thread key={t.id} thread={t} roles={roles} onReply={invalidate} />)
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </Sheet>
  );
}

function Thread({ thread, roles, onReply }: { thread: FeedbackThread; roles: string[]; onReply: () => void }) {
  const [open, setOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  return (
    <View style={styles.thread}>
      <Pressable style={styles.threadHead} onPress={() => setOpen((v) => !v)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.threadTitle}>{thread.title}</Text>
          <Text style={styles.meta}>{thread.createdByName} · {thread.entries.length} replies</Text>
        </View>
        <Text style={[styles.statusPill, { backgroundColor: STATUS_COLOR[thread.status] ?? colors.subtext }]}>
          {thread.status}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.entries}>
          {thread.entries.map((e) => (
            <View key={e.id} style={styles.entry}>
              <Text style={styles.entryHead}>
                <Text style={{ fontWeight: '700' }}>{e.authorName}</Text>
                {e.role ? `  ·  ${e.role}` : ''}
                {e.decision && e.decision !== 'comment' ? `  ·  ${e.decision}` : ''}
              </Text>
              <Text style={styles.entryText}>{e.text}</Text>
            </View>
          ))}
          <Pressable onPress={() => setReplying((v) => !v)}>
            <Text style={styles.reply}>{replying ? 'Cancel' : 'Reply…'}</Text>
          </Pressable>
          {replying ? (
            <ReplyForm
              roles={roles}
              onSend={async (req) => {
                await feedbackApi.reply(thread.id, req);
                setReplying(false);
                onReply();
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function RolePicker({ roles, value, onChange }: { roles: string[]; value: string; onChange: (r: string) => void }) {
  const opts = Array.from(new Set([...roles, 'sales', 'engineering', 'customer'])).slice(0, 6);
  return (
    <View style={styles.rolesRow}>
      {opts.map((r) => (
        <Pressable key={r} onPress={() => onChange(r)} style={[styles.roleChip, value === r && styles.roleChipOn]}>
          <Text style={[styles.roleText, value === r && { color: '#fff' }]}>{r}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NewThread({
  roles,
  onCreate,
}: {
  roles: string[];
  onCreate: (req: { title: string; role: string; text: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [role, setRole] = useState(roles[0] ?? 'engineering');
  const [text, setText] = useState('');
  const m = useMutation({ mutationFn: () => onCreate({ title: title.trim(), role, text: text.trim() }) });
  return (
    <View style={styles.form}>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.subtext} style={styles.input} />
      <RolePicker roles={roles} value={role} onChange={setRole} />
      <TextInput value={text} onChangeText={setText} placeholder="What needs attention?" placeholderTextColor={colors.subtext} style={[styles.input, styles.multiline]} multiline />
      <Pressable
        style={[styles.send, { opacity: !title.trim() || !text.trim() || m.isPending ? 0.5 : 1 }]}
        disabled={!title.trim() || !text.trim() || m.isPending}
        onPress={() => m.mutate()}
      >
        <Text style={styles.sendText}>{m.isPending ? '…' : 'Create thread'}</Text>
      </Pressable>
    </View>
  );
}

function ReplyForm({
  roles,
  onSend,
}: {
  roles: string[];
  onSend: (req: { role: string; decision: string; text: string }) => Promise<void>;
}) {
  const [role, setRole] = useState(roles[0] ?? 'engineering');
  const [decision, setDecision] = useState('comment');
  const [text, setText] = useState('');
  const m = useMutation({ mutationFn: () => onSend({ role, decision, text: text.trim() }) });
  return (
    <View style={styles.form}>
      <RolePicker roles={roles} value={role} onChange={setRole} />
      <View style={styles.rolesRow}>
        {DECISIONS.map((d) => (
          <Pressable key={d} onPress={() => setDecision(d)} style={[styles.roleChip, decision === d && styles.roleChipOn]}>
            <Text style={[styles.roleText, decision === d && { color: '#fff' }]}>{d}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={text} onChangeText={setText} placeholder="Your reply…" placeholderTextColor={colors.subtext} style={[styles.input, styles.multiline]} multiline />
      <Pressable
        style={[styles.send, { opacity: !text.trim() || m.isPending ? 0.5 : 1 }]}
        disabled={!text.trim() || m.isPending}
        onPress={() => m.mutate()}
      >
        <Text style={styles.sendText}>{m.isPending ? '…' : 'Send reply'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  newBtn: { alignSelf: 'flex-start', marginBottom: 10 },
  newText: { color: colors.primary, fontWeight: '700' },
  form: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, marginBottom: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, height: 42, color: colors.text },
  multiline: { height: 72, paddingTop: 10, textAlignVertical: 'top' },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  roleChipOn: { backgroundColor: colors.primary },
  roleText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  send: { backgroundColor: colors.primary, borderRadius: radius.sm, height: 42, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '700' },
  thread: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 10, overflow: 'hidden' },
  threadHead: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  threadTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.subtext, fontSize: 12, marginTop: 2 },
  statusPill: { color: '#fff', fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, textTransform: 'capitalize' },
  entries: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  entry: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  entryHead: { color: colors.subtext, fontSize: 12 },
  entryText: { color: colors.text, marginTop: 3 },
  reply: { color: colors.primary, fontWeight: '700', marginTop: 10 },
});
