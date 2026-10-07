"""
Prepare elZancudo's "Human heart for Cycles" (CC BY 3.0) for Grasp: one object per component id.

  blender -b --python scripts/models/split-heart-cycles.py -- Human_heart.blend Human_heart_split.blend [cut_x cut_tilt]
  then: blender -b --python scripts/models/blend-to-glb.py -- Human_heart_split.blend heart_cycles.glb

What it does (the source .blend is never modified; the result is saved as a new file):
  1. Applies the Multires modifier on `Ventriculos` at its viewport level (what the glTF export used anyway).
  2. Separates `Ventriculos` by material: 'Azul Cava' is the pulmonary trunk, 'Corazon' the ventricles.
  3. Cuts the ventricles into left and right with one plane along the interventricular groove and caps both
     cut faces. ponytail: a planar septum, not a sculpted one; good enough to grab and place. `cut_x` (Blender
     X at z = 0) and `cut_tilt` (degrees, positive leans the apex towards +X) move the plane.
  4. Renames objects to component ids. The author's atrium names are mirrored (named from the viewer's side):
     `Auricula izq` carries the superior vena cava, so it is the RIGHT atrium; `Auricula der` the LEFT.
  5. Sets each part's origin to its geometry centre and adds an empty `socket_<id>` there: the assembled pose.
  6. Deletes cameras and lights.
Orientation: Blender front view (from -Y) is anterior; +X is the patient's left.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
if len(args) not in (2, 4):
    sys.exit("usage: blender -b --python split-heart-cycles.py -- in.blend out.blend [cut_x cut_tilt_deg]")
src, out = args[0], args[1]
# Defaults fitted to the anterior interventricular (LAD) groove on the 2026-10-07 renders.
cut_x, cut_tilt = (float(args[2]), float(args[3])) if len(args) == 4 else (1.71, -8.6)

bpy.ops.wm.open_mainfile(filepath=src)
for o in list(bpy.data.objects):
    if o.type in ("CAMERA", "LIGHT"):
        bpy.data.objects.remove(o, do_unlink=True)


def only(o):
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


# 1-2. Bake multires, split by material.
v = bpy.data.objects["Ventriculos"]
only(v)
for m in list(v.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="MATERIAL")
bpy.ops.object.mode_set(mode="OBJECT")
parts = [o for o in bpy.data.objects if o.name.startswith("Ventriculos")]
def face_material(o):
    return o.material_slots[o.data.polygons[0].material_index].material.name


trunk = next(o for o in parts if face_material(o).startswith("Azul Cava"))
ventricles = next(o for o in parts if o is not trunk)
# Each separated object keeps both slots; drop the unused one so the export has one material per part.
for o in (trunk, ventricles):
    only(o)
    bpy.ops.object.material_slot_remove_unused()

# 3. Cut the ventricles: plane through (cut_x, 0, 0), normal +X tilted about Y.
t = math.radians(cut_tilt)
normal = Vector((math.cos(t), 0.0, math.sin(t)))
co = Vector((cut_x, 0.0, 0.0))
inv = ventricles.matrix_world.inverted()
co_l, no_l = inv @ co, (inv.to_3x3() @ normal).normalized()


def half(obj, keep_positive, name):
    dup = obj.copy()
    dup.data = obj.data.copy()
    bpy.context.collection.objects.link(dup)
    bm = bmesh.new()
    bm.from_mesh(dup.data)
    res = bmesh.ops.bisect_plane(
        bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co_l, plane_no=no_l,
        clear_inner=keep_positive, clear_outer=not keep_positive,
    )
    cut_edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)  # cap the septum face
    bm.to_mesh(dup.data)
    bm.free()
    dup.name = dup.data.name = name
    return dup


lv = half(ventricles, True, "left_ventricle")
rv = half(ventricles, False, "right_ventricle")
bpy.data.objects.remove(ventricles, do_unlink=True)

# 4. Component ids.
renames = {
    "Aorta": "aorta",
    trunk.name: "pulmonary_artery",
    "Auricula izq": "right_atrium",
    "Auricula der": "left_atrium",
    "Arteritas": "coronary_arteries",
    "Venitas": "coronary_veins",
}
for old, new in renames.items():
    o = bpy.data.objects[old]
    o.name = new
    o.data.name = new

# 5. Origins to geometry, sockets at the assembled pose.
components = ["aorta", "pulmonary_artery", "left_ventricle", "right_ventricle", "left_atrium", "right_atrium"]
for cid in components:
    o = bpy.data.objects[cid]
    only(o)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    e = bpy.data.objects.new(f"socket_{cid}", None)
    e.empty_display_type = "SPHERE"
    e.location = o.location.copy()
    bpy.context.collection.objects.link(e)

for cid in components + ["coronary_arteries", "coronary_veins"]:
    o = bpy.data.objects[cid]
    print(f"{cid:18} tris {sum(len(p.vertices) - 2 for p in o.data.polygons):6}  origin {tuple(round(c, 2) for c in o.location)}  dims {tuple(round(c, 2) for c in o.dimensions)}")

bpy.ops.wm.save_as_mainfile(filepath=out, copy=True)
print("saved", out, f"(cut_x={cut_x}, cut_tilt={cut_tilt})")
