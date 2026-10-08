"""Turn a UniMate animation (GLB) into a seamless loop and export it as GLB + FBX.

Runs with the UniMate venv Python (pip bpy 4.0), from the repo root:
    python UI/backend/tools/make_loop.py --input in.glb --output_glb out.glb --output_fbx out.fbx
        [--min_cycle_seconds 0.8] [--blend_frames 12] [--in_place]

Steps:
1. Sample every bone's rotation and location at each frame.
2. Find the pair of frames (start, end) whose poses — and the poses right after them —
   are most alike, with end - start >= the minimum cycle length. The clip is cut there.
3. Close the seam: over the last `blend_frames` frames, rotate/offset each bone a little
   more each frame so the final frame equals the first one exactly.
4. "In place": remove the root's horizontal drift across the cycle, so the character
   moves on the spot (sway inside the cycle is kept).
5. Write the new keyframes and export with UniMate's own exporter.

Prints one line "LOOP_REPORT {json}" with the chosen frames and seam errors.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

import bpy  # noqa: E402  (needs the venv's pip bpy)
from mathutils import Quaternion, Vector  # noqa: E402

from data_process.utils.blender_export import import_gltf, load_scene  # noqa: E402
from data_process.utils.blender_rig import export_selected_to_file  # noqa: E402

CLIP_FPS = 30
BONE_PATH_PATTERN = re.compile(r'^pose\.bones\["(?P<bone>.+)"\]\.(?P<channel>location|rotation_quaternion)$')
LOCATION_WEIGHT = 0.5          # how much non-root bone offsets count in the pose distance
UP_AXIS_INDEX = 2              # Blender world is Z-up


def parse_arguments() -> argparse.Namespace:
    """Command-line options."""
    argument_parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    argument_parser.add_argument("--input", required=True)
    argument_parser.add_argument("--output_glb", required=True)
    argument_parser.add_argument("--output_fbx", required=True)
    argument_parser.add_argument("--min_cycle_seconds", type=float, default=0.8)
    argument_parser.add_argument("--blend_frames", type=int, default=12)
    argument_parser.add_argument("--in_place", action="store_true")
    return argument_parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])


def group_bone_curves(animation_action) -> dict:
    """{bone name: {"rotation_quaternion": [4 fcurves], "location": [3 fcurves]}} from the action."""
    curves_by_bone: dict = {}
    for animation_curve in animation_action.fcurves:
        path_match = BONE_PATH_PATTERN.match(animation_curve.data_path)
        if not path_match:
            continue
        channel_curves = curves_by_bone.setdefault(path_match["bone"], {}).setdefault(path_match["channel"], {})
        channel_curves[animation_curve.array_index] = animation_curve
    return {
        bone_name: {channel_name: [channel_curves[component_index] for component_index in sorted(channel_curves)]
                    for channel_name, channel_curves in channels.items()}
        for bone_name, channels in curves_by_bone.items()
    }


def sample_pose_track(curves_by_bone: dict, first_frame: int, last_frame: int) -> dict:
    """Evaluate every curve at each integer frame: {bone: {"rotations": [Quaternion], "locations": [Vector]}}."""
    pose_track = {}
    for bone_name, channels in curves_by_bone.items():
        rotation_curves = channels.get("rotation_quaternion")
        location_curves = channels.get("location")
        pose_track[bone_name] = {
            "rotations": [Quaternion([curve.evaluate(frame_number) for curve in rotation_curves]).normalized()
                          for frame_number in range(first_frame, last_frame + 1)] if rotation_curves else None,
            "locations": [Vector([curve.evaluate(frame_number) for curve in location_curves])
                          for frame_number in range(first_frame, last_frame + 1)] if location_curves else None,
        }
    return pose_track


def pose_distance(pose_track: dict, root_bone_names: set, first_index: int, second_index: int) -> float:
    """How different two frames look: mean rotation angle (radians) plus non-root bone offsets."""
    rotation_difference_total, location_difference_total, bone_count = 0.0, 0.0, 0
    for bone_name, bone_track in pose_track.items():
        if bone_track["rotations"] is not None:
            rotation_difference_total += bone_track["rotations"][first_index].rotation_difference(
                bone_track["rotations"][second_index]).angle
            bone_count += 1
        if bone_track["locations"] is not None and bone_name not in root_bone_names:
            location_difference_total += (bone_track["locations"][first_index] - bone_track["locations"][second_index]).length
    return (rotation_difference_total + LOCATION_WEIGHT * location_difference_total) / max(1, bone_count)


def find_best_cycle(pose_track: dict, root_bone_names: set, frame_count: int, min_cycle_frames: int):
    """(start, end) frame indices with the most alike poses (and motion), end - start >= min_cycle_frames."""
    best_cycle, best_cost = (0, frame_count - 1), float("inf")
    for start_index in range(0, frame_count - min_cycle_frames):
        for end_index in range(start_index + min_cycle_frames, frame_count):
            seam_cost = pose_distance(pose_track, root_bone_names, start_index, end_index)
            if end_index + 1 < frame_count:
                # also compare the next frames, so the motion continues in the same direction
                seam_cost += pose_distance(pose_track, root_bone_names, start_index + 1, end_index + 1)
            else:
                seam_cost *= 2
            # tiny preference for longer cycles when costs tie
            seam_cost -= 1e-4 * (end_index - start_index) / frame_count
            if seam_cost < best_cost:
                best_cycle, best_cost = (start_index, end_index), seam_cost
    return best_cycle


def blend_weight(cycle_frame: int, loop_frames: int, blend_frames: int) -> float:
    """0 before the blend window, smoothly rising to 1 at the last frame of the cycle."""
    window_start = loop_frames - blend_frames
    if cycle_frame <= window_start:
        return 0.0
    linear_progress = min(1.0, (cycle_frame - window_start) / blend_frames)
    return linear_progress * linear_progress * (3.0 - 2.0 * linear_progress)


def build_loop_track(pose_track: dict, root_bone_names: set, root_world_matrices: dict, start_index: int,
                     end_index: int, blend_frames: int, in_place: bool) -> dict:
    """New per-frame poses for the cycle start..end, with the seam closed (last frame == first frame)."""
    loop_frames = end_index - start_index
    loop_track = {}
    for bone_name, bone_track in pose_track.items():
        new_rotations, new_locations = None, None

        if bone_track["rotations"] is not None:
            start_rotation = bone_track["rotations"][start_index]
            end_rotation = bone_track["rotations"][end_index].copy()
            if start_rotation.dot(end_rotation) < 0:
                end_rotation.negate()  # same hemisphere, so the correction takes the short way
            seam_correction = start_rotation @ end_rotation.inverted()
            new_rotations = []
            for cycle_frame in range(loop_frames + 1):
                frame_rotation = bone_track["rotations"][start_index + cycle_frame]
                partial_correction = Quaternion().slerp(seam_correction, blend_weight(cycle_frame, loop_frames, blend_frames))
                new_rotations.append((partial_correction @ frame_rotation).normalized())

        if bone_track["locations"] is not None:
            start_location = bone_track["locations"][start_index]
            end_location = bone_track["locations"][end_index]
            new_locations = []
            if bone_name in root_bone_names:
                # root offsets are corrected in world space: vertical always, horizontal only when in place
                bone_to_world = root_world_matrices[bone_name]
                world_to_bone = bone_to_world.inverted()
                world_seam_offset = bone_to_world @ (start_location - end_location)
                horizontal_drift = world_seam_offset.copy()
                horizontal_drift[UP_AXIS_INDEX] = 0.0
                vertical_offset = Vector((0.0, 0.0, world_seam_offset[UP_AXIS_INDEX]))
                for cycle_frame in range(loop_frames + 1):
                    world_correction = vertical_offset * blend_weight(cycle_frame, loop_frames, blend_frames)
                    if in_place:
                        world_correction += horizontal_drift * (cycle_frame / loop_frames)
                    new_locations.append(bone_track["locations"][start_index + cycle_frame] + world_to_bone @ world_correction)
            else:
                for cycle_frame in range(loop_frames + 1):
                    seam_weight = blend_weight(cycle_frame, loop_frames, blend_frames)
                    new_locations.append(bone_track["locations"][start_index + cycle_frame]
                                         + (start_location - end_location) * seam_weight)

        loop_track[bone_name] = {"rotations": new_rotations, "locations": new_locations}
    return loop_track


def write_loop_keyframes(curves_by_bone: dict, loop_track: dict) -> None:
    """Replace every bone curve's keys with the loop poses (frames 0..loop length, linear)."""
    for bone_name, channels in curves_by_bone.items():
        for channel_name, channel_curves in channels.items():
            channel_values = loop_track[bone_name]["rotations" if channel_name == "rotation_quaternion" else "locations"]
            for component_index, animation_curve in enumerate(channel_curves):
                animation_curve.keyframe_points.clear()
                animation_curve.keyframe_points.add(len(channel_values))
                for frame_number, frame_value in enumerate(channel_values):
                    keyframe_point = animation_curve.keyframe_points[frame_number]
                    keyframe_point.co = (frame_number, frame_value[component_index])
                    keyframe_point.interpolation = "LINEAR"
                animation_curve.update()


