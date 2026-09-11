import type { Command, Scene } from "../../../types/project";
import { PlainEditRow } from "./PlainEditRow";
import { SerifEditRow } from "./SerifEditRow";

export function InlineEditRow({ index, cmd, scene }: { index: number; cmd: Command; scene: Scene }) {
  if (cmd.type === "serif") return <SerifEditRow index={index} cmd={cmd} scene={scene} />;
  return <PlainEditRow index={index} cmd={cmd} scene={scene} />;
}
