import { ProjectProvider } from "./state/ProjectProvider";
import { EditorUiProvider } from "./state/EditorUiContext";
import { ToastProvider } from "./components/common/ToastProvider";
import { ModalRegistryProvider } from "./components/modals/ModalRegistry";
import { EditorScreen } from "./components/layout/EditorScreen";

export default function App() {
  return (
    <ToastProvider>
      <ProjectProvider>
        <EditorUiProvider>
          <ModalRegistryProvider>
            <EditorScreen />
          </ModalRegistryProvider>
        </EditorUiProvider>
      </ProjectProvider>
    </ToastProvider>
  );
}
