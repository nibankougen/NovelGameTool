export type TrMap = Record<string, string>;

export type EventKeyValueType = "none" | "number" | "string";

export interface EventKeyDef {
  id: string;
  name: string;
  valueType: EventKeyValueType;
}

export interface SerifEventTag {
  keyId: string;
  /** valueType が "none" のキーには持たせない */
  value?: number | string;
}

export interface SerifCommand {
  type: "serif";
  chara: string | null;
  face: string | null;
  text: string;
  tr?: TrMap;
  /** 人称チェックのバッジを既読にした時点のテキストのスナップショット。
   * text と一致する間だけ既読扱いになる（編集すると自動的に未読へ戻る）。undo対象外。 */
  honorAckText?: string;
  /** このセリフに付与されたイベントキー。プロジェクト共通の project.eventKeys を参照する */
  events?: SerifEventTag[];
}
export interface BgCommand {
  type: "bg";
  value: string;
}
export interface BgmCommand {
  type: "bgm";
  value: string;
}
export interface SeCommand {
  type: "se";
  value: string;
}
export interface WaitCommand {
  type: "wait";
  value: number;
}
export interface JumpCommand {
  type: "jump";
  target: string;
}
export interface ChoiceOption {
  text: string;
  target: string | null;
  tr?: TrMap;
}
export interface ChoiceCommand {
  type: "choice";
  options: ChoiceOption[];
}
export interface CommentCommand {
  type: "comment";
  text: string;
}

export type Command =
  | SerifCommand
  | BgCommand
  | BgmCommand
  | SeCommand
  | WaitCommand
  | JumpCommand
  | ChoiceCommand
  | CommentCommand;

export interface Character {
  id: string;
  name: string;
  color: string;
  memo: string;
  thumb: string | null;
  expressions: string[];
  exprImages: Record<string, string>;
  tr?: TrMap;
}

export interface SceneGroup {
  id: string;
  name: string;
}

export interface Scene {
  id: string;
  name: string;
  commands: Command[];
  groupId: string | null;
  synopsis: string;
}

export interface ExportSettings {
  face: boolean;
  sceneName: boolean;
  color: boolean;
  comment: boolean;
  pretty: boolean;
}

/** 人称チェックの「相手（二人称、名前を伴わない）」を表す targetId の特別値 */
export const HONOR_SECOND = "__second__";

export interface HonorificRule {
  id: string;
  speakerId: string;
  /** null=一人称, HONOR_SECOND=二人称, それ以外=対象キャラid */
  targetId: string | null;
  pattern: string;
  allowBare: boolean;
}

export interface HonorificVocab {
  self: string[];
  second: string[];
  suffix: string[];
}

export interface ProjectAssets {
  bg: Record<string, string>;
  bgm: Record<string, string>;
  se: Record<string, string>;
}

export interface Project {
  title: string;
  titleTr?: TrMap;
  characters: Character[];
  scenes: Scene[];
  sceneGroups: SceneGroup[];
  exportSettings: ExportSettings;
  exprTemplate: string[];
  languages: string[];
  overview: string;
  honorificRules: HonorificRule[];
  honorificVocab: HonorificVocab;
  assets: ProjectAssets;
  eventKeys: EventKeyDef[];
}

export const PALETTE = [
  "#ff7a7a",
  "#ffb35c",
  "#ffe066",
  "#8ce99a",
  "#66d9e8",
  "#74a8ff",
  "#b197fc",
  "#faa2c1",
  "#c0a98a",
  "#9aa5b1",
];

export const EXPORT_DEFAULTS: ExportSettings = {
  face: true,
  sceneName: true,
  color: true,
  comment: false,
  pretty: true,
};

export const HONOR_VOCAB_DEFAULTS: HonorificVocab = {
  self: ["私", "わたし", "わたくし", "僕", "ぼく", "ボク", "俺", "おれ", "オレ", "自分", "うち", "あたし", "あたい"],
  second: ["キミ", "君", "あなた", "あんた", "お前", "おまえ", "貴様", "きさま", "てめえ", "そなた"],
  suffix: ["さん", "くん", "君", "ちゃん", "様", "殿", "氏", "先輩", "先生"],
};
