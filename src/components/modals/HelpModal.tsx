import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <tr>
      <td className="px-2.5 py-1 border-b border-border align-top whitespace-nowrap w-[220px]">{k}</td>
      <td className="px-2.5 py-1 border-b border-border align-top">{v}</td>
    </tr>
  );
}
function Code({ children }: { children?: ReactNode }) {
  return <code className="bg-bg-3 border border-border rounded px-1.5 font-mono text-xs">{children}</code>;
}
function Kbd({ children }: { children?: ReactNode }) {
  return <kbd className="bg-bg-3 border border-border rounded px-1.5 font-mono text-xs">{children}</kbd>;
}

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onRequestClose={onClose} className="min-w-[560px]">
      <ModalHeader onClose={onClose}>{t("help.title")}</ModalHeader>
      <h4 className="mt-3.5 mb-1 text-accent font-semibold">{t("help.serifHeading")}</h4>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <Row k={<Code>{t("help.ex1Code")}</Code>} v={t("help.ex1Desc")} />
          <Row k={<Code>{t("help.ex2Code")}</Code>} v={t("help.ex2Desc")} />
          <Row k={<Code>{t("help.ex3Code")}</Code>} v={t("help.ex3Desc")} />
          <Row
            k={<Code>{t("help.ex4Code")}</Code>}
            v={<Trans i18nKey="help.ex4Desc" components={[<Code key="0" />]} />}
          />
          <Row k={<Code>{t("help.ex5Code")}</Code>} v={t("help.ex5Desc")} />
          <Row k={<Code>{t("help.ex6Code")}</Code>} v={t("help.ex6Desc")} />
        </tbody>
      </table>

      <h4 className="mt-3.5 mb-1 text-accent font-semibold">
        <Trans i18nKey="help.slashHeading" components={[<Code key="0" />]} />
      </h4>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <Row k={<Code>{t("help.bgCode")}</Code>} v={t("help.bgDesc")} />
          <Row k={<Code>{t("help.bgmCode")}</Code>} v={<Trans i18nKey="help.bgmDesc" components={[<Code key="0" />]} />} />
          <Row k={<Code>{t("help.seCode")}</Code>} v={t("help.seDesc")} />
          <Row k={<Code>{t("help.waitCode")}</Code>} v={t("help.waitDesc")} />
          <Row k={<Code>{t("help.jumpCode")}</Code>} v={t("help.jumpDesc")} />
          <Row
            k={<Code>{t("help.choiceCode")}</Code>}
            v={<Trans i18nKey="help.choiceDesc" components={[<Code key="0" />, <Code key="1" />, <Code key="2" />]} />}
          />
        </tbody>
      </table>

      <h4 className="mt-3.5 mb-1 text-accent font-semibold">{t("help.shortcutsHeading")}</h4>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <Row k={<Kbd>{t("help.enterKey")}</Kbd>} v={t("help.enterDesc")} />
          <Row k={<>{t("help.arrowKeys")}{t("help.arrowKeysNote")}</>} v={t("help.arrowKeysDesc")} />
          <Row k={<Kbd>{t("help.escKey")}</Kbd>} v={t("help.escDesc")} />
          <Row k={t("help.ctrlArrowKey")} v={t("help.ctrlArrowDesc")} />
          <Row k={t("help.ctrlDKey")} v={t("help.ctrlDDesc")} />
          <Row k={<Kbd>{t("help.deleteKey")}</Kbd>} v={t("help.deleteDesc")} />
          <Row k={t("help.ctrl1to9Key")} v={t("help.ctrl1to9Desc")} />
          <Row k={t("help.ctrl0Key")} v={t("help.ctrl0Desc")} />
          <Row k={t("help.alt1to9Key")} v={t("help.alt1to9Desc")} />
          <Row k={t("help.undoRedoKey")} v={t("help.undoRedoDesc")} />
          <Row k={t("help.saveKey")} v={t("help.saveDesc")} />
          <Row k={t("help.playKey")} v={t("help.playDesc")} />
          <Row k={t("help.sidebarKey")} v={t("help.sidebarDesc")} />
          <Row k={t("help.searchKey")} v={t("help.searchDesc")} />
        </tbody>
      </table>

      <h4 className="mt-3.5 mb-1 text-accent font-semibold">{t("help.otherHeading")}</h4>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <Row k={t("help.pasteKey")} v={t("help.pasteDesc")} />
          <Row k={t("help.newOpenKey")} v={t("help.newOpenDesc")} />
          <Row k={t("help.autosaveKey")} v={t("help.autosaveDesc")} />
          <Row k={t("help.editRowKey")} v={t("help.editRowDesc")} />
          <Row k={t("help.reorderKey")} v={t("help.reorderDesc")} />
          <Row k={t("help.groupingKey")} v={t("help.groupingDesc")} />
          <Row k={t("help.charSettingsKey")} v={t("help.charSettingsDesc")} />
          <Row k={t("help.translationKey")} v={<Trans i18nKey="help.translationDesc" components={[<Icon key="0" name="languages" className="inline" />]} />} />
          <Row k={t("help.honorificKey")} v={<Trans i18nKey="help.honorificDesc" components={[<Icon key="0" name="users" className="inline" />]} />} />
          <Row k={t("help.eventKeyKey")} v={<Trans i18nKey="help.eventKeyDesc" components={[<Icon key="0" name="tag" className="inline" />]} />} />
          <Row k={t("help.testPlayKey")} v={t("help.testPlayDesc")} />
          <Row k={t("help.exportGameKey")} v={t("help.exportGameDesc")} />
        </tbody>
      </table>
    </Modal>
  );
}
