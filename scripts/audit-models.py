import bpy, bmesh, json, pathlib
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
reports = {}
for path in sorted((ROOT / 'public/models').glob('*.glb')):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in objects:
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        bm.to_mesh(o.data); bm.free()
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='LOOSE')
        bpy.ops.object.mode_set(mode='OBJECT')
    parts=[]
    for o in sorted([o for o in bpy.context.scene.objects if o.type=='MESH'], key=lambda o:o.name):
        coords=[o.matrix_world@v.co for v in o.data.vertices]
        lo=[min(c[i] for c in coords) for i in range(3)]
        hi=[max(c[i] for c in coords) for i in range(3)]
        parts.append(dict(name=o.name,vertices=len(coords),min=lo,max=hi,materials=list(set(o.data.materials[p.material_index].name for p in o.data.polygons))))
    reports[path.name]=parts
    print('AUDIT',path.name,len(parts))
    out=ROOT/'artifacts'/'model-audit';out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(path.stem+'.blend')))
(out/'parts.json').write_text(json.dumps(reports,indent=2))
