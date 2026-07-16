/** Languages offered, matching the Angular app. */
export interface Language {
  code: string;
  label: string;
}
export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
];

export type TKey =
  | 'btn.back' | 'btn.save' | 'btn.cancel' | 'btn.rename' | 'btn.delete'
  | 'tool.add' | 'tool.connect' | 'tool.part' | 'tool.dw' | 'tool.wire'
  | 'menu.golive' | 'menu.golive.on' | 'menu.recs' | 'menu.review' | 'menu.box'
  | 'menu.lifecycle' | 'menu.bom' | 'menu.templates' | 'menu.image'
  | 'menu.comments' | 'menu.feedback' | 'menu.reviews' | 'menu.versions'
  | 'menu.language'
  | 'hdr.ai' | 'hdr.sourcing' | 'hdr.collab' | 'hdr.document'
  | 'hint.connect1' | 'hint.connect2' | 'hint.wire' | 'class.tap'
  | 'status.nodes' | 'status.links' | 'rename.title' | 'lang.title'
  | 'list.title' | 'list.new' | 'list.empty' | 'list.logout';

type Dict = Record<TKey, string>;

const en: Dict = {
  'btn.back': 'Back', 'btn.save': 'Save', 'btn.cancel': 'Cancel', 'btn.rename': 'Rename diagram', 'btn.delete': 'Delete',
  'tool.add': 'Add', 'tool.connect': 'Connect', 'tool.part': 'Part', 'tool.dw': 'DW', 'tool.wire': 'Wire',
  'menu.golive': 'Go live (collaborate)', 'menu.golive.on': 'Live: on — tap to stop',
  'menu.recs': 'Recommendations (AI)', 'menu.review': 'Design review (AI)', 'menu.box': 'Suggest components',
  'menu.lifecycle': 'Check part lifecycle', 'menu.bom': 'Bill of materials', 'menu.templates': 'Templates',
  'menu.image': 'Image → diagram', 'menu.comments': 'Comments', 'menu.feedback': 'Feedback loop',
  'menu.reviews': 'Reviews & ratings', 'menu.versions': 'Version history', 'menu.language': 'Language',
  'hdr.ai': 'AI tools', 'hdr.sourcing': 'Sourcing', 'hdr.collab': 'Collaboration', 'hdr.document': 'Document',
  'hint.connect1': 'Connect: tap the first component', 'hint.connect2': 'Tap the second component to connect',
  'hint.wire': 'Wire selected — tap to style · 🗑 removes it', 'class.tap': 'tap to change',
  'status.nodes': 'nodes', 'status.links': 'links', 'rename.title': 'Rename diagram', 'lang.title': 'Language',
  'list.title': 'Diagrams', 'list.new': 'New diagram', 'list.empty': 'No diagrams yet.', 'list.logout': 'Sign out',
};

const es: Dict = {
  'btn.back': 'Atrás', 'btn.save': 'Guardar', 'btn.cancel': 'Cancelar', 'btn.rename': 'Renombrar diagrama', 'btn.delete': 'Eliminar',
  'tool.add': 'Añadir', 'tool.connect': 'Conectar', 'tool.part': 'Pieza', 'tool.dw': 'DW', 'tool.wire': 'Cable',
  'menu.golive': 'Colaborar en vivo', 'menu.golive.on': 'En vivo — toca para parar',
  'menu.recs': 'Recomendaciones (IA)', 'menu.review': 'Revisión de diseño (IA)', 'menu.box': 'Sugerir componentes',
  'menu.lifecycle': 'Ciclo de vida de la pieza', 'menu.bom': 'Lista de materiales', 'menu.templates': 'Plantillas',
  'menu.image': 'Imagen → diagrama', 'menu.comments': 'Comentarios', 'menu.feedback': 'Ciclo de comentarios',
  'menu.reviews': 'Reseñas y valoraciones', 'menu.versions': 'Historial de versiones', 'menu.language': 'Idioma',
  'hdr.ai': 'Herramientas IA', 'hdr.sourcing': 'Abastecimiento', 'hdr.collab': 'Colaboración', 'hdr.document': 'Documento',
  'hint.connect1': 'Conectar: toca el primer componente', 'hint.connect2': 'Toca el segundo componente para conectar',
  'hint.wire': 'Cable seleccionado — toca para estilo · 🗑 lo elimina', 'class.tap': 'toca para cambiar',
  'status.nodes': 'nodos', 'status.links': 'enlaces', 'rename.title': 'Renombrar diagrama', 'lang.title': 'Idioma',
  'list.title': 'Diagramas', 'list.new': 'Nuevo diagrama', 'list.empty': 'Aún no hay diagramas.', 'list.logout': 'Cerrar sesión',
};

