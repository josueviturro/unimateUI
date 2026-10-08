import { useRef, useState, type DragEvent } from "react";
import { ActionButton } from "../../components/common/ActionButton";
import styles from "./UploadDropzone.module.css";

const ACCEPTED_EXTENSIONS = [".glb", ".gltf", ".fbx"];

interface UploadDropzoneProps {
  isUploading: boolean;
  onUpload: (modelFile: File, displayName: string) => void;
}

/** True when the file name ends with a supported 3D format. */
function hasAcceptedExtension(fileName: string): boolean {
  return ACCEPTED_EXTENSIONS.some((acceptedExtension) => fileName.toLowerCase().endsWith(acceptedExtension));
}

/** Drag-and-drop (or click) area to pick a rigged GLB/FBX, name it and upload it. */
export function UploadDropzone({ isUploading, onUpload }: UploadDropzoneProps) {
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Accept a file if its format is supported and prefill the name from it. */
  const acceptFile = (candidateFile: File | undefined) => {
    if (!candidateFile) return;
    if (!hasAcceptedExtension(candidateFile.name)) {
      setValidationMessage("Formato no soportado: usá .glb, .gltf o .fbx");
      return;
    }
    setValidationMessage(null);
    setPickedFile(candidateFile);
    setDisplayName(candidateFile.name.replace(/\.[^.]+$/, ""));
  };

  /** Handle a file dropped on the area. */
  const handleDrop = (dropEvent: DragEvent<HTMLDivElement>) => {
    dropEvent.preventDefault();
    setIsDraggingOver(false);
    acceptFile(dropEvent.dataTransfer.files[0]);
  };

  /** Send the picked file to the backend and reset the form. */
  const handleUploadClick = () => {
    if (!pickedFile) return;
    onUpload(pickedFile, displayName.trim());
    setPickedFile(null);
    setDisplayName("");
  };

  return (
    <div
      className={`${styles.container_upload_dropzone} ${isDraggingOver ? styles.container_dropzone_active : ""}`}
      onDragOver={(dragEvent) => { dragEvent.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      <div className={styles.icon_upload_cloud} aria-hidden="true">⇪</div>
      {!pickedFile ? (
        <>
          <p className={styles.text_dropzone_title}>Arrastrá tu modelo riggeado acá o hacé clic para explorar</p>
          <p className={styles.text_dropzone_subtitle}>
            Formatos: .GLB y .FBX. Exportá solo los huesos deformantes (máximo 70).
          </p>
          <ActionButton variant="primary" iconSymbol="＋" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            Subir personaje (.glb / .fbx)
          </ActionButton>
        </>
      ) : (
        <div className={styles.container_picked_file}>
          <p className={styles.text_dropzone_title}>{pickedFile.name}</p>
          <label className={styles.label_display_name}>
            Nombre del personaje
            <input
              className={styles.input_display_name}
              value={displayName}
              maxLength={64}
              onChange={(changeEvent) => setDisplayName(changeEvent.target.value)}
            />
          </label>
          <div className={styles.row_picked_file_actions}>
            <ActionButton variant="ghost" onClick={() => setPickedFile(null)}>Cambiar archivo</ActionButton>
            <ActionButton variant="primary" iconSymbol="▶" onClick={handleUploadClick} disabled={isUploading}>
              Subir y etiquetar huesos
            </ActionButton>
          </div>
        </div>
      )}
      {validationMessage && <p className={styles.text_dropzone_error}>{validationMessage}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className={styles.input_hidden_file}
        onChange={(changeEvent) => { acceptFile(changeEvent.target.files?.[0]); changeEvent.target.value = ""; }}
      />
    </div>
  );
}
