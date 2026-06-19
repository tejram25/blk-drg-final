// Generates the runtime translation table from a single dictionary.
//
//   node i18n/generate-i18n.mjs
//
// Writes src/app/i18n/translations.ts (consumed by TranslateService and the
// `translate` pipe). To add a string: use {{ 'my.id' | translate }} (or
// [matTooltip]="'my.id' | translate") in the template, add a row here with the
// same id + translations, and re-run this script.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LOCALES = ['es', 'fr', 'de', 'zh', 'ja'];

// id, then English source (en) and one column per target locale.
const M = [
  { id: 'app.brand', en: 'Diagram Builder', es: 'Generador de diagramas', fr: 'Générateur de diagrammes', de: 'Diagramm-Builder', zh: '图表生成器', ja: 'ダイアグラムビルダー' },
  { id: 'doc.placeholder', en: 'Untitled diagram', es: 'Diagrama sin título', fr: 'Diagramme sans titre', de: 'Unbenanntes Diagramm', zh: '未命名图表', ja: '無題のダイアグラム' },
  { id: 'doc.tooltip', en: 'Diagram name', es: 'Nombre del diagrama', fr: 'Nom du diagramme', de: 'Diagrammname', zh: '图表名称', ja: 'ダイアグラム名' },
  { id: 'open.tooltip', en: 'Open a saved diagram', es: 'Abrir un diagrama guardado', fr: 'Ouvrir un diagramme enregistré', de: 'Gespeichertes Diagramm öffnen', zh: '打开已保存的图表', ja: '保存したダイアグラムを開く' },
  { id: 'open.saved', en: 'Open saved…', es: 'Abrir guardado…', fr: 'Ouvrir un enregistré…', de: 'Gespeicherte öffnen…', zh: '打开已保存…', ja: '保存済みを開く…' },
  { id: 'btn.new', en: 'New', es: 'Nuevo', fr: 'Nouveau', de: 'Neu', zh: '新建', ja: '新規' },
  { id: 'btn.save', en: 'Save', es: 'Guardar', fr: 'Enregistrer', de: 'Speichern', zh: '保存', ja: '保存' },
  { id: 'tip.undo', en: 'Undo', es: 'Deshacer', fr: 'Annuler', de: 'Rückgängig', zh: '撤销', ja: '元に戻す' },
  { id: 'tip.redo', en: 'Redo', es: 'Rehacer', fr: 'Rétablir', de: 'Wiederholen', zh: '重做', ja: 'やり直し' },
  { id: 'tip.addImage', en: 'Add image', es: 'Agregar imagen', fr: 'Ajouter une image', de: 'Bild hinzufügen', zh: '添加图片', ja: '画像を追加' },
  { id: 'tip.exportJson', en: 'Export JSON', es: 'Exportar JSON', fr: 'Exporter le JSON', de: 'JSON exportieren', zh: '导出 JSON', ja: 'JSON をエクスポート' },

  { id: 'collab.collaborate', en: 'Collaborate', es: 'Colaborar', fr: 'Collaborer', de: 'Zusammenarbeiten', zh: '协作', ja: 'コラボレーション' },
  { id: 'common.online', en: 'online', es: 'en línea', fr: 'en ligne', de: 'online', zh: '在线', ja: 'オンライン' },
  { id: 'collab.join', en: 'Join collaboration', es: 'Unirse a la colaboración', fr: 'Rejoindre la collaboration', de: 'Zusammenarbeit beitreten', zh: '加入协作', ja: 'コラボレーションに参加' },
  { id: 'collab.yourName', en: 'Your name', es: 'Tu nombre', fr: 'Votre nom', de: 'Dein Name', zh: '你的名字', ja: 'あなたの名前' },
  { id: 'collab.namePlaceholder', en: 'e.g. Alex', es: 'p. ej. Alex', fr: 'p. ex. Alex', de: 'z. B. Alex', zh: '例如 Alex', ja: '例: Alex' },
  { id: 'collab.continue', en: 'Continue', es: 'Continuar', fr: 'Continuer', de: 'Weiter', zh: '继续', ja: '続行' },
  { id: 'collab.nameHint', en: 'Your name is shown to the host and other guests while you edit together.', es: 'Tu nombre se muestra al anfitrión y a los demás invitados mientras editan juntos.', fr: "Votre nom est affiché à l'hôte et aux autres invités pendant que vous éditez ensemble.", de: 'Dein Name wird dem Host und den anderen Gästen angezeigt, während ihr gemeinsam bearbeitet.', zh: '在共同编辑时，你的名字会显示给主持人和其他访客。', ja: '共同編集中、あなたの名前はホストや他のゲストに表示されます。' },
  { id: 'collab.signedInAs', en: 'Signed in as', es: 'Conectado como', fr: 'Connecté en tant que', de: 'Angemeldet als', zh: '已登录为', ja: 'ログイン中:' },
  { id: 'collab.change', en: 'Change', es: 'Cambiar', fr: 'Modifier', de: 'Ändern', zh: '更改', ja: '変更' },
  { id: 'collab.start', en: 'Start a session', es: 'Iniciar una sesión', fr: 'Démarrer une session', de: 'Sitzung starten', zh: '开始会话', ja: 'セッションを開始' },
  { id: 'collab.orJoin', en: 'or join one', es: 'o unirse a una', fr: 'ou en rejoindre une', de: 'oder einer beitreten', zh: '或加入一个', ja: 'または参加する' },
  { id: 'collab.codePlaceholder', en: '6-digit code', es: 'código de 6 dígitos', fr: 'code à 6 chiffres', de: '6-stelliger Code', zh: '6 位代码', ja: '6 桁のコード' },
  { id: 'collab.joinBtn', en: 'Join', es: 'Unirse', fr: 'Rejoindre', de: 'Beitreten', zh: '加入', ja: '参加' },
  { id: 'collab.startHint', en: 'Start a session to get a code to share, or enter a code you received from the host.', es: 'Inicia una sesión para obtener un código para compartir, o introduce un código que recibiste del anfitrión.', fr: "Démarrez une session pour obtenir un code à partager, ou saisissez un code reçu de l'hôte.", de: 'Starte eine Sitzung, um einen Code zum Teilen zu erhalten, oder gib einen vom Host erhaltenen Code ein.', zh: '开始会话以获取可分享的代码，或输入你从主持人处收到的代码。', ja: 'セッションを開始して共有用のコードを取得するか、ホストから受け取ったコードを入力してください。' },
  { id: 'collab.sessionActive', en: 'Session active', es: 'Sesión activa', fr: 'Session active', de: 'Sitzung aktiv', zh: '会话进行中', ja: 'セッション中' },
  { id: 'collab.copyCode', en: 'Copy code', es: 'Copiar código', fr: 'Copier le code', de: 'Code kopieren', zh: '复制代码', ja: 'コードをコピー' },
  { id: 'collab.shareHint', en: 'Share this code; whoever enters it joins this canvas. Valid 15 minutes.', es: 'Comparte este código; quien lo introduzca se une a este lienzo. Válido 15 minutos.', fr: 'Partagez ce code ; toute personne qui le saisit rejoint ce canevas. Valable 15 minutes.', de: 'Teile diesen Code; wer ihn eingibt, tritt dieser Leinwand bei. 15 Minuten gültig.', zh: '分享此代码；输入它的人将加入此画布。有效期 15 分钟。', ja: 'このコードを共有してください。入力した人がこのキャンバスに参加します。有効期間は 15 分です。' },
  { id: 'chat.inSession', en: 'In this session', es: 'En esta sesión', fr: 'Dans cette session', de: 'In dieser Sitzung', zh: '本次会话中', ja: 'このセッション' },
  { id: 'roster.host', en: 'Host', es: 'Anfitrión', fr: 'Hôte', de: 'Host', zh: '主持人', ja: 'ホスト' },
  { id: 'roster.you', en: 'You', es: 'Tú', fr: 'Vous', de: 'Du', zh: '你', ja: 'あなた' },
  { id: 'collab.leave', en: 'Leave session', es: 'Salir de la sesión', fr: 'Quitter la session', de: 'Sitzung verlassen', zh: '离开会话', ja: 'セッションを退出' },

  { id: 'chat.label', en: 'Chat', es: 'Chat', fr: 'Chat', de: 'Chat', zh: '聊天', ja: 'チャット' },
  { id: 'chat.tip', en: 'Session chat', es: 'Chat de la sesión', fr: 'Chat de la session', de: 'Sitzungs-Chat', zh: '会话聊天', ja: 'セッションチャット' },
  { id: 'chat.session', en: 'Session chat', es: 'Chat de la sesión', fr: 'Chat de la session', de: 'Sitzungs-Chat', zh: '会话聊天', ja: 'セッションチャット' },
  { id: 'chat.close', en: 'Close', es: 'Cerrar', fr: 'Fermer', de: 'Schließen', zh: '关闭', ja: '閉じる' },
  { id: 'chat.empty', en: 'No messages yet — say hello 👋', es: 'Aún no hay mensajes: saluda 👋', fr: "Aucun message pour l'instant — dites bonjour 👋", de: 'Noch keine Nachrichten – sag Hallo 👋', zh: '还没有消息——打个招呼吧 👋', ja: 'まだメッセージがありません — あいさつしましょう 👋' },
  { id: 'chat.placeholder', en: 'Type a message…', es: 'Escribe un mensaje…', fr: 'Écrivez un message…', de: 'Nachricht eingeben…', zh: '输入消息…', ja: 'メッセージを入力…' },
  { id: 'chat.send', en: 'Send', es: 'Enviar', fr: 'Envoyer', de: 'Senden', zh: '发送', ja: '送信' },
  { id: 'chat.translate', en: 'Translate', es: 'Traducir', fr: 'Traduire', de: 'Übersetzen', zh: '翻译', ja: '翻訳' },
  { id: 'chat.translating', en: 'Translating…', es: 'Traduciendo…', fr: 'Traduction…', de: 'Übersetzen…', zh: '翻译中…', ja: '翻訳中…' },
  { id: 'chat.showOriginal', en: 'Show original', es: 'Ver original', fr: "Voir l'original", de: 'Original anzeigen', zh: '显示原文', ja: '原文を表示' },
  { id: 'chat.showTranslation', en: 'Show translation', es: 'Ver traducción', fr: 'Voir la traduction', de: 'Übersetzung anzeigen', zh: '显示译文', ja: '翻訳を表示' },
  { id: 'chat.translateError', en: "Couldn't translate", es: 'No se pudo traducir', fr: 'Traduction impossible', de: 'Übersetzung fehlgeschlagen', zh: '无法翻译', ja: '翻訳できませんでした' },
  { id: 'chat.sameLang', en: 'Already in your language', es: 'Ya está en tu idioma', fr: 'Déjà dans votre langue', de: 'Bereits in deiner Sprache', zh: '已是你的语言', ja: 'すでにあなたの言語です' },
  { id: 'chat.translateUnsupported', en: 'Translation needs Chrome 138+', es: 'La traducción requiere Chrome 138+', fr: 'La traduction nécessite Chrome 138+', de: 'Übersetzung erfordert Chrome 138+', zh: '翻译需要 Chrome 138+', ja: '翻訳には Chrome 138+ が必要です' },

  { id: 'palette.components', en: 'Components', es: 'Componentes', fr: 'Composants', de: 'Komponenten', zh: '组件', ja: 'コンポーネント' },
  { id: 'palette.search', en: 'Search components', es: 'Buscar componentes', fr: 'Rechercher des composants', de: 'Komponenten suchen', zh: '搜索组件', ja: 'コンポーネントを検索' },
  { id: 'palette.noMatch', en: 'No components match', es: 'Ningún componente coincide con', fr: 'Aucun composant ne correspond à', de: 'Keine Komponenten entsprechen', zh: '没有匹配的组件', ja: '一致するコンポーネントがありません' },
  { id: 'palette.hint', en: 'Drag a component to the canvas. Drag from a pin (small circle) to connect. Del removes selection.', es: 'Arrastra un componente al lienzo. Arrastra desde un pin (círculo pequeño) para conectar. Supr elimina la selección.', fr: 'Faites glisser un composant sur le canevas. Faites glisser depuis une broche (petit cercle) pour connecter. Suppr supprime la sélection.', de: 'Ziehe eine Komponente auf die Leinwand. Ziehe von einem Pin (kleiner Kreis), um zu verbinden. Entf entfernt die Auswahl.', zh: '将组件拖到画布上。从引脚（小圆圈）拖动以连接。Del 键删除所选内容。', ja: 'コンポーネントをキャンバスにドラッグします。ピン（小さな円）からドラッグして接続します。Del で選択を削除します。' },

  { id: 'wire.label', en: 'Wire', es: 'Cable', fr: 'Fil', de: 'Leitung', zh: '连线', ja: 'ワイヤー' },
  { id: 'wire.selected', en: 'Selected wire', es: 'Cable seleccionado', fr: 'Fil sélectionné', de: 'Ausgewählte Leitung', zh: '选中的连线', ja: '選択中のワイヤー' },
  { id: 'wire.tipColor', en: 'Wire color', es: 'Color del cable', fr: 'Couleur du fil', de: 'Leitungsfarbe', zh: '连线颜色', ja: 'ワイヤーの色' },
  { id: 'wire.tipStyle', en: 'Wire style, width & routing', es: 'Estilo, grosor y enrutamiento del cable', fr: 'Style, épaisseur et routage du fil', de: 'Leitungsstil, -breite und -führung', zh: '连线样式、宽度和走线', ja: 'ワイヤーのスタイル・太さ・配線' },
  { id: 'wire.popColor', en: 'Color', es: 'Color', fr: 'Couleur', de: 'Farbe', zh: '颜色', ja: '色' },
  { id: 'wire.popStyle', en: 'Style', es: 'Estilo', fr: 'Style', de: 'Stil', zh: '样式', ja: 'スタイル' },
  { id: 'wire.popWidth', en: 'Width', es: 'Grosor', fr: 'Épaisseur', de: 'Breite', zh: '宽度', ja: '太さ' },
  { id: 'wire.popRouting', en: 'Routing', es: 'Enrutamiento', fr: 'Routage', de: 'Leitungsführung', zh: '走线', ja: '配線' },
  { id: 'wire.flow', en: 'Flowing (animated)', es: 'Fluido (animado)', fr: 'Animé (flux)', de: 'Fließend (animiert)', zh: '流动（动画）', ja: 'フロー（アニメーション）' },
  { id: 'wire.dashed', en: 'Dashed', es: 'Discontinuo', fr: 'Pointillé', de: 'Gestrichelt', zh: '虚线', ja: '破線' },
  { id: 'wire.solid', en: 'Solid', es: 'Sólido', fr: 'Continu', de: 'Durchgezogen', zh: '实线', ja: '実線' },
  { id: 'wire.thin', en: 'Thin', es: 'Fino', fr: 'Fin', de: 'Dünn', zh: '细', ja: '細い' },
  { id: 'wire.medium', en: 'Medium', es: 'Medio', fr: 'Moyen', de: 'Mittel', zh: '中', ja: '中' },
  { id: 'wire.thick', en: 'Thick', es: 'Grueso', fr: 'Épais', de: 'Dick', zh: '粗', ja: '太い' },
  { id: 'wire.rightAngle', en: 'Right-angle', es: 'Ángulo recto', fr: 'Angle droit', de: 'Rechtwinklig', zh: '直角', ja: '直角' },
  { id: 'wire.straight', en: 'Straight', es: 'Recto', fr: 'Droit', de: 'Gerade', zh: '直线', ja: '直線' },
  { id: 'wire.curved', en: 'Curved', es: 'Curvo', fr: 'Courbe', de: 'Gebogen', zh: '曲线', ja: '曲線' },
  { id: 'wire.delete', en: 'Delete wire', es: 'Eliminar cable', fr: 'Supprimer le fil', de: 'Leitung löschen', zh: '删除连线', ja: 'ワイヤーを削除' },

  { id: 'zoom.out', en: 'Zoom out (Ctrl -)', es: 'Alejar (Ctrl -)', fr: 'Zoom arrière (Ctrl -)', de: 'Verkleinern (Strg -)', zh: '缩小 (Ctrl -)', ja: '縮小 (Ctrl -)' },
  { id: 'zoom.reset', en: 'Reset to 100%', es: 'Restablecer al 100%', fr: 'Réinitialiser à 100 %', de: 'Auf 100 % zurücksetzen', zh: '重置为 100%', ja: '100% にリセット' },
  { id: 'zoom.in', en: 'Zoom in (Ctrl +)', es: 'Acercar (Ctrl +)', fr: 'Zoom avant (Ctrl +)', de: 'Vergrößern (Strg +)', zh: '放大 (Ctrl +)', ja: '拡大 (Ctrl +)' },
  { id: 'zoom.fit', en: 'Fit diagram to screen', es: 'Ajustar el diagrama a la pantalla', fr: "Ajuster le diagramme à l'écran", de: 'Diagramm an Bildschirm anpassen', zh: '使图表适应屏幕', ja: 'ダイアグラムを画面に合わせる' },

  { id: 'props.title', en: 'Properties', es: 'Propiedades', fr: 'Propriétés', de: 'Eigenschaften', zh: '属性', ja: 'プロパティ' },
  { id: 'props.name', en: 'Name', es: 'Nombre', fr: 'Nom', de: 'Name', zh: '名称', ja: '名前' },
  { id: 'props.partNumber', en: 'Part number', es: 'Número de pieza', fr: 'Référence', de: 'Teilenummer', zh: '零件编号', ja: '部品番号' },
  { id: 'props.partPlaceholder', en: 'e.g. NE555P', es: 'p. ej. NE555P', fr: 'p. ex. NE555P', de: 'z. B. NE555P', zh: '例如 NE555P', ja: '例: NE555P' },
  { id: 'props.category', en: 'Category', es: 'Categoría', fr: 'Catégorie', de: 'Kategorie', zh: '类别', ja: 'カテゴリ' },
  { id: 'props.notes', en: 'Notes', es: 'Notas', fr: 'Notes', de: 'Notizen', zh: '备注', ja: 'メモ' },
  { id: 'props.notesPlaceholder', en: 'Specs, values, reminders…', es: 'Especificaciones, valores, recordatorios…', fr: 'Spécifications, valeurs, rappels…', de: 'Spezifikationen, Werte, Notizen…', zh: '规格、数值、提醒…', ja: '仕様・数値・メモ…' },
  { id: 'props.appearance', en: 'Appearance', es: 'Apariencia', fr: 'Apparence', de: 'Darstellung', zh: '外观', ja: '外観' },
  { id: 'props.fill', en: 'Fill', es: 'Relleno', fr: 'Remplissage', de: 'Füllung', zh: '填充', ja: '塗りつぶし' },
  { id: 'props.border', en: 'Border', es: 'Borde', fr: 'Bordure', de: 'Rahmen', zh: '边框', ja: '枠線' },
  { id: 'props.badgeColor', en: 'Badge color', es: 'Color de la insignia', fr: 'Couleur du badge', de: 'Badge-Farbe', zh: '徽标颜色', ja: 'バッジの色' },
  { id: 'props.symbolColor', en: 'Symbol color', es: 'Color del símbolo', fr: 'Couleur du symbole', de: 'Symbolfarbe', zh: '符号颜色', ja: 'シンボルの色' },
  { id: 'props.delete', en: 'Delete component', es: 'Eliminar componente', fr: 'Supprimer le composant', de: 'Komponente löschen', zh: '删除组件', ja: 'コンポーネントを削除' },

  { id: 'footer.hints', en: 'Right-drag pans · Ctrl + scroll zooms · Del deletes', es: 'Arrastrar con botón derecho desplaza · Ctrl + rueda hace zoom · Supr elimina', fr: 'Clic droit pour déplacer · Ctrl + molette pour zoomer · Suppr pour supprimer', de: 'Rechtsziehen verschiebt · Strg + Scrollen zoomt · Entf löscht', zh: '右键拖动平移 · Ctrl + 滚动缩放 · Del 删除', ja: '右ドラッグで移動 · Ctrl + スクロールでズーム · Del で削除' },
  { id: 'status.ready', en: 'Ready', es: 'Listo', fr: 'Prêt', de: 'Bereit', zh: '就绪', ja: '準備完了' },
  { id: 'lang.tooltip', en: 'Language', es: 'Idioma', fr: 'Langue', de: 'Sprache', zh: '语言', ja: '言語' },
];