const fr: Dict = {
  'btn.back': 'Retour', 'btn.save': 'Enregistrer', 'btn.cancel': 'Annuler', 'btn.rename': 'Renommer le schéma', 'btn.delete': 'Supprimer',
  'tool.add': 'Ajouter', 'tool.connect': 'Relier', 'tool.part': 'Pièce', 'tool.dw': 'DW', 'tool.wire': 'Fil',
  'menu.golive': 'Collaborer en direct', 'menu.golive.on': 'En direct — toucher pour arrêter',
  'menu.recs': 'Recommandations (IA)', 'menu.review': 'Revue de conception (IA)', 'menu.box': 'Suggérer des composants',
  'menu.lifecycle': 'Cycle de vie de la pièce', 'menu.bom': 'Nomenclature', 'menu.templates': 'Modèles',
  'menu.image': 'Image → schéma', 'menu.comments': 'Commentaires', 'menu.feedback': 'Boucle de retours',
  'menu.reviews': 'Avis et notes', 'menu.versions': 'Historique des versions', 'menu.language': 'Langue',
  'hdr.ai': 'Outils IA', 'hdr.sourcing': 'Approvisionnement', 'hdr.collab': 'Collaboration', 'hdr.document': 'Document',
  'hint.connect1': 'Relier : touchez le premier composant', 'hint.connect2': 'Touchez le second composant pour relier',
  'hint.wire': 'Fil sélectionné — toucher pour le style · 🗑 le supprime', 'class.tap': 'toucher pour changer',
  'status.nodes': 'nœuds', 'status.links': 'liens', 'rename.title': 'Renommer le schéma', 'lang.title': 'Langue',
  'list.title': 'Schémas', 'list.new': 'Nouveau schéma', 'list.empty': 'Aucun schéma pour le moment.', 'list.logout': 'Se déconnecter',
};

const de: Dict = {
  'btn.back': 'Zurück', 'btn.save': 'Speichern', 'btn.cancel': 'Abbrechen', 'btn.rename': 'Diagramm umbenennen', 'btn.delete': 'Löschen',
  'tool.add': 'Hinzufügen', 'tool.connect': 'Verbinden', 'tool.part': 'Teil', 'tool.dw': 'DW', 'tool.wire': 'Leitung',
  'menu.golive': 'Live zusammenarbeiten', 'menu.golive.on': 'Live — zum Beenden tippen',
  'menu.recs': 'Empfehlungen (KI)', 'menu.review': 'Design-Review (KI)', 'menu.box': 'Komponenten vorschlagen',
  'menu.lifecycle': 'Lebenszyklus des Teils', 'menu.bom': 'Stückliste', 'menu.templates': 'Vorlagen',
  'menu.image': 'Bild → Diagramm', 'menu.comments': 'Kommentare', 'menu.feedback': 'Feedback-Schleife',
  'menu.reviews': 'Bewertungen', 'menu.versions': 'Versionsverlauf', 'menu.language': 'Sprache',
  'hdr.ai': 'KI-Werkzeuge', 'hdr.sourcing': 'Beschaffung', 'hdr.collab': 'Zusammenarbeit', 'hdr.document': 'Dokument',
  'hint.connect1': 'Verbinden: erste Komponente antippen', 'hint.connect2': 'Zweite Komponente zum Verbinden antippen',
  'hint.wire': 'Leitung gewählt — tippen zum Stylen · 🗑 entfernt sie', 'class.tap': 'zum Ändern tippen',
  'status.nodes': 'Knoten', 'status.links': 'Verbindungen', 'rename.title': 'Diagramm umbenennen', 'lang.title': 'Sprache',
  'list.title': 'Diagramme', 'list.new': 'Neues Diagramm', 'list.empty': 'Noch keine Diagramme.', 'list.logout': 'Abmelden',
};

