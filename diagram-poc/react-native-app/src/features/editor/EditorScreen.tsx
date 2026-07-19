import { useMutation, useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, fonts, radius, shadow } from '../../theme';
import { Icon, IconButton } from '../../ui/kit';
import { ScreenProps } from '../../navigation';
import { diagramsApi } from '../diagrams/diagramsApi';
import { Part } from '../parts/partsApi';
import PartSearchModal from '../parts/PartSearchModal';
import DesignWinModal from '../designwin/DesignWinModal';
import CommentsModal from '../collab/CommentsModal';
import ReviewsModal from '../collab/ReviewsModal';
import VersionsModal from '../collab/VersionsModal';
import FeedbackModal from '../collab/FeedbackModal';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { ChatMessage, CollabSession, Peer } from '../collab/collab';
import SessionChatSheet from '../collab/SessionChatSheet';
import { BlockType } from './catalogApi';
import DiagramCanvas from './DiagramCanvas';
import EdgeStyleSheet from './EdgeStyleSheet';
import {
  addLink,
  addNode,
  addPartNode,
  attachedParts,
  attachPart,
  deleteLink,
  deleteNode,
  graphPartNumbers,
  isPartAttached,
  linkComponent,
  linkedComponents,
  primaryPartNumber,
  removeAttachedPart,
  setAttachedQty,
  styleLink,
  unlinkComponent,
  WireStyle,
} from './editorOps';
import { RecommendationsModal, DesignReviewModal, LifecycleModal } from '../ai/AiPanels';
import BoxSuggestModal from '../ai/BoxSuggestModal';
import BomModal from '../bom/BomModal';
import TemplatesModal from '../templates/TemplatesModal';
import ImageImportModal from '../imageimport/ImageImportModal';
import { AlternativePart } from '../ai/aiApi';
import { contentBounds, DiagramGraph, DiagramNode, linkFromRaw, linkId, nodeFromRaw, parseModel } from './model';
import PaletteSheet, { PaletteGrid } from './PaletteSheet';

const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'RESTRICTED'] as const;
const CLASS_COLORS: Record<string, string> = { PUBLIC: '#2E9E5B', INTERNAL: '#0084D5', RESTRICTED: '#D93838' };

const linkKey = linkId;

