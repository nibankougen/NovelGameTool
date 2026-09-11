import { ProjectProvider } from "./state/ProjectProvider";
import { EditorUiProvider } from "./state/EditorUiContext";
import { SerifColumnsProvider } from "./state/SerifColumnsContext";
import { ToastProvider } from "./components/common/ToastProvider";
import { ModalRegistryProvider } from "./components/modals/ModalRegistry";
import { EditorScreen } from "./components/layout/EditorScreen";

export default function App() {
  return (
    <ToastProvider>
      <ProjectProvider>
        <EditorUiProvider>
          <SerifColumnsProvider>
            <ModalRegistryProvider>
              <EditorScreen />
            </ModalRegistryProvider>
          </SerifColumnsProvider>
        </EditorUiProvider>
      </ProjectProvider>
    </ToastProvider>
  );
}