// Data-driven palette labels (categories + component names), keyed by the
// English text. Anything not listed (e.g. a user-renamed block) falls back to
// English. Part numbers are kept; only the descriptor is translated.
const DATA = [
  { en: 'Blocks', es: 'Bloques', fr: 'Blocs', de: 'Blöcke', zh: '模块', ja: 'ブロック' },
  { en: 'Electrical', es: 'Eléctrico', fr: 'Électrique', de: 'Elektrisch', zh: '电气', ja: '電気' },
  { en: 'Animated', es: 'Animado', fr: 'Animé', de: 'Animiert', zh: '动画', ja: 'アニメーション' },
  { en: 'Functional block', es: 'Bloque funcional', fr: 'Bloc fonctionnel', de: 'Funktionsblock', zh: '功能模块', ja: '機能ブロック' },
  { en: 'Image', es: 'Imagen', fr: 'Image', de: 'Bild', zh: '图片', ja: '画像' },
  { en: 'Component', es: 'Componente', fr: 'Composant', de: 'Komponente', zh: '组件', ja: 'コンポーネント' },
  { en: 'Main Processor', es: 'Procesador principal', fr: 'Processeur principal', de: 'Hauptprozessor', zh: '主处理器', ja: 'メインプロセッサ' },
  { en: 'AI Models', es: 'Modelos de IA', fr: "Modèles d'IA", de: 'KI-Modelle', zh: 'AI 模型', ja: 'AI モデル' },
  { en: 'Memory', es: 'Memoria', fr: 'Mémoire', de: 'Speicher', zh: '内存', ja: 'メモリ' },
  { en: 'Sensor', es: 'Sensor', fr: 'Capteur', de: 'Sensor', zh: '传感器', ja: 'センサー' },
  { en: 'Camera', es: 'Cámara', fr: 'Caméra', de: 'Kamera', zh: '摄像头', ja: 'カメラ' },
  { en: 'BLDC Motor Ctrl', es: 'Ctrl. motor BLDC', fr: 'Ctrl moteur BLDC', de: 'BLDC-Motorsteuerung', zh: 'BLDC 电机控制', ja: 'BLDC モーター制御' },
  { en: 'Battery / BMS', es: 'Batería / BMS', fr: 'Batterie / BMS', de: 'Batterie / BMS', zh: '电池 / BMS', ja: 'バッテリー / BMS' },
  { en: 'DC/DC Converter', es: 'Convertidor CC/CC', fr: 'Convertisseur CC/CC', de: 'DC/DC-Wandler', zh: 'DC/DC 转换器', ja: 'DC/DC コンバータ' },
  { en: 'Comm Module', es: 'Módulo de comunicación', fr: 'Module de communication', de: 'Kommunikationsmodul', zh: '通信模块', ja: '通信モジュール' },
  { en: 'Antenna', es: 'Antena', fr: 'Antenne', de: 'Antenne', zh: '天线', ja: 'アンテナ' },
  { en: 'Motor Control', es: 'Control de motor', fr: 'Commande moteur', de: 'Motorsteuerung', zh: '电机控制', ja: 'モーター制御' },
  { en: 'Resistor', es: 'Resistencia', fr: 'Résistance', de: 'Widerstand', zh: '电阻', ja: '抵抗器' },
  { en: 'Capacitor', es: 'Condensador', fr: 'Condensateur', de: 'Kondensator', zh: '电容', ja: 'コンデンサ' },
  { en: 'Inductor', es: 'Inductor', fr: 'Inductance', de: 'Spule', zh: '电感', ja: 'インダクタ' },
  { en: 'Diode', es: 'Diodo', fr: 'Diode', de: 'Diode', zh: '二极管', ja: 'ダイオード' },
  { en: 'LED', es: 'LED', fr: 'LED', de: 'LED', zh: 'LED', ja: 'LED' },
  { en: 'NPN Transistor', es: 'Transistor NPN', fr: 'Transistor NPN', de: 'NPN-Transistor', zh: 'NPN 晶体管', ja: 'NPN トランジスタ' },
  { en: 'Ground', es: 'Tierra', fr: 'Masse', de: 'Masse', zh: '接地', ja: '接地' },
  { en: 'DC Source', es: 'Fuente CC', fr: 'Source CC', de: 'Gleichspannungsquelle', zh: '直流电源', ja: '直流電源' },
  { en: 'AC Source', es: 'Fuente CA', fr: 'Source CA', de: 'Wechselspannungsquelle', zh: '交流电源', ja: '交流電源' },
  { en: 'Switch', es: 'Interruptor', fr: 'Interrupteur', de: 'Schalter', zh: '开关', ja: 'スイッチ' },
  { en: 'Fuse', es: 'Fusible', fr: 'Fusible', de: 'Sicherung', zh: '保险丝', ja: 'ヒューズ' },
  { en: 'PNP Transistor', es: 'Transistor PNP', fr: 'Transistor PNP', de: 'PNP-Transistor', zh: 'PNP 晶体管', ja: 'PNP トランジスタ' },
  { en: 'N-MOSFET', es: 'N-MOSFET', fr: 'N-MOSFET', de: 'N-MOSFET', zh: 'N 沟道 MOSFET', ja: 'N チャネル MOSFET' },
  { en: 'Zener Diode', es: 'Diodo Zener', fr: 'Diode Zener', de: 'Zener-Diode', zh: '齐纳二极管', ja: 'ツェナーダイオード' },
  { en: 'Potentiometer', es: 'Potenciómetro', fr: 'Potentiomètre', de: 'Potentiometer', zh: '电位器', ja: 'ポテンショメータ' },
  { en: 'Polarized Cap', es: 'Cond. polarizado', fr: 'Cond. polarisé', de: 'Gepolter Kondensator', zh: '极性电容', ja: '有極性コンデンサ' },
  { en: 'Battery Cell', es: 'Celda de batería', fr: 'Cellule de batterie', de: 'Batteriezelle', zh: '电池单元', ja: '電池セル' },
  { en: 'Op-Amp', es: 'Amp. operacional', fr: 'Ampli-op', de: 'Operationsverstärker', zh: '运算放大器', ja: 'オペアンプ' },
  { en: 'Crystal', es: 'Cristal', fr: 'Quartz', de: 'Quarz', zh: '晶振', ja: '水晶振動子' },
  { en: 'Push Button', es: 'Pulsador', fr: 'Bouton-poussoir', de: 'Taster', zh: '按钮', ja: 'プッシュボタン' },
  { en: 'Lamp', es: 'Lámpara', fr: 'Lampe', de: 'Lampe', zh: '灯', ja: 'ランプ' },
  { en: 'Ammeter', es: 'Amperímetro', fr: 'Ampèremètre', de: 'Amperemeter', zh: '电流表', ja: '電流計' },
  { en: 'Voltmeter', es: 'Voltímetro', fr: 'Voltmètre', de: 'Voltmeter', zh: '电压表', ja: '電圧計' },
  { en: 'DC Motor', es: 'Motor CC', fr: 'Moteur CC', de: 'Gleichstrommotor', zh: '直流电机', ja: '直流モーター' },
  { en: '555 Timer IC', es: 'CI temporizador 555', fr: 'CI minuterie 555', de: '555 Timer-IC', zh: '555 定时器 IC', ja: '555 タイマー IC' },
  { en: 'LM741 Op-Amp', es: 'LM741 amp. op.', fr: 'LM741 ampli-op', de: 'LM741 Op-Amp', zh: 'LM741 运放', ja: 'LM741 オペアンプ' },
  { en: '7805 Regulator', es: 'Regulador 7805', fr: 'Régulateur 7805', de: '7805 Regler', zh: '7805 稳压器', ja: '7805 レギュレータ' },
  { en: 'LM317 Regulator', es: 'Regulador LM317', fr: 'Régulateur LM317', de: 'LM317 Regler', zh: 'LM317 稳压器', ja: 'LM317 レギュレータ' },
  { en: '7400 NAND', es: '7400 NAND', fr: '7400 NON-ET', de: '7400 NAND', zh: '7400 与非门', ja: '7400 NAND' },
  { en: '7404 Inverter', es: '7404 inversor', fr: '7404 inverseur', de: '7404 Inverter', zh: '7404 反相器', ja: '7404 インバータ' },
  { en: '74HC595 Shift Reg', es: '74HC595 reg. despl.', fr: '74HC595 reg. décal.', de: '74HC595 Schieberegister', zh: '74HC595 移位寄存器', ja: '74HC595 シフトレジスタ' },
  { en: 'L293D Motor Drv', es: 'L293D ctrl. motor', fr: 'L293D pilote moteur', de: 'L293D Motortreiber', zh: 'L293D 电机驱动', ja: 'L293D モータードライバ' },
  { en: 'PC817 Optocoupler', es: 'PC817 optoacoplador', fr: 'PC817 optocoupleur', de: 'PC817 Optokoppler', zh: 'PC817 光耦', ja: 'PC817 フォトカプラ' },
  { en: 'ATmega328 MCU', es: 'ATmega328 MCU', fr: 'ATmega328 MCU', de: 'ATmega328 MCU', zh: 'ATmega328 单片机', ja: 'ATmega328 マイコン' },
  { en: 'ESP32 Module', es: 'Módulo ESP32', fr: 'Module ESP32', de: 'ESP32-Modul', zh: 'ESP32 模块', ja: 'ESP32 モジュール' },
  { en: 'Robotic Arm', es: 'Brazo robótico', fr: 'Bras robotisé', de: 'Roboterarm', zh: '机械臂', ja: 'ロボットアーム' },
  { en: 'Siren Light', es: 'Luz de sirena', fr: 'Gyrophare', de: 'Signalleuchte', zh: '警报灯', ja: '回転灯' },
  { en: 'Fan', es: 'Ventilador', fr: 'Ventilateur', de: 'Lüfter', zh: '风扇', ja: 'ファン' },
  { en: 'Conveyor', es: 'Cinta transportadora', fr: 'Convoyeur', de: 'Förderband', zh: '传送带', ja: 'コンベア' },
  { en: 'Gear Motor', es: 'Motorreductor', fr: 'Motoréducteur', de: 'Getriebemotor', zh: '齿轮电机', ja: 'ギヤードモーター' },
  { en: 'Antenna Tower', es: 'Torre de antena', fr: "Tour d'antenne", de: 'Antennenturm', zh: '天线塔', ja: 'アンテナ塔' },
  { en: 'Pump', es: 'Bomba', fr: 'Pompe', de: 'Pumpe', zh: '泵', ja: 'ポンプ' },
  { en: 'Stack Light', es: 'Torre de señales', fr: 'Colonne lumineuse', de: 'Signalsäule', zh: '信号灯塔', ja: '積層信号灯' },
  { en: 'Piston', es: 'Pistón', fr: 'Piston', de: 'Kolben', zh: '活塞', ja: 'ピストン' },
  { en: 'Liquid Tank', es: 'Tanque de líquido', fr: 'Réservoir de liquide', de: 'Flüssigkeitstank', zh: '液罐', ja: '液体タンク' },
  { en: 'Drone', es: 'Dron', fr: 'Drone', de: 'Drohne', zh: '无人机', ja: 'ドローン' },
  { en: 'Battery (Charging)', es: 'Batería (cargando)', fr: 'Batterie (en charge)', de: 'Batterie (lädt)', zh: '电池（充电中）', ja: 'バッテリー（充電中）' },
  { en: 'Inverter', es: 'Inversor', fr: 'Onduleur', de: 'Wechselrichter', zh: '逆变器', ja: 'インバータ' },
  { en: 'Transformer', es: 'Transformador', fr: 'Transformateur', de: 'Transformator', zh: '变压器', ja: '変圧器' },
  { en: 'Solar Panel', es: 'Panel solar', fr: 'Panneau solaire', de: 'Solarmodul', zh: '太阳能板', ja: 'ソーラーパネル' },
  { en: 'Wind Turbine', es: 'Aerogenerador', fr: 'Éolienne', de: 'Windturbine', zh: '风力涡轮机', ja: '風力タービン' },
  { en: 'Generator', es: 'Generador', fr: 'Générateur', de: 'Generator', zh: '发电机', ja: '発電機' },
  { en: 'EV Charger', es: 'Cargador de VE', fr: 'Borne de recharge', de: 'EV-Ladegerät', zh: '电动车充电器', ja: 'EV 充電器' },
  { en: 'Power Pylon', es: 'Torre eléctrica', fr: 'Pylône électrique', de: 'Strommast', zh: '电力铁塔', ja: '送電鉄塔' },
  { en: 'Relay', es: 'Relé', fr: 'Relais', de: 'Relais', zh: '继电器', ja: 'リレー' },
  { en: 'Heater', es: 'Calentador', fr: 'Chauffage', de: 'Heizung', zh: '加热器', ja: 'ヒーター' },
  { en: 'Bulb', es: 'Bombilla', fr: 'Ampoule', de: 'Glühbirne', zh: '灯泡', ja: '電球' },
];

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
];
const ALL = ['en', ...LOCALES];
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