export default function EditorScreen({ route, navigation }: ScreenProps<'Editor'>) {
  const { id, name: initialName } = route.params;
  const q = useQuery({ queryKey: ['diagram', id], queryFn: () => diagramsApi.get(id) });

  const [graph, setGraph] = useState<DiagramGraph | null>(null);
  const [name, setName] = useState(initialName ?? 'Editor');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [partOpen, setPartOpen] = useState(false);
  const [dwOpen, setDwOpen] = useState(false);
  const [edgeSheet, setEdgeSheet] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<
    | null
    | 'comments'
    | 'reviews'
    | 'versions'
    | 'recs'
    | 'review'
    | 'lifecycle'
    | 'box'
    | 'bom'
    | 'feedback'
    | 'templates'
    | 'image'
    | 'lang'
  >(null);
  const [partSeed, setPartSeed] = useState('');
  const [docLoaded, setDocLoaded] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [chatMsgs, setChatMsgs] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [myColor, setMyColor] = useState('#0084D5');
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;
  const chatKnownRef = useRef(new Set<string>());
  const [classification, setClassification] = useState('INTERNAL');
  const [history, setHistory] = useState<DiagramGraph[]>([]);
  const [future, setFuture] = useState<DiagramGraph[]>([]);
  const placeCount = useRef(0);
  const { user } = useAuth();
  const { t, lang, setLang, languages } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  // Collaboration session (opt-in). Native JS Yjs — no bridge.
  const sessionRef = useRef<CollabSession | null>(null);
  const graphRef = useRef<DiagramGraph | null>(null);
  graphRef.current = graph;
  const historyRef = useRef<DiagramGraph[]>([]);
  const futureRef = useRef<DiagramGraph[]>([]);
  historyRef.current = history;
  futureRef.current = future;

  const selectedLink = graph?.links.find((l) => linkId(l) === selectedEdge) ?? null;
  const selectedNode = graph?.nodes.find((n) => n.key === selected) ?? null;

  // AI-panel inputs, built the same way the web editor does.
  const aiGoal = name && name !== 'Untitled diagram' ? name : '';
  const currentParts = graph ? graphPartNumbers(graph) : [];
  const nameByKey: Record<string, string> = {};
  (graph?.nodes ?? []).forEach((n) => (nameByKey[n.key] = n.text.trim()));
  const reviewBlocks = (graph?.nodes ?? [])
    .filter((n) => n.category !== 'image' && n.text.trim())
    .map((n) => ({ name: n.text.trim(), type: n.shape || n.category }));
  const reviewLinks = (graph?.links ?? [])
    .map((l) => ({ from: nameByKey[l.from] || '', to: nameByKey[l.to] || '' }))
    .filter((l) => l.from && l.to);
  const selectedPartNumber = selectedNode ? primaryPartNumber(selectedNode.raw) : null;

  const addAlternative = (alt: AlternativePart) => {
    if (!selected) return;
    onAttach({
      partNumber: alt.partNumber,
      manufacturer: alt.manufacturer,
      supplier: alt.manufacturer,
      description: alt.dropIn ? `Drop-in alternative — ${alt.note}` : alt.note,
    });
  };

  const linkComp = (comp: Record<string, unknown>) => {
    const g = graphRef.current;
    if (!g || !selected) return;
    const ng = linkComponent(g, selected, comp);
    commit(ng);
    const node = ng.nodes.find((n) => n.key === selected);
    if (node) sessionRef.current?.setNode(selected, node.raw);
  };

  const unlinkComp = (partNumber: string) => {
    const g = graphRef.current;
    if (!g || !selected) return;
    const ng = unlinkComponent(g, selected, partNumber);
    commit(ng);
    const node = ng.nodes.find((n) => n.key === selected);
    if (node) sessionRef.current?.setNode(selected, node.raw);
  };

  const syncLive = (g: DiagramGraph) =>
    sessionRef.current?.replaceAll(g.nodes.map((n) => n.raw), g.links.map((l) => l.raw));

  // Route discrete edits through here so undo/redo has a snapshot to restore.
  const commit = (next: DiagramGraph) => {
    const prev = graphRef.current;
    if (prev) setHistory((h) => [...h.slice(-49), prev]);
    setFuture([]);
    setGraph(next);
    setDirty(true);
  };

  const restore = (g: DiagramGraph) => {
    setGraph(g);
    setSelected(null);
    setSelectedEdge(null);
    setDirty(true);
    syncLive(g);
  };

  const undo = () => {
    const h = historyRef.current;
    const cur = graphRef.current;
    if (!h.length || !cur) return;
    setHistory(h.slice(0, -1));
    setFuture([...futureRef.current, cur]);
    restore(h[h.length - 1]);
  };

  const redo = () => {
    const f = futureRef.current;
    const cur = graphRef.current;
    if (!f.length || !cur) return;
    setFuture(f.slice(0, -1));
    setHistory([...historyRef.current, cur]);
    restore(f[f.length - 1]);
  };

  // File-level collaboration, matching the desktop editor: the session joins
  // automatically once the diagram is loaded (room = diagram id) and leaves on
  // unmount — no toggle. Presence avatars appear whenever someone else is in.
  useEffect(() => {
    if (!docLoaded || !user) return;
    const applyRemote = (m: { nodes: Record<string, unknown>[]; links: Record<string, unknown>[] }) =>
      setGraph({ nodes: m.nodes.map(nodeFromRaw), links: m.links.map(linkFromRaw) });
    // Patch only the changed cells — O(changes), not O(graph) — so a remote
    // drag re-renders just that node and its wires, in real time.
    const applyRemoteOps = (ops: import('../collab/collab').RemoteOp[]) =>
      setGraph((g) => {
        if (!g) return g;
        let nodes = g.nodes;
        let links = g.links;
        for (const op of ops) {
          if (op.kind === 'node') {
            if (!op.data) {
              nodes = nodes.filter((n) => n.key !== op.key);
            } else {
              const nn = nodeFromRaw(op.data);
              const i = nodes.findIndex((n) => n.key === op.key);
              nodes = i >= 0 ? nodes.map((n) => (n.key === op.key ? nn : n)) : [...nodes, nn];
            }
          } else {
            if (!op.data) {
              links = links.filter((l) => linkId(l) !== op.key);
            } else {
              const nl = linkFromRaw(op.data);
              const i = links.findIndex((l) => linkId(l) === op.key);
              links = i >= 0 ? links.map((l) => (linkId(l) === op.key ? nl : l)) : [...links, nl];
            }
          }
        }
        return nodes === g.nodes && links === g.links ? g : { nodes, links };
      });
    const s = new CollabSession(
      id,
      { name: user.name || user.email, uid: user.email },
      {
        onRemoteModel: applyRemote,
        onRemoteOps: applyRemoteOps,
        onPeers: setPeers,
        onSync: (roomHasContent) => {
          if (roomHasContent) applyRemote(s.model());
          else {
            const g = graphRef.current;
            if (g) s.seed(g.nodes.map((n) => n.raw), g.links.map((l) => l.raw));
          }
        },
        onChat: (msgs) => {
          setChatMsgs(msgs);
          // Badge fresh messages from others while the chat sheet is closed.
          const known = chatKnownRef.current;
          let fresh = 0;
          for (const m of msgs) {
            if (known.has(m.id)) continue;
            known.add(m.id);
            if (!m.isSelf && Date.now() - m.ts < 60_000 && !chatOpenRef.current) fresh += 1;
          }
          if (fresh) setChatUnread((c) => c + fresh);
        },
      },
    );
    sessionRef.current = s;
    setMyColor(s.color);
    return () => {
      s.destroy();
      sessionRef.current = null;
      setPeers([]);
      setChatMsgs([]);
      setChatUnread(0);
      chatKnownRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docLoaded, id, user]);

  const serialize = () =>
    JSON.stringify({
      class: 'GraphLinksModel',
      linkFromPortIdProperty: 'fromPort',
      linkToPortIdProperty: 'toPort',
      nodeDataArray: (graph?.nodes ?? []).map((n) => n.raw),
      linkDataArray: (graph?.links ?? []).map((l) => l.raw),
    });

  useEffect(() => {
    if (q.data) {
      setGraph(parseModel(q.data.contentJson));
      setName(q.data.name);
      setClassification(q.data.classification ?? 'INTERNAL');
      setHistory([]);
      setFuture([]);
      setDocLoaded(true);
    }
  }, [q.data]);

  // Snapshot once at the start of a drag so the whole drag is a single undo step.
  const onNodeGrab = () => {
    const prev = graphRef.current;
    if (prev) setHistory((h) => [...h.slice(-49), prev]);
    setFuture([]);
  };

  // cx,cy are the node CENTRE (both canvases report centre-based positions).
  const moveNode = (key: string, cx: number, cy: number) => {
    const loc = `${Math.round(cx)} ${Math.round(cy)}`;
    setGraph((g) =>
      !g
        ? g
        : {
            ...g,
            nodes: g.nodes.map((n) =>
              n.key === key ? { ...n, x: cx - n.w / 2, y: cy - n.h / 2, raw: { ...n.raw, loc } } : n,
            ),
          },
    );
    setDirty(true);
    const node = graphRef.current?.nodes.find((n) => n.key === key);
    if (node) sessionRef.current?.setNode(key, { ...node.raw, loc });
  };

  // Live position stream during a drag: push to the room only (no local graph
  // rebuild, no history) so collaborators see the node move in real time while
  // the local canvas keeps rendering it via its own lightweight drag overlay.
  const moveNodeLive = (key: string, cx: number, cy: number) => {
    const node = graphRef.current?.nodes.find((n) => n.key === key);
    if (node) sessionRef.current?.setNode(key, { ...node.raw, loc: `${Math.round(cx)} ${Math.round(cy)}` });
  };

  const styleSelectedEdge = (patch: WireStyle) => {
    const g = graphRef.current;
    if (!g || !selectedEdge) return;
    const ng = styleLink(g, selectedEdge, patch);
    commit(ng);
    syncLive(ng);
  };

  const deleteSelectedEdge = () => {
    const g = graphRef.current;
    if (!g || !selectedEdge) return;
    const ng = deleteLink(g, selectedEdge);
    commit(ng);
    syncLive(ng);
    setSelectedEdge(null);
    setEdgeSheet(false);
  };

  const cycleClassification = () =>
    setClassification((c) => {
      const i = CLASSIFICATIONS.indexOf(c as (typeof CLASSIFICATIONS)[number]);
      setDirty(true);
      return CLASSIFICATIONS[(i + 1) % CLASSIFICATIONS.length];
    });

  const onSelect = (key: string | null) => {
    if (!connectMode) {
      setSelected(key);
      if (key) setSelectedEdge(null);
      return;
    }
    if (!key) return;
    if (!connectFrom) {
      setConnectFrom(key);
    } else if (connectFrom !== key) {
      const g = graphRef.current;
      if (g) {
        const ng = addLink(g, connectFrom, key);
        commit(ng);
        const l = ng.links[ng.links.length - 1];
        if (l) sessionRef.current?.setLink(linkKey(l), l.raw);
      }
      setConnectFrom(null);
      setConnectMode(false);
    }
  };

  const onPick = (block: BlockType) => {
    const g = graphRef.current;
    if (!g) return;
    const b = contentBounds(g);
    const off = 24 * (placeCount.current % 6);
    placeCount.current += 1;
    const { graph: ng, key } = addNode(g, block, b.x + b.w / 2 + off, b.y + b.h / 2 + off);
    commit(ng);
    setSelected(key);
    setSelectedEdge(null);
    const node = ng.nodes.find((n) => n.key === key);
    if (node) sessionRef.current?.setNode(key, node.raw);
  };

  const removeSelected = () => {
    if (selectedEdge) {
      deleteSelectedEdge();
      return;
    }
    if (!selected) return;
    const g = graphRef.current;
    if (g) commit(deleteNode(g, selected));
    sessionRef.current?.deleteNode(selected);
    setSelected(null);
  };

  // Sync a single node's data into the shared collab room after an edit.
  const syncNode = (g: DiagramGraph, key: string) => {
    const node = g.nodes.find((n) => n.key === key);
    if (node) sessionRef.current?.setNode(key, node.raw);
  };

  // Attach a part to the selected component as `attachedParts` metadata.
  const onAttach = (part: Part, quantity = 1) => {
    if (!selected) return false;
    const g = graphRef.current;
    if (!g) return false;
    const node = g.nodes.find((n) => n.key === selected);
    if (node && isPartAttached(node.raw, part.partNumber)) {
      Alert.alert('Already attached', `${part.partNumber} is already on "${node.text || 'this block'}".`);
      return false;
    }
    const ng = attachPart(g, selected, part, quantity);
    commit(ng);
    syncNode(ng, selected);
    return true;
  };

  // Part-search pick: requires a selected component, then attaches (like the desktop).
  const onPickPart = (part: Part, quantity = 1) => {
    if (!selected) {
      Alert.alert('Select a component', 'Tap a component on the canvas first, then add the part to attach it.');
      return;
    }
    onAttach(part, quantity);
  };

  // Design-Win pick: attach to the selected component, else drop it as a part node on the canvas.
  const onPickDwPart = (part: Part, quantity = 1) => {
    if (selected) {
      onAttach(part, quantity);
      return;
    }
    const g = graphRef.current;
    if (!g) return;
    const b = contentBounds(g);
    const { graph: ng, key } = addPartNode(g, part, b.x + b.w + 80, b.y + 40, quantity);
    commit(ng);
    setSelected(key);
    syncNode(ng, key);
  };

  // Quantity + removal for an attached part (index into the node's list).
  const onSetPartQty = (index: number, qty: number) => {
    if (!selected) return;
    const g = graphRef.current;
    if (!g) return;
    const ng = setAttachedQty(g, selected, index, qty);
    commit(ng);
    syncNode(ng, selected);
  };
  const onRemovePart = (index: number) => {
    if (!selected) return;
    const g = graphRef.current;
    if (!g) return;
    const ng = removeAttachedPart(g, selected, index);
    commit(ng);
    syncNode(ng, selected);
  };

  const save = useMutation({
    mutationFn: () =>
      diagramsApi.update(id, {
        name,
        contentJson: serialize(),
        classification,
      }),
    onSuccess: () => setDirty(false),
  });

  const restoreContent = (contentJson: string) => {
    const g = parseModel(contentJson);
    commit(g);
    setSelected(null);
    setSelectedEdge(null);
  };

  // Merge an imported graph into the canvas, re-keying to avoid key collisions.
  const importGraph = (imported: DiagramGraph, title: string) => {
    const cur = graphRef.current;
    if (!cur || cur.nodes.length === 0) {
      commit(imported);
      if (!name || name === 'Editor' || name === 'Untitled diagram') setName(title);
      syncLive(imported);
      return;
    }
    let base = 0;
    for (const n of cur.nodes) base = Math.max(base, parseInt(n.key, 10) || 0);
    const remap: Record<string, string> = {};
    const nodes = imported.nodes.map((n) => {
      const key = `${(base += 1)}`;
      remap[n.key] = key;
      return nodeFromRaw({ ...n.raw, key });
    });
    const links = imported.links
      .filter((l) => remap[l.from] && remap[l.to])
      .map((l) => linkFromRaw({ ...l.raw, from: remap[l.from], to: remap[l.to] }));
    const ng = { nodes: [...cur.nodes, ...nodes], links: [...cur.links, ...links] };
    commit(ng);
    syncLive(ng);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <IconButton
          name="chevron-back"
          color={colors.chromeText}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Diagrams'))}
        />
        <Pressable style={styles.titleWrap} onPress={() => setRenaming(true)}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
          <Icon name="create-outline" size={13} color={colors.chromeSubtext} />
        </Pressable>
        <View>
          <IconButton
            name="chatbubble-ellipses"
            color={colors.chromeText}
            onPress={() => {
              setChatOpen(true);
              setChatUnread(0);
            }}
          />
          {chatUnread > 0 ? (
            <View style={styles.chatBadge} pointerEvents="none">
              <Text style={styles.chatBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
            </View>
          ) : null}
        </View>
        <Pressable style={styles.presence} onPress={() => setRosterOpen(true)} hitSlop={6}>
          {peers.slice(0, 3).map((p, i) => (
            <View key={i} style={[styles.avatar, { backgroundColor: p.color, marginLeft: i ? -8 : 0 }]}>
              <Text style={styles.avatarText}>{(p.name[0] ?? '?').toUpperCase()}</Text>
            </View>
          ))}
          {peers.length > 3 ? <Text style={styles.more}>+{peers.length - 3}</Text> : null}
          {/* Always show a people chip so you can see who's in the session. */}
          <View style={[styles.peopleChip, peers.length ? { marginLeft: 6 } : null]}>
            <Icon name="people" size={15} color={colors.chromeText} />
            <Text style={styles.peopleCount}>{peers.length + 1}</Text>
          </View>
        </Pressable>
        <IconButton
          name={dirty ? 'save' : 'checkmark-done'}
          color={dirty ? colors.wire : colors.chromeSubtext}
          disabled={!dirty || save.isPending}
          onPress={() => save.mutate()}
        />
        <IconButton name="ellipsis-horizontal" color={colors.chromeText} onPress={() => setMenuOpen(true)} />
      </View>

      <Pressable style={styles.classBanner} onPress={cycleClassification}>
        <View style={[styles.classDot, { backgroundColor: CLASS_COLORS[classification] ?? colors.primary }]} />
        <Text style={[styles.classText, { color: CLASS_COLORS[classification] ?? colors.primary }]}>
          {classification}
        </Text>
        <Text style={styles.classHint}>· {t('class.tap')}</Text>
      </Pressable>

      {connectMode ? (
        <View style={styles.hint}>
          <Icon name="git-network" size={15} color="#fff" />
          <Text style={styles.hintText}>{connectFrom ? t('hint.connect2') : t('hint.connect1')}</Text>
        </View>
      ) : selectedEdge ? (
        <Pressable style={[styles.hint, { backgroundColor: colors.accent }]} onPress={() => setEdgeSheet(true)}>
          <Icon name="color-wand" size={15} color="#1a1303" />
          <Text style={[styles.hintText, { color: '#1a1303' }]}>{t('hint.wire')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.bodyRow}>
        {wide ? (
          <View style={styles.rail}>
            <Text style={styles.railTitle}>Components</Text>
            <PaletteGrid columns={1} onPick={onPick} />
          </View>
        ) : null}
        <View style={styles.canvasWrap}>
        {q.isLoading || !graph ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : q.isError ? (
          <View style={styles.center}>
            <Text style={{ color: colors.danger }}>{(q.error as Error).message}</Text>
          </View>
        ) : (
          <DiagramCanvas
            graph={graph}
            selectedKey={connectMode ? connectFrom : selected}
            selectedEdge={connectMode ? null : selectedEdge}
            onSelect={onSelect}
            onSelectEdge={(eid) => {
              setSelectedEdge(eid);
              if (eid) setSelected(null);
            }}
            onNodeGrab={connectMode ? undefined : onNodeGrab}
            onNodeMove={connectMode ? () => {} : moveNode}
            onNodeMoveLive={connectMode ? undefined : moveNodeLive}
            onLinkCreate={(from, to, fromPort, toPort) => {
              const g = graphRef.current;
              if (!g) return;
              const ng = addLink(g, from, to, fromPort, toPort);
              commit(ng);
              const l = ng.links[ng.links.length - 1];
              if (l) sessionRef.current?.setLink(linkKey(l), l.raw);
            }}
          />
        )}
        {selectedNode && nodeHasDetails(selectedNode) ? (
          <NodeDetailsCard
            node={selectedNode}
            onClose={() => setSelected(null)}
            onSetQty={onSetPartQty}
            onRemove={onRemovePart}
            onAddPart={() => setPartOpen(true)}
          />
        ) : null}
        </View>
      </View>

      <View style={styles.status}>
        <Text style={styles.statusText}>
          {graph ? `${graph.nodes.length} ${t('status.nodes')} · ${graph.links.length} ${t('status.links')}` : ''}
        </Text>
        {dirty ? <View style={styles.dot} /> : null}
        <View style={{ flex: 1 }} />
        <ToolIcon name="arrow-undo" disabled={history.length === 0} onPress={undo} />
        <ToolIcon name="arrow-redo" disabled={future.length === 0} onPress={redo} />
        <ToolIcon
          name="trash"
          color={colors.danger}
          disabled={!selected && !selectedEdge}
          onPress={removeSelected}
        />
      </View>

      <View style={styles.toolbar}>
        {wide ? null : <ToolBtn icon="add-circle" label={t('tool.add')} onPress={() => setPaletteOpen(true)} />}
        <ToolBtn
          icon="git-network"
          label={t('tool.connect')}
          active={connectMode}
          onPress={() => {
            setConnectMode((v) => !v);
            setConnectFrom(null);
          }}
        />
        <ToolBtn icon="hardware-chip" label={t('tool.part')} onPress={() => setPartOpen(true)} />
        <ToolBtn icon="pricetag" label={t('tool.dw')} onPress={() => setDwOpen(true)} />
        {selectedEdge ? <ToolBtn icon="color-wand" label={t('tool.wire')} onPress={() => setEdgeSheet(true)} /> : null}
      </View>

      <EdgeStyleSheet
        visible={edgeSheet}
        link={selectedLink}
        onClose={() => setEdgeSheet(false)}
        onChange={styleSelectedEdge}
        onDelete={deleteSelectedEdge}
      />

      <PaletteSheet visible={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={onPick} />
      <PartSearchModal
        visible={partOpen}
        seed={partSeed}
        onClose={() => {
          setPartOpen(false);
          setPartSeed('');
        }}
        onPick={(p) => onPickPart(p)}
      />
      <DesignWinModal visible={dwOpen} onClose={() => setDwOpen(false)} onPick={(p, qty) => onPickDwPart(p, qty)} />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation?.()}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <MenuHeader>{t('hdr.ai')}</MenuHeader>
              <MenuRow icon="sparkles" label={t('menu.recs')} onPress={() => { setMenuOpen(false); setPanel('recs'); }} />
              <MenuRow icon="clipboard" label={t('menu.review')} onPress={() => { setMenuOpen(false); setPanel('review'); }} />
              <MenuRow
                icon="extension-puzzle"
                label={t('menu.box')}
                disabled={!selected}
                onPress={() => { setMenuOpen(false); setPanel('box'); }}
              />
              <MenuRow icon="image" label={t('menu.image')} onPress={() => { setMenuOpen(false); setPanel('image'); }} />

              <MenuHeader>{t('hdr.sourcing')}</MenuHeader>
              <MenuRow
                icon="pulse"
                label={t('menu.lifecycle')}
                disabled={!selectedPartNumber}
                onPress={() => { setMenuOpen(false); setPanel('lifecycle'); }}
              />
              <MenuRow icon="receipt" label={t('menu.bom')} onPress={() => { setMenuOpen(false); setPanel('bom'); }} />

              <MenuHeader>{t('hdr.collab')}</MenuHeader>
              <MenuRow icon="chatbubbles" label={t('menu.comments')} onPress={() => { setMenuOpen(false); setPanel('comments'); }} />
              <MenuRow icon="git-pull-request" label={t('menu.feedback')} onPress={() => { setMenuOpen(false); setPanel('feedback'); }} />
              <MenuRow icon="star" label={t('menu.reviews')} onPress={() => { setMenuOpen(false); setPanel('reviews'); }} />

              <MenuHeader>{t('hdr.document')}</MenuHeader>
              <MenuRow icon="grid" label={t('menu.templates')} onPress={() => { setMenuOpen(false); setPanel('templates'); }} />
              <MenuRow icon="time" label={t('menu.versions')} onPress={() => { setMenuOpen(false); setPanel('versions'); }} />
              <MenuRow icon="language" label={t('menu.language')} onPress={() => { setMenuOpen(false); setPanel('lang'); }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <RecommendationsModal
        visible={panel === 'recs'}
        onClose={() => setPanel(null)}
        goal={aiGoal}
        currentParts={currentParts}
        onAddPart={(query) => {
          setPanel(null);
          setPartSeed(query);
          setPartOpen(true);
        }}
      />
      <DesignReviewModal
        visible={panel === 'review'}
        onClose={() => setPanel(null)}
        goal={aiGoal}
        blocks={reviewBlocks}
        links={reviewLinks}
      />
      <LifecycleModal
        visible={panel === 'lifecycle'}
        onClose={() => setPanel(null)}
        partNumber={selectedPartNumber}
        onAddAlternative={(alt) => {
          addAlternative(alt);
          setPanel(null);
        }}
      />
      <BoxSuggestModal
        visible={panel === 'box'}
        onClose={() => setPanel(null)}
        node={selectedNode}
        onLink={linkComp}
        onUnlink={unlinkComp}
      />
      <BomModal visible={panel === 'bom'} onClose={() => setPanel(null)} graph={graph} name={name} />
      <TemplatesModal
        visible={panel === 'templates'}
        onClose={() => setPanel(null)}
        currentContent={serialize}
        onUse={restoreContent}
      />
      <ImageImportModal visible={panel === 'image'} onClose={() => setPanel(null)} onImport={importGraph} />

      <Modal visible={panel === 'lang'} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPanel(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('lang.title')}</Text>
            {languages.map((l) => (
              <Pressable
                key={l.code}
                style={styles.langRow}
                onPress={() => {
                  setLang(l.code);
                  setPanel(null);
                }}
              >
                <Text style={[styles.langLabel, l.code === lang && { color: colors.primary, fontWeight: '800' }]}>
                  {l.label}
                </Text>
                {l.code === lang ? <Text style={styles.langCheck}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <SessionChatSheet
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMsgs}
        onSend={(text) => sessionRef.current?.sendChat(text, lang)}
      />

      <Modal visible={rosterOpen} transparent animationType="fade" onRequestClose={() => setRosterOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRosterOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>In this session ({peers.length + 1})</Text>
            <View style={styles.rosterRow}>
              <View style={[styles.rosterDot, { backgroundColor: myColor }]} />
              <Text style={styles.rosterName}>{user?.name || user?.email || 'You'}</Text>
              <Text style={styles.rosterYou}>You</Text>
            </View>
            {peers.map((p, i) => (
              <View key={i} style={styles.rosterRow}>
                <View style={[styles.rosterDot, { backgroundColor: p.color }]} />
                <Text style={styles.rosterName} numberOfLines={1}>{p.name || 'Collaborator'}</Text>
              </View>
            ))}
            {peers.length === 0 ? (
              <Text style={styles.rosterHint}>No one else is here yet. Share this diagram to collaborate live.</Text>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <CommentsModal visible={panel === 'comments'} onClose={() => setPanel(null)} diagramId={id} />
      <FeedbackModal visible={panel === 'feedback'} onClose={() => setPanel(null)} diagramId={id} />
      <ReviewsModal visible={panel === 'reviews'} onClose={() => setPanel(null)} diagramId={id} />
      <VersionsModal
        visible={panel === 'versions'}
        onClose={() => setPanel(null)}
        diagramId={id}
        currentContent={serialize}
        onRestore={restoreContent}
      />

      <RenameModal
        visible={renaming}
        value={name}
        onCancel={() => setRenaming(false)}
        onSave={(v) => {
          setRenaming(false);
          if (v.trim() && v.trim() !== name) {
            setName(v.trim());
            setDirty(true);
          }
        }}
      />
    </SafeAreaView>
  );
}

// Whether a node has anything worth showing in the details "sticky note".
function nodeHasDetails(node: DiagramNode): boolean {
  return (
    attachedParts(node.raw).length > 0 ||
    linkedComponents(node.raw).length > 0 ||
    !!(node.value && String(node.value).trim())
  );
}

// Card for the selected node: attached parts with quantity steppers, remove and
// "Add part", plus AI-linked components — mirrors the Angular parts panel.
function NodeDetailsCard({
  node,
  onClose,
  onSetQty,
  onRemove,
  onAddPart,
}: {
  node: DiagramNode;
  onClose: () => void;
  onSetQty: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
  onAddPart: () => void;
}) {
  const parts = attachedParts(node.raw);
  const comps = linkedComponents(node.raw);
  return (
    <View style={styles.detailCard} pointerEvents="box-none">
      <View style={styles.detailInner}>
        <View style={styles.detailHead}>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {node.text || node.shape || 'Component'}
            {node.value ? <Text style={styles.detailValue}>{`  ·  ${node.value}`}</Text> : null}
          </Text>
          <Pressable hitSlop={8} onPress={onClose}>
            <Text style={styles.detailClose}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.partsHeadRow}>
          <Text style={styles.detailSection}>{`Attached parts (${parts.length})`}</Text>
          <Pressable style={styles.addPartBtn} onPress={onAddPart} hitSlop={6}>
            <Text style={styles.addPartText}>+ Add part</Text>
          </Pressable>
        </View>

        {parts.length ? (
          parts.map((p: any, i) => {
            const meta = [p.manufacturer, p.supplier].filter(Boolean).join(' · ');
            const qty = Number(p.quantity) || 1;
            return (
              <View key={i} style={styles.partRow}>
                <View style={styles.partInfo}>
                  <Text style={styles.partMpn} numberOfLines={1}>{p.partNumber || 'Part'}</Text>
                  {meta ? <Text style={styles.detailMeta} numberOfLines={1}>{meta}</Text> : null}
                </View>
                <View style={styles.qtyBox}>
                  <Pressable style={styles.qtyBtn} hitSlop={6} onPress={() => onSetQty(i, qty - 1)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>{qty}</Text>
                  <Pressable style={styles.qtyBtn} hitSlop={6} onPress={() => onSetQty(i, qty + 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                </View>
                <Pressable hitSlop={8} onPress={() => onRemove(i)} style={styles.partRemove}>
                  <Text style={styles.partRemoveText}>✕</Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <Text style={styles.detailMeta}>No parts yet — tap “+ Add part”.</Text>
        )}

        {comps.length ? (
          <Text style={[styles.detailRow, { marginTop: 8 }]} numberOfLines={2}>
            <Text style={styles.detailSection}>AI components: </Text>
            {comps.map((c: any) => c.partNumber).filter(Boolean).join(', ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MenuHeader({ children }: { children: React.ReactNode }) {
  return <Text style={styles.menuHeader}>{children}</Text>;
}

function MenuRow({
  icon,
  label,
  onPress,
  disabled,
  tint,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={disabled ? undefined : onPress}>
      <View style={[styles.menuIcon, disabled && { opacity: 0.4 }]}>
        <Icon name={icon} size={18} color={tint ?? colors.primary} />
      </View>
      <Text style={[styles.menuText, disabled && { opacity: 0.4 }]}>{label}</Text>
    </Pressable>
  );
}

function ToolBtn({
  icon,
  label,
  onPress,
  active,
  disabled,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.toolBtn,
        active && styles.toolBtnActive,
        { opacity: disabled ? 0.35 : pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name={icon} size={20} color={active ? colors.onPrimary : colors.chromeText} />
      <Text style={[styles.toolBtnText, active && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function ToolIcon({
  name,
  onPress,
  disabled,
  color = colors.chromeText,
}: {
  name: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable hitSlop={6} onPress={disabled ? undefined : onPress} style={{ opacity: disabled ? 0.3 : 1, paddingHorizontal: 8 }}>
      <Icon name={name} size={20} color={color} />
    </Pressable>
  );
}

function RenameModal({
  visible,
  value,
  onCancel,
  onSave,
}: {
  visible: boolean;
  value: string;
  onCancel: () => void;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value, visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Rename diagram</Text>
          <TextInput value={text} onChangeText={setText} style={styles.modalInput} autoFocus />
          <View style={styles.modalRow}>
            <Pressable onPress={onCancel}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onSave(text)}>
              <Text style={styles.modalSave}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chrome },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: colors.chrome,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.chromeBorder,
  },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 4 },
  headerTitle: { color: colors.chromeText, fontSize: 16, fontFamily: fonts.bold, maxWidth: '80%' },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 9, paddingHorizontal: 16 },
  hintText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  classBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  classDot: { width: 7, height: 7, borderRadius: 4 },
  classText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  classHint: { color: colors.faint, fontSize: 10 },
  bodyRow: { flex: 1, flexDirection: 'row' },
  rail: { width: 268, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: 12, paddingTop: 12 },
  railTitle: { ...font.overline, color: colors.faint, marginBottom: 10, paddingHorizontal: 2 },
  canvasWrap: { flex: 1, backgroundColor: colors.canvasBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.chrome, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chromeBorder },
  statusText: { color: colors.chromeSubtext, fontSize: 12 },
  dot: { marginLeft: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.chrome,
  },
  toolBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.chromeAlt },
  toolBtnActive: { backgroundColor: colors.primary },
  toolBtnText: { color: colors.chromeSubtext, fontSize: 11, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.55)', justifyContent: 'center', padding: 28 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, ...shadow(3) },
  modalTitle: { ...font.h3, color: colors.text, marginBottom: 14 },
  modalInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 50, fontSize: 16, color: colors.text, backgroundColor: colors.surfaceAlt },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 22, marginTop: 18 },
  modalCancel: { color: colors.subtext, fontSize: 15, fontWeight: '600' },
  modalSave: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.35)', paddingTop: 54, alignItems: 'flex-end', paddingRight: 10 },
  menu: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 8, minWidth: 260, maxWidth: 320, maxHeight: '80%', ...shadow(3) },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  menuItemPressed: { backgroundColor: colors.surfaceAlt },
  menuIcon: { width: 26, alignItems: 'center' },
  menuText: { fontSize: 15, color: colors.text, fontWeight: '500', flex: 1 },
  menuHeader: { ...font.overline, color: colors.faint, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  chatBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  presence: { flexDirection: 'row', alignItems: 'center', marginRight: 4, paddingHorizontal: 2 },
  peopleChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.chromeAlt, borderRadius: radius.pill, paddingHorizontal: 8, height: 26 },
  peopleCount: { color: colors.chromeText, fontSize: 12, fontWeight: '800' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  rosterDot: { width: 10, height: 10, borderRadius: 5 },
  rosterName: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  rosterYou: { fontSize: 11, fontWeight: '800', color: colors.primary },
  rosterHint: { color: colors.subtext, fontSize: 13, marginTop: 8, lineHeight: 19 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.chrome },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  more: { color: colors.chromeSubtext, fontSize: 12, marginLeft: 4 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  langLabel: { fontSize: 16, color: colors.text },
  langCheck: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  detailCard: { position: 'absolute', top: 10, left: 10, right: 10, alignItems: 'flex-start' },
  detailInner: { width: '100%', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, ...shadow(3) },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  detailValue: { color: colors.subtext, fontWeight: '500' },
  detailClose: { color: colors.subtext, fontSize: 14, fontWeight: '700' },
  detailSection: { color: colors.subtext, fontSize: 11, fontWeight: '700', marginTop: 6 },
  detailRow: { color: colors.text, fontSize: 11, marginTop: 3 },
  detailMeta: { color: colors.faint, fontSize: 11 },
  partsHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  addPartBtn: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  addPartText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 6 },
  partInfo: { flex: 1 },
  partMpn: { color: colors.text, fontSize: 12, fontWeight: '600' },
  qtyBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  qtyBtn: { paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.surface },
  qtyBtnText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  qtyValue: { minWidth: 26, textAlign: 'center', color: colors.text, fontSize: 12, fontWeight: '700' },
  partRemove: { paddingHorizontal: 4 },
  partRemoveText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
