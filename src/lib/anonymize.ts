import { ANONYMOUS_LABEL_DEFAULT, type Project } from "../types/project";

/** 指定言語での匿名化表示名を返す（未設定ならデフォルトの「???」） */
export function anonymousLabelFor(project: Project, lang: string): string {
  return project.anonymousLabel[lang] || ANONYMOUS_LABEL_DEFAULT;
}
