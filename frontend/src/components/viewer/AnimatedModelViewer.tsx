import { Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { AnimationMixer, Box3, PerspectiveCamera, Vector3, type Object3D } from "three";
import type { OrbitControls as OrbitControlsImplementation } from "three-stdlib";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PlaybackClock } from "./playback_clock";
import styles from "./AnimatedModelViewer.module.css";

const CAMERA_VIEW_DIRECTION = new Vector3(0.55, 0.35, 1).normalize();
const FRAMING_MARGIN = 1.15;

interface AnimatedModelViewerProps {
  glbUrl: string;
  playbackClockRef?: RefObject<PlaybackClock>;
  onDurationKnown?: (durationSeconds: number) => void;
  overlayLabel?: string;
}

/** Orbitable 3D view of a GLB; its first animation follows the shared playback clock. */
export function AnimatedModelViewer({ glbUrl, playbackClockRef, onDurationKnown, overlayLabel }: AnimatedModelViewerProps) {
  const [framingRequest, setFramingRequest] = useState(0);
  return (
    <div className={styles.container_model_viewer}>
      <ViewerErrorBoundary resetKey={glbUrl}>
        <Canvas camera={{ position: [2.5, 1.8, 3.5], fov: 40 }} dpr={[1, 2]}>
          <color attach="background" args={["#0d1117"]} />
          <hemisphereLight args={["#dfe2eb", "#10141a", 1.2]} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} />
          <Suspense fallback={null}>
            <AnimatedModel glbUrl={glbUrl} playbackClockRef={playbackClockRef} onDurationKnown={onDurationKnown}
              framingRequest={framingRequest} />
          </Suspense>
          <OrbitControls makeDefault enableDamping />
        </Canvas>
      </ViewerErrorBoundary>
      {overlayLabel && <span className={styles.label_viewer_overlay}>{overlayLabel}</span>}
      <span className={styles.label_viewer_hint}>Arrastrá para orbitar · rueda para zoom</span>
      <button type="button" className={styles.button_reframe_view} onClick={() => setFramingRequest(framingRequest + 1)}
        title="Volver a encuadrar el modelo">
        ⌖
      </button>
    </div>
  );
}

interface AnimatedModelProps {
  glbUrl: string;
  playbackClockRef?: RefObject<PlaybackClock>;
  onDurationKnown?: (durationSeconds: number) => void;
  framingRequest: number;
}

/** Loads the GLB, clones it (so several viewers can show the same file), frames it and poses it every frame. */
function AnimatedModel({ glbUrl, playbackClockRef, onDurationKnown, framingRequest }: AnimatedModelProps) {
  const loadedGltf = useGLTF(glbUrl);
  const clonedScene = useMemo(() => cloneSkinnedScene(loadedGltf.scene), [loadedGltf.scene]);
  const animationMixer = useMemo(() => new AnimationMixer(clonedScene), [clonedScene]);
  const firstClip = loadedGltf.animations[0] ?? null;
  const [groundHeight, setGroundHeight] = useState(0);
  const { camera, controls, size } = useThree();

  useEffect(() => {
    if (!firstClip) return undefined;
    const clipAction = animationMixer.clipAction(firstClip);
    clipAction.play();
    onDurationKnown?.(firstClip.duration);
    return () => {
      clipAction.stop();
      animationMixer.uncacheRoot(clonedScene);
    };
  }, [animationMixer, clonedScene, firstClip, onDurationKnown]);

  useEffect(() => {
    // frame the posed model (first frame) whenever it loads, the viewer resizes or the user asks
    if (firstClip) animationMixer.setTime(0);
    const groundLevel = frameObject(clonedScene, camera as PerspectiveCamera, controls as OrbitControlsImplementation | null);
    setGroundHeight(groundLevel);
  }, [clonedScene, animationMixer, firstClip, camera, controls, size.width, size.height, framingRequest]);

  useFrame(() => {
    if (firstClip && playbackClockRef?.current) {
      animationMixer.setTime(playbackClockRef.current.currentTime);
    }
  });

  return (
    <>
      <primitive object={clonedScene} />
      <Grid infiniteGrid cellColor="#21262d" sectionColor="#30363d" fadeDistance={30} position={[0, groundHeight, 0]} />
    </>
  );
}

/**
 * Point the camera at an object's posed bounding box (skinned meshes measured precisely)
 * and return the lowest point, used as ground level.
 */
function frameObject(targetObject: Object3D, perspectiveCamera: PerspectiveCamera,
  orbitControls: OrbitControlsImplementation | null): number {
  targetObject.updateMatrixWorld(true);
  const boundingBox = new Box3().setFromObject(targetObject, true);
  if (boundingBox.isEmpty()) return 0;
  const boxCenter = boundingBox.getCenter(new Vector3());
  const boundingRadius = Math.max(boundingBox.getSize(new Vector3()).length() / 2, 0.01);
  const verticalHalfFov = (perspectiveCamera.fov * Math.PI) / 360;
  const limitingHalfFov = perspectiveCamera.aspect < 1
    ? Math.atan(Math.tan(verticalHalfFov) * perspectiveCamera.aspect) : verticalHalfFov;
  const cameraDistance = (boundingRadius / Math.sin(limitingHalfFov)) * FRAMING_MARGIN;

  perspectiveCamera.position.copy(boxCenter).addScaledVector(CAMERA_VIEW_DIRECTION, cameraDistance);
  perspectiveCamera.near = cameraDistance / 100;
  perspectiveCamera.far = cameraDistance * 100;
  perspectiveCamera.updateProjectionMatrix();
  if (orbitControls) {
    orbitControls.target.copy(boxCenter);
    orbitControls.update();
  } else {
    perspectiveCamera.lookAt(boxCenter);
  }
  return boundingBox.min.y;
}

interface ViewerErrorBoundaryProps {
  resetKey: string;
  children: ReactNode;
}

interface ViewerErrorBoundaryState {
  hasError: boolean;
}

/** Shows a message instead of crashing the page when a GLB cannot be loaded. */
class ViewerErrorBoundary extends Component<ViewerErrorBoundaryProps, ViewerErrorBoundaryState> {
  state: ViewerErrorBoundaryState = { hasError: false };

  /** Switch to the error message when loading or rendering throws. */
  static getDerivedStateFromError(): ViewerErrorBoundaryState {
    return { hasError: true };
  }

  /** A different file gets a fresh attempt. */
  componentDidUpdate(previousProps: ViewerErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  /** Render the 3D view, or the error message. */
  render() {
    if (this.state.hasError) {
      return <div className={styles.text_viewer_error}>No se pudo cargar el modelo 3D</div>;
    }
    return this.props.children;
  }
}