let out = '// AUTO-GENERATED by i18n/generate-i18n.mjs — do not edit by hand.\n';
out += '// Add or change strings there, then re-run: node i18n/generate-i18n.mjs\n\n';
out += 'export interface Language { code: string; label: string; }\n\n';
out += 'export const LANGUAGES: Language[] = [\n';
for (const l of LANGS) out += `  { code: ${q(l.code)}, label: ${q(l.label)} },\n`;
out += '];\n\n';
out += 'export const TRANSLATIONS: Record<string, Record<string, string>> = {\n';
for (const loc of ALL) {
  out += `  ${loc}: {\n`;
  for (const m of M) out += `    ${q(m.id)}: ${q(m[loc] ?? m.en)},\n`;
  out += '  },\n';
}
out += '};\n\n';

out += '// Palette data labels (categories + component names), keyed by English text.\n';
out += 'export const DATA_TRANSLATIONS: Record<string, Record<string, string>> = {\n';
for (const loc of ALL) {
  out += `  ${loc}: {\n`;
  for (const d of DATA) out += `    ${q(d.en)}: ${q(d[loc] ?? d.en)},\n`;
  out += '  },\n';
}
out += '};\n';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'i18n');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'translations.ts'), out, 'utf8');

console.log(`Wrote ${M.length} UI keys + ${DATA.length} data labels × ${ALL.length} locales to src/app/i18n/translations.ts`);
