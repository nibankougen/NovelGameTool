import { ProjectProvider, useProjectStore } from "./state/ProjectProvider";
import { EditorUiProvider } from "./state/EditorUiContext";
import { SerifColumnsProvider } from "./state/SerifColumnsContext";
import { ToastProvider } from "./components/common/ToastProvider";
import { ModalRegistryProvider } from "./components/modals/ModalRegistry";
import { EditorScreen } from "./components/layout/EditorScreen";
import { ProjectLauncher } from "./components/layout/ProjectLauncher";

function AppInner() {
  const { dirHandle } = useProjectStore();
  if (!dirHandle) return <ProjectLauncher />;
  return (
    <EditorUiProvider>
      <SerifColumnsProvider>
        <ModalRegistryProvider>
          <EditorScreen />
        </ModalRegistryProvider>
      </SerifColumnsProvider>
    </EditorUiProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ProjectProvider>
        <AppInner />
      </ProjectProvider>
    </ToastProvider>
  );
}
