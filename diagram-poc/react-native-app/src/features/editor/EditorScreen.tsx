import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { colors, font, radius, shadow } from '../../theme';
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
import { CollabSession, Peer } from '../collab/collab';
import { BlockType } from './catalogApi';
import DiagramCanvas from './DiagramCanvas';
import EdgeStyleSheet from './EdgeStyleSheet';
import {
  addLink,
  addNode,
  attachPart,
  deleteLink,
  deleteNode,
  graphPartNumbers,
  linkComponent,
  primaryPartNumber,
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
import { contentBounds, DiagramGraph, linkFromRaw, linkId, nodeFromRaw, parseModel } from './model';
import PaletteSheet, { PaletteGrid } from './PaletteSheet';

const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'RESTRICTED'] as const;
const CLASS_COLORS: Record<string, string> = { PUBLIC: '#15803d', INTERNAL: '#1d4ed8', RESTRICTED: '#b91c1c' };

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
  const [live, setLive] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
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

  useEffect(() => {
    if (!live || !user) return;
    const applyRemote = (m: { nodes: Record<string, unknown>[]; links: Record<string, unknown>[] }) =>
      setGraph({ nodes: m.nodes.map(nodeFromRaw), links: m.links.map(linkFromRaw) });
    const s = new CollabSession(
      id,
      { name: user.name || user.email, uid: user.email },
      {
        onRemoteModel: applyRemote,
        onPeers: setPeers,
        onSync: (roomHasContent) => {
          if (roomHasContent) applyRemote(s.model());
          else {
            const g = graphRef.current;
            if (g) s.seed(g.nodes.map((n) => n.raw), g.links.map((l) => l.raw));
          }
        },
      },
    );
    sessionRef.current = s;
    return () => {
      s.destroy();
      sessionRef.current = null;
      setPeers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, id, user]);

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

  const onAttach = (part: Part, quantity = 1) => {
    if (!selected) return;
    const g = graphRef.current;
    if (!g) return;
    const ng = attachPart(g, selected, part, quantity);
    commit(ng);
    const node = ng.nodes.find((n) => n.key === selected);
    if (node) sessionRef.current?.setNode(selected, node.raw);
  };

  // Part search picks: attach to the selected node, else drop a part card on the
  // canvas (like the desktop app), so search works without a prior selection.
  const onPickPart = (part: Part, quantity = 1) => {
    if (selected) {
      onAttach(part, quantity);
      return;
    }
    const g = graphRef.current;
    if (!g) return;
    const b = contentBounds(g);
    const block: BlockType = {
      key: `part-${part.partNumber}`,
      label: part.partNumber,
      category: part.manufacturer || 'Part',
      color: '#f59e0b',
      icon: 'memory',
    };
    const { graph: ng, key } = addNode(g, block, b.x + b.w / 2, b.y + b.h / 2);
    const ng2 = attachPart(ng, key, part, quantity);
    commit(ng2);
    setSelected(key);
    const node = ng2.nodes.find((n) => n.key === key);
    if (node) sessionRef.current?.setNode(key, node.raw);
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
      <View style={styles.header}>
        <IconButton
          name="chevron-back"
          color={colors.canvasText}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Diagrams'))}
        />
        <Pressable style={styles.titleWrap} onPress={() => setRenaming(true)}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
          <Icon name="create-outline" size={13} color={colors.canvasSubtext} />
        </Pressable>
        {live ? (
          <View style={styles.presence}>
            {peers.slice(0, 3).map((p, i) => (
              <View key={i} style={[styles.avatar, { backgroundColor: p.color, marginLeft: i ? -8 : 0 }]}>
                <Text style={styles.avatarText}>{(p.name[0] ?? '?').toUpperCase()}</Text>
              </View>
            ))}
            {peers.length > 3 ? <Text style={styles.more}>+{peers.length - 3}</Text> : null}
          </View>
        ) : null}
        <IconButton
          name={dirty ? 'save' : 'checkmark-done'}
          color={dirty ? colors.wire : colors.canvasSubtext}
          disabled={!dirty || save.isPending}
          onPress={() => save.mutate()}
        />
        <IconButton name="ellipsis-horizontal" color={colors.canvasText} onPress={() => setMenuOpen(true)} />
      </View>

      <Pressable
        style={[styles.classBanner, { backgroundColor: CLASS_COLORS[classification] ?? colors.primary }]}
        onPress={cycleClassification}
      >
        <Icon name="lock-closed" size={11} color="#fff" />
        <Text style={styles.classText}>{classification}</Text>
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
      <DesignWinModal visible={dwOpen} onClose={() => setDwOpen(false)} onPick={(p, qty) => onPickPart(p, qty)} />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation?.()}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Pressable
                style={({ pressed }) => [styles.menuItem, live && styles.menuItemLive, pressed && styles.menuItemPressed]}
                onPress={() => {
                  setMenuOpen(false);
                  setLive((v) => !v);
                }}
              >
                <View style={styles.menuIcon}>
                  <Icon name="people" size={18} color={live ? colors.success : colors.primary} />
                </View>
                <Text style={styles.menuText}>{live ? t('menu.golive.on') : t('menu.golive')}</Text>
                {live ? <View style={styles.liveDot} /> : null}
              </Pressable>

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
      <Icon name={icon} size={20} color={active ? colors.onPrimary : colors.canvasText} />
      <Text style={[styles.toolBtnText, active && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function ToolIcon({
  name,
  onPress,
  disabled,
  color = colors.canvasText,
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
  root: { flex: 1, backgroundColor: colors.canvasBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: colors.canvasSurface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.canvasBorder,
  },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 4 },
  headerTitle: { color: colors.canvasText, fontSize: 16, fontWeight: '700', maxWidth: '80%' },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 9, paddingHorizontal: 16 },
  hintText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  classBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 4 },
  classText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  classHint: { color: 'rgba(255,255,255,0.72)', fontSize: 10 },
  bodyRow: { flex: 1, flexDirection: 'row' },
  rail: { width: 268, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: 12, paddingTop: 12 },
  railTitle: { ...font.overline, color: colors.faint, marginBottom: 10, paddingHorizontal: 2 },
  canvasWrap: { flex: 1, backgroundColor: colors.canvasBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.canvasSurface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.canvasBorder },
  statusText: { color: colors.canvasSubtext, fontSize: 12 },
  dot: { marginLeft: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.canvasSurface,
  },
  toolBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.canvasSurface2 },
  toolBtnActive: { backgroundColor: colors.primary },
  toolBtnText: { color: colors.canvasSubtext, fontSize: 11, fontWeight: '600' },
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
  menuItemLive: { backgroundColor: colors.successSoft },
  menuIcon: { width: 26, alignItems: 'center' },
  menuText: { fontSize: 15, color: colors.text, fontWeight: '500', flex: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  menuHeader: { ...font.overline, color: colors.faint, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  presence: { flexDirection: 'row', alignItems: 'center', marginRight: 6 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.canvasSurface },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  more: { color: colors.canvasSubtext, fontSize: 12, marginLeft: 4 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  langLabel: { fontSize: 16, color: colors.text },
  langCheck: { color: colors.primary, fontSize: 16, fontWeight: '800' },
});
