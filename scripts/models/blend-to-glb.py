"""
Export a Cycles-era .blend as a glTF-ready .glb with textures.

Run with Blender (any OS):
  blender -b --python scripts/models/blend-to-glb.py -- input.blend output.glb
or, where the `bpy` pip package is installed (Blender as a Python module, same major version as the .blend):
  python scripts/models/blend-to-glb.py input.blend output.glb
The .blend on disk is never modified; materials are rebuilt in memory only.

Then compress: npx @gltf-transform/cli optimize output.glb heart.glb --compress draco --texture-compress webp
  --texture-size 1024 --join false --flatten false --simplify false --instance false --prune false  (keeps parts separate and the socket_* empties)

glTF only understands Principled BSDF with an Image Texture in Base Color, so every material is rebuilt:
the first image the old network used becomes Base Color; a material with no image keeps the old diffuse
colour. Procedural textures (Noise) are dropped (bake them first if they matter). Modifiers are applied by
the exporter; cameras and lights are not exported, empties are (as socket_* nodes). Object names become glTF node names.
"""
import sys
import bpy

# Blender passes script arguments after "--"; plain python passes them directly.
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
if len(args) != 2 or not args[0].endswith(".blend") or not args[1].endswith(".glb"):
    sys.exit("usage: python scripts/models/blend-to-glb.py input.blend output.glb\n"
             "   or: blender -b --python scripts/models/blend-to-glb.py -- input.blend output.glb")
src, out = args
bpy.ops.wm.open_mainfile(filepath=src)

# Images a material uses: prefer one whose name does not look like a bump/normal map ("_b", " b.").
def pick_image(mat):
    imgs = [n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]
    colour = [i for i in imgs if not any(t in i.name.lower() for t in ("_b0", " b.", "_b.", "bump", "normal"))]
    return (colour or imgs or [None])[0]

def diffuse_colour(mat):
    for n in mat.node_tree.nodes:
        if n.type in ("BSDF_DIFFUSE", "BSDF_PRINCIPLED"):
            return tuple(n.inputs[0].default_value)
    return (0.6, 0.2, 0.2, 1.0)

for mat in bpy.data.materials:
    if not mat.use_nodes or not mat.node_tree:
        continue
    img, colour = pick_image(mat), diffuse_colour(mat)
    nt = mat.node_tree
    nt.nodes.clear()
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.55
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(bsdf.outputs["BSDF"], outn.inputs["Surface"])
    if img:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = colour
    print(f"material {mat.name!r}: base colour = {img.name if img else colour}")

# Packed images must be readable by the exporter as image data; they are, so nothing to unpack.
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    if o.type in ("MESH", "EMPTY"):  # empties carry socket_<id> poses for the manifest scaffold
        o.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,       # meshes and empties only: no camera, no lights
    export_apply=True,        # apply Subdivision / Multires as seen in the viewport
    export_yup=True,
    export_image_format="AUTO",
    export_materials="EXPORT",
)
print("exported", out)
