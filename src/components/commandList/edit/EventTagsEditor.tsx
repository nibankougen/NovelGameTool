import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../common/Icon";
import { useClickOutside } from "../../../hooks/useClickOutside";
import type { EventKeyDef, SerifEventTag } from "../../../types/project";

interface Props {
  events: SerifEventTag[];
  setEvents: (updater: (prev: SerifEventTag[]) => SerifEventTag[]) => void;
  eventKeys: EventKeyDef[];
}

/** セリフ編集行の下に置く、イベントキー付与チップ＋追加メニュー */
export function EventTagsEditor({ events, setEvents, eventKeys }: Props) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useClickOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false), btnRef);

  if (!events.length && !eventKeys.length) return null;

  const toggleKey = (key: EventKeyDef) => {
    setEvents((prev) => {
      if (prev.some((e) => e.keyId === key.id)) return prev.filter((e) => e.keyId !== key.id);
      const value = key.valueType === "number" ? 0 : key.valueType === "string" ? "" : undefined;
      return [...prev, { keyId: key.id, value }];
    });
  };

  const setValue = (keyId: string, value: number | string) => {
    setEvents((prev) => prev.map((e) => (e.keyId === keyId ? { ...e, value } : e)));
  };

  const removeKey = (keyId: string) => setEvents((prev) => prev.filter((e) => e.keyId !== keyId));

  return (
    <div className="event-tags-row flex flex-wrap items-center gap-1.5 mt-1.5">
      {eventKeys.map((key) => {
        const tag = events.find((e) => e.keyId === key.id);
        if (!tag) return null;
        return (
          <span key={key.id} className="event-tag inline-flex items-center gap-1 bg-bg-3 border border-border rounded px-1.5 py-0.5 text-xs">
            <Icon name="tag" />
            {key.name}
            {key.valueType !== "none" && (
              <input
                type={key.valueType === "number" ? "number" : "text"}
                value={tag.value ?? ""}
                className="w-14 text-xs px-1 py-0 min-h-0"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setValue(key.id, key.valueType === "number" ? Number(e.target.value) : e.target.value)}
              />
            )}
            <button
              type="button"
              className="border-none bg-transparent p-0 min-h-0 text-text-dim"
              onClick={(e) => {
                e.stopPropagation();
                removeKey(key.id);
              }}
            >
              <Icon name="x" />
            </button>
          </span>
        );
      })}
      {eventKeys.length > 0 && (
        <div className="relative">
          <button
            ref={btnRef}
            type="button"
            className="text-xs px-1.5 py-0.5 min-h-0"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <Icon name="plus" />
            {t("eventKeys.event")}
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              className="edit-menu absolute z-60 top-full left-0 mt-1 bg-bg-3 border border-border rounded-lg shadow-2xl min-w-[150px] max-h-[250px] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {eventKeys.map((key) => (
                <label key={key.id} className="em-item px-3.5 py-1.5 text-sm whitespace-nowrap cursor-pointer hover:bg-accent-dim flex items-center gap-1.5">
                  <input type="checkbox" checked={events.some((e) => e.keyId === key.id)} onChange={() => toggleKey(key)} />
                  {key.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