const zh: Dict = {
  'btn.back': '返回', 'btn.save': '保存', 'btn.cancel': '取消', 'btn.rename': '重命名图表', 'btn.delete': '删除',
  'tool.add': '添加', 'tool.connect': '连接', 'tool.part': '元件', 'tool.dw': 'DW', 'tool.wire': '连线',
  'menu.golive': '实时协作', 'menu.golive.on': '实时中 — 点按停止',
  'menu.recs': '推荐 (AI)', 'menu.review': '设计评审 (AI)', 'menu.box': '建议元件',
  'menu.lifecycle': '查看元件生命周期', 'menu.bom': '物料清单', 'menu.templates': '模板',
  'menu.image': '图片 → 图表', 'menu.comments': '评论', 'menu.feedback': '反馈循环',
  'menu.reviews': '评分与评价', 'menu.versions': '版本历史', 'menu.language': '语言',
  'hdr.ai': 'AI 工具', 'hdr.sourcing': '采购', 'hdr.collab': '协作', 'hdr.document': '文档',
  'hint.connect1': '连接：点按第一个元件', 'hint.connect2': '点按第二个元件以连接',
  'hint.wire': '已选连线 — 点按设置样式 · 🗑 删除', 'class.tap': '点按更改',
  'status.nodes': '节点', 'status.links': '连线', 'rename.title': '重命名图表', 'lang.title': '语言',
  'list.title': '图表', 'list.new': '新建图表', 'list.empty': '暂无图表。', 'list.logout': '退出登录',
};

const ja: Dict = {
  'btn.back': '戻る', 'btn.save': '保存', 'btn.cancel': 'キャンセル', 'btn.rename': '図の名前を変更', 'btn.delete': '削除',
  'tool.add': '追加', 'tool.connect': '接続', 'tool.part': '部品', 'tool.dw': 'DW', 'tool.wire': '配線',
  'menu.golive': 'ライブ共同編集', 'menu.golive.on': 'ライブ中 — タップで停止',
  'menu.recs': 'おすすめ (AI)', 'menu.review': 'デザインレビュー (AI)', 'menu.box': '部品を提案',
  'menu.lifecycle': '部品ライフサイクル確認', 'menu.bom': '部品表', 'menu.templates': 'テンプレート',
  'menu.image': '画像 → 図', 'menu.comments': 'コメント', 'menu.feedback': 'フィードバックループ',
  'menu.reviews': 'レビューと評価', 'menu.versions': 'バージョン履歴', 'menu.language': '言語',
  'hdr.ai': 'AI ツール', 'hdr.sourcing': '調達', 'hdr.collab': 'コラボレーション', 'hdr.document': 'ドキュメント',
  'hint.connect1': '接続：最初の部品をタップ', 'hint.connect2': '2つ目の部品をタップして接続',
  'hint.wire': '配線を選択 — タップでスタイル · 🗑 で削除', 'class.tap': 'タップで変更',
  'status.nodes': 'ノード', 'status.links': 'リンク', 'rename.title': '図の名前を変更', 'lang.title': '言語',
  'list.title': '図', 'list.new': '新しい図', 'list.empty': 'まだ図がありません。', 'list.logout': 'サインアウト',
};

export const TRANSLATIONS: Record<string, Dict> = { en, es, fr, de, zh, ja };