def main() -> None:
    """Load, find the cycle, close the seam, export, report."""
    options = parse_arguments()
    input_path = os.path.abspath(options.input)
    armature_object, _mesh_object = load_scene(import_gltf, input_path, fps=CLIP_FPS)
    animation_action = armature_object.animation_data.action if armature_object.animation_data else None
    if animation_action is None:
        raise SystemExit("ERROR: el GLB no tiene animación")

    first_frame, last_frame = (round(frame_value) for frame_value in animation_action.frame_range)
    frame_count = last_frame - first_frame + 1
    min_cycle_frames = max(4, min(frame_count - 2, round(options.min_cycle_seconds * CLIP_FPS)))
    blend_frames = max(1, min(options.blend_frames, min_cycle_frames // 2))

    curves_by_bone = group_bone_curves(animation_action)
    pose_track = sample_pose_track(curves_by_bone, first_frame, last_frame)
    root_bone_names = {armature_bone.name for armature_bone in armature_object.data.bones if armature_bone.parent is None}
    root_world_matrices = {
        bone_name: (armature_object.matrix_world @ armature_object.data.bones[bone_name].matrix_local).to_3x3()
        for bone_name in root_bone_names
    }

    start_index, end_index = find_best_cycle(pose_track, root_bone_names, frame_count, min_cycle_frames)
    loop_track = build_loop_track(pose_track, root_bone_names, root_world_matrices, start_index, end_index,
                                  blend_frames, options.in_place)
    write_loop_keyframes(curves_by_bone, loop_track)

    loop_frames = end_index - start_index
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 0, loop_frames
    animation_action.name = f"{animation_action.name}_loop"

    os.makedirs(os.path.dirname(os.path.abspath(options.output_glb)), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    export_selected_to_file(os.path.abspath(options.output_glb), "glb")
    export_selected_to_file(os.path.abspath(options.output_fbx), "fbx")

    loop_report = {
        "start_frame": start_index,
        "end_frame": end_index,
        "loop_frames": loop_frames,
        "loop_seconds": round(loop_frames / CLIP_FPS, 3),
        "blend_frames": blend_frames,
        "in_place": options.in_place,
        "seam_error_original_clip": round(pose_distance(pose_track, root_bone_names, 0, frame_count - 1), 5),
        "seam_error_chosen_cut": round(pose_distance(pose_track, root_bone_names, start_index, end_index), 5),
    }
    print("LOOP_REPORT " + json.dumps(loop_report), flush=True)


if __name__ == "__main__":
    main()
