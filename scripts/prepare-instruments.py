"""Prepare existing licensed geometry in Blender; never add runtime control overlays."""
import bpy, bmesh, math, pathlib, json
import importlib.util
from mathutils import Vector, Matrix
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('instrument_modeling',ROOT/'scripts/instrument-modeling.py');modeling=importlib.util.module_from_spec(spec);spec.loader.exec_module(modeling)
OUT=ROOT/'public/models/playable'; OUT.mkdir(exist_ok=True)
REPORT={}
NAMES=['C','CSharp','D','DSharp','E','F','FSharp','G','GSharp','A','ASharp','B']
def label(m): return NAMES[m%12]+str(m//12-1)
def bounds(o):
    vs=[v.co for v in o.data.vertices]
    return Vector([min(v[i] for v in vs) for i in range(3)]),Vector([max(v[i] for v in vs) for i in range(3)])
def mark(o,name,midi,kind,axis='y',amount=.02):
    o.name=name; o['note']=midi; o['motion']=kind; o['axis']=axis; o['amount']=amount
def origin(o,point):
    for v in o.data.vertices:v.co-=point
    o.location=point
def violin_body():
    """Rebuild the soundbox with an arched plate and cut sound holes."""
    varnish=bpy.data.materials['varnish'];spruce=bpy.data.materials['spruce']
    for name in ['violin_0','violin_1','violin_2','violin_2.001']:
        bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
    profile=[(.012,0),(.018,.045),(.037,.085),(.073,.102),(.112,.098),(.14,.079),(.148,.067),(.158,.073),(.168,.055),(.194,.046),(.215,.052),(.229,.067),(.239,.059),(.251,.074),(.285,.083),(.32,.072),(.349,.045),(.367,0)]
    points=[Vector((w,y)) for y,w in profile]+[Vector((-w,y)) for y,w in reversed(profile[1:-1])]
    ring=[]
    for i,p1 in enumerate(points):
        p0=points[(i-1)%len(points)];p2=points[(i+1)%len(points)];p3=points[(i+2)%len(points)]
        for step in range(5):
            t=step/5;ring.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    n=len(ring);vertices=[];faces=[];center=Vector((0,.19))
    for scale in [1,.975,.955,.82,.6,.3,0]:
        for p in ring:
            v=center+(p-center)*scale;vertices.append((v.x,v.y,.055+.01*(1-scale*scale)))
    for r in range(6):
        for i in range(n):faces.append((r*n+i,r*n+(i+1)%n,(r+1)*n+(i+1)%n,(r+1)*n+i))
    offset=len(vertices);vertices.extend((p.x,p.y,.01) for p in ring)
    for i in range(n):faces.append((i,offset+i,offset+(i+1)%n,(i+1)%n))
    faces.append(tuple(reversed(range(offset,offset+n))))
    mesh=bpy.data.meshes.new('Violin_ArchedSoundbox');mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    body=bpy.data.objects.new('Violin_Soundbox',mesh);bpy.context.collection.objects.link(body)
    ink=bpy.data.materials.new('Violin_Inlay');ink.diffuse_color=(.016,.006,.003,1);ink.use_nodes=True;ink.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.016,.006,.003,1)
    for mat in [spruce,varnish,ink]:mesh.materials.append(mat)
    for p in mesh.polygons:
        p.material_index=1 if p.center.z<.054 else 2 if n<=p.index<2*n else 0
    # Each cutter is an actual F-shaped opening in the plate, removed after boolean.
    for side in [-1,1]:
        path=[(.037,.14),(.041,.145),(.037,.152),(.031,.166),(.029,.185),(.035,.204),(.042,.222),(.039,.229),(.033,.227)]
        curve=bpy.data.curves.new('F_Hole_Cutter','CURVE');curve.dimensions='2D';curve.resolution_u=10;curve.fill_mode='BOTH';curve.extrude=.018
        spline=curve.splines.new('POLY');outline=[]
        for x,y in path:outline.append((side*(x-.0025),y))
        for x,y in reversed(path):outline.append((side*(x+.0025),y))
        spline.points.add(len(outline)-1)
        for p,(x,y) in zip(spline.points,outline):p.co=(x,y,0,1)
        spline.use_cyclic_u=True
        cutter=bpy.data.objects.new('F_Hole_Cutter',curve);bpy.context.collection.objects.link(cutter);cutter.location.z=.059
        bpy.ops.object.select_all(action='DESELECT');cutter.select_set(True);bpy.context.view_layer.objects.active=cutter;bpy.ops.object.convert(target='MESH');cutter=bpy.context.object
        bpy.context.view_layer.objects.active=body
        mod=body.modifiers.new('Carved sound hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    for p in body.data.polygons:
        if .035<p.center.z<.05:p.material_index=2
def acoustic_body():
    """Replace the faceted source soundbox with a hollow, smoothly outlined soundbox."""
    old=bpy.data.objects['acoustic-guitar-on-stand_0'];material=old.data.materials[0]
    bpy.data.objects.remove(old,do_unlink=True)
    # Dreadnought perimeter, expressed as right-hand widths along the long axis.
    profile=[(.15,0),(.16,.08),(.20,.145),(.27,.184),(.34,.19),(.39,.173),(.43,.137),(.47,.126),(.52,.157),(.57,.17),(.61,.143),(.642,.077),(.648,0)]
    points=[(w,z) for z,w in profile]+[(-w,z) for z,w in reversed(profile[1:-1])]
    # Catmull-Rom interpolation produces the outline itself, not an applied control layer.
    ring=[]
    for i,p1 in enumerate(points):
        p0=Vector(points[(i-1)%len(points)]);p1=Vector(p1);p2=Vector(points[(i+1)%len(points)]);p3=Vector(points[(i+2)%len(points)])
        for step in range(6):
            t=step/6;v=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);ring.append(v)
    count=len(ring);vertices=[(p.x,y,p.y) for y in [-.10,.035] for p in ring]
    faces=[tuple(reversed(range(count))),tuple(range(count,2*count))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh=bpy.data.meshes.new('Acoustic_HollowSoundbox');mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    body=bpy.data.objects.new('Acoustic_Soundbox',mesh);bpy.context.collection.objects.link(body);mesh.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
    # A real sound hole cut through the soundboard; the dark interior is the cavity.
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.048,depth=.12,location=(0,-.11,.428),rotation=(math.pi/2,0,0))
    cutter=bpy.context.object;bpy.context.view_layer.objects.active=body
    boolean=body.modifiers.new('Sound hole','BOOLEAN');boolean.operation='DIFFERENCE';boolean.object=cutter
    bpy.ops.object.modifier_apply(modifier=boolean.name);bpy.data.objects.remove(cutter,do_unlink=True)
    mesh=body.data;mesh.update()
    interior=bpy.data.materials.new('Acoustic_Cavity');interior.diffuse_color=(.018,.009,.004,1);interior.use_nodes=True
    interior.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.018,.009,.004,1)
    mesh.materials.append(interior)
    interior_index=len(mesh.materials)-1
    for face in mesh.polygons:
        center=sum((mesh.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
        if center.y>-.099 and center.x**2+(center.z-.428)**2<.049**2:face.material_index=interior_index
    bevel=body.modifiers.new('Soundboard edge','BEVEL');bevel.width=.003;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for o in [o for o in bpy.context.scene.objects if o.type=='MESH' and o!=body]:
        lo,hi=bounds(o)
        if o.get('motion')=='string':
            mid=(lo.y+hi.y)/2
            for v in o.data.vertices:
                t=max(0,min(1,(v.co.z-.33)/(.70)))
                v.co.y=-.116+.010*t+(v.co.y-mid)*.002/max(.001,hi.y-lo.y)
        elif o.name.startswith('acoustic-guitar-on-stand_2') and hi.z<1.01 and lo.z>.6:
            for v in o.data.vertices:v.co.y=-.11+(v.co.y-lo.y)*.002/max(.001,hi.y-lo.y)
        elif o.name in ['acoustic-guitar-on-stand_0.001','acoustic-guitar-on-stand_1']:
            front=-.104 if o.name.endswith('_1') else -.098
            depth=.008 if o.name.endswith('_1') else .030
            bottom=.495 if o.name.endswith('_1') else .615
            for v in o.data.vertices:
                v.co.y=front+(v.co.y-lo.y)*depth/max(.001,hi.y-lo.y)
                v.co.z=bottom+(v.co.z-lo.z)*(hi.z-bottom)/(hi.z-lo.z)
        elif hi.z<.5 and lo.z>.29:
            # Rosette, bridge and saddle are seated on the rebuilt soundboard.
            for v in o.data.vertices:v.co.y=-.112+(v.co.y-lo.y)*.006/max(.001,hi.y-lo.y)
    # The old opaque sound-hole disc is no longer needed after the boolean cut.
    disc=bpy.data.objects.get('acoustic-guitar-on-stand_1.001')
    if disc:bpy.data.objects.remove(disc,do_unlink=True)
    modeling.finish_acoustic(body)
def prepare(id,source):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artifacts/model-audit'/f'{source}.blend'))
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    rotation=Matrix.Identity(4)
    if id in ['piano','trumpet']:rotation=Matrix.Rotation(-math.pi/2,4,'Z')
    if id=='drums':rotation=Matrix.Rotation(math.pi,4,'Z')
    if id=='violin':rotation=Matrix.Rotation(math.pi/2,4,'X')
    if id=='piano':
        white=sorted([o for o in objs if set(m.name for m in o.data.materials if m)=={'FFFFFF'} or (len(o.data.vertices)==8 and bounds(o)[0].z>4.9 and bounds(o)[0].x>4.9 and bounds(o)[1].z<5.3)],key=lambda o:bounds(o)[0].y)
        black=sorted([o for o in objs if len(o.data.vertices)==8 and 4.62<bounds(o)[0].x<4.63],key=lambda o:bounds(o)[0].y)
        assert len(white)==88 and len(black)==38,(len(white),len(black))
        whites=[m for m in range(21,109) if m%12 not in [1,3,6,8,10]]
        blacks=[m for m in range(21,109) if m not in whites]
        start=-5.25; width=10/52
        for o,m in zip(white,whites):
            lo,hi=bounds(o); mid=(lo.y+hi.y)/2; target=start+(whites.index(m)+.5)*width
            for v in o.data.vertices:v.co.y=target+(v.co.y-mid)*width*.95/(hi.y-lo.y)
            mark(o,'Piano_Key_'+label(m),m,'key',amount=.025)
        for o,m in zip(black,blacks):
            lo,hi=bounds(o);mid=(lo.y+hi.y)/2; target=start+sum(w<m for w in whites)*width
            for v in o.data.vertices:v.co.y=target+(v.co.y-mid)*width*.58/(hi.y-lo.y)
            mark(o,'Piano_Key_'+label(m),m,'key',amount=.025)
        for o in white[52:]+black[36:]:bpy.data.objects.remove(o,do_unlink=True)
    if id in ['acoustic','electric','bass','violin']:
        if id=='acoustic':parts=[bpy.data.objects[f'acoustic-guitar-on-stand_2.{i:03}'] for i in range(31,37)]
        if id=='violin':parts=[bpy.data.objects[f'violin_5.{i:03}'] for i in range(1,5)]
        if id=='electric':parts=[bpy.data.objects[f'ElectricGuitar_mesh.{i:03}'] for i in range(14,20)]
        if id=='bass':parts=sorted([bpy.data.objects[f'Bass1.{i:03}'] for i in range(35,39)],key=lambda o:bounds(o)[0].x)
        notes=[55,62,69,76] if id=='violin' else [28,33,38,43] if id=='bass' else [40,45,50,55,59,64]
        for o,m in zip(parts,notes):
            mark(o,('Violin' if id=='violin' else 'Bass' if id=='bass' else 'Guitar')+'_String_'+label(m),m,'string','x',.012)
            bm=bmesh.new();bm.from_mesh(o.data)
            bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=24,use_grid_fill=True)
            bm.to_mesh(o.data);bm.free()
        if id=='acoustic':
            # Remove the storage stand and its padded supports, not instrument geometry.
            remove=['acoustic-guitar-on-stand_2.'+str(i).zfill(3) for i in range(37,42)]+['acoustic-guitar-on-stand_1.'+str(i).zfill(3) for i in range(3,7)]
            for n in remove:bpy.data.objects.remove(bpy.data.objects[n],do_unlink=True)
            acoustic_body()
        if id=='violin':violin_body();modeling.violin_bow()
    if id=='trumpet':
        for i,n in enumerate(['trumpet_1.002','trumpet_1.001','trumpet_1']):mark(bpy.data.objects[n],f'Trumpet_Valve_{i+1:02}',[65,66,64][i],'valve',amount=.055)
    if id=='saxophone':
        modeling.saxophone()
    if id=='drums':
        for number,name,m in [(46,'Snare',38),(47,'FloorTom',43),(48,'Tom1',45),(49,'Tom2',47),(50,'Kick',36)]:
            o=bpy.data.objects[f'DrumSet1.{number:03}']
            # Extract existing planar head faces; leave shell and rim fixed.
            axis=Vector((0,1,0)) if name=='Kick' else Vector((0,0,1))
            normal=max((p.normal.copy() for p in o.data.polygons),key=lambda n:sum(p.area for p in o.data.polygons if abs(p.normal.dot(n))>.995))
            selected=[p for p in o.data.polygons if abs(p.normal.dot(normal))>.995]
            ids={i for p in selected for i in p.vertices};ordered=sorted(ids);mapping={v:i for i,v in enumerate(ordered)}
            mesh=bpy.data.meshes.new('Membrane_'+name)
            mesh.from_pydata([o.data.vertices[i].co.copy() for i in ordered],[],[[mapping[i] for i in p.vertices] for p in selected]);mesh.update()
            head=bpy.data.objects.new('Drum_'+name,mesh);bpy.context.collection.objects.link(head)
            material=bpy.data.materials.get('Drum_Membrane')
            if not material:
                material=bpy.data.materials.new('Drum_Membrane');material.diffuse_color=(.5,.48,.43,1);material.use_nodes=True
                material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.5,.48,.43,1)
                material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.6
            mesh.materials.append(material)
            bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table()
            bmesh.ops.delete(bm,geom=[bm.faces[p.index] for p in selected],context='FACES');bm.to_mesh(o.data);bm.free()
            mark(head,'Drum_'+name,m,'drum','z' if name=='Kick' else 'y',.012)
            # The cap itself is the clickable surface, without proxy geometry.
        crash=bpy.data.objects['DrumSet1.051'];mark(crash,'Drum_Crash',49,'cymbal',amount=.09)
        mark(bpy.data.objects['DrumSet1.054'],'Drum_HiHat',42,'cymbal',amount=.05)
        mark(bpy.data.objects['DrumSet1.055'],'Drum_OpenHiHat',46,'cymbal',amount=.06)
        # Add a complete ride assembly derived from the source cymbal and its stand.
        for n in [16,17,18,19,52]:
            src=bpy.data.objects[f'DrumSet1.{n:03}'];dup=src.copy();dup.data=src.data.copy();bpy.context.collection.objects.link(dup)
            for v in dup.data.vertices:v.co.x+=2.15;v.co.y-=.65
        ride=crash.copy();ride.data=crash.data.copy();bpy.context.collection.objects.link(ride)
        for v in ride.data.vertices:v.co.x+=2.15;v.co.y-=.65
        mark(ride,'Drum_Ride',51,'cymbal',amount=.07)
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    used={m for o in objs for m in o.data.materials if m}
    for mat in used:
        if not mat.use_nodes:continue
        shader=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not shader:continue
        if any(word in mat.name.lower() for word in ['brass','nickel','metal','steel']):
            shader.inputs['Metallic'].default_value=.7;shader.inputs['Roughness'].default_value=.28
        if id in ['acoustic','violin'] and any(word in mat.name.lower() for word in ['timber','varnish','spruce']):
            shader.inputs['Roughness'].default_value=.32
            shader.inputs['Base Color'].default_value=(.17,.04,.009,1) if id=='violin' else (.32,.105,.028,1) if 'varnish' in mat.name.lower() else (.38,.20,.075,1)
    for o in objs:
        for v in o.data.vertices:v.co=rotation@v.co
    lo=Vector([min(bounds(o)[0][i] for o in objs) for i in range(3)])
    hi=Vector([max(bounds(o)[1][i] for o in objs) for i in range(3)])
    scale=4/max(hi-lo); center=(lo+hi)/2
    for o in objs:
        for v in o.data.vertices:v.co=(v.co-center)*scale
        low,high=bounds(o)
        pivot=(low+high)/2
        if o.get('motion')=='key':pivot.y=high.y
        if o.get('motion')=='cymbal':
            # Cymbal origin at the stand post, not an arbitrary scene center.
            pivot=(low+high)/2
        origin(o,pivot)
        if 'note' not in o:o.name=id.title()+'_Body_'+o.name
        for poly in o.data.polygons:
            if len(o.data.vertices)>50 and o.get('motion')!='key':poly.use_smooth=True
    # Combine only static geometry. Moving parts remain separate named nodes.
    bpy.ops.object.select_all(action='DESELECT')
    static=[o for o in objs if 'note' not in o]
    for o in static:o.select_set(True)
    bpy.context.view_layer.objects.active=static[0];bpy.ops.object.join();static[0].name=id.title()+'_Body'
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    moving=[o for o in bpy.context.scene.objects if 'note' in o]
    for o in moving:
        base=o.location.copy();axis={'x':0,'y':2,'z':1}[o['axis']]
        if o['motion']!='string':
            o.keyframe_insert(data_path='location',frame=1)
            o.location[axis]-=o['amount'];o.keyframe_insert(data_path='location',frame=3)
            o.location=base;o.keyframe_insert(data_path='location',frame=10)
            o.animation_data.action.name=o.name+'_Press'
    bpy.context.scene.frame_set(1)
    dest=OUT/(id+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_extras=True,export_animations=True,export_yup=True)
    (ROOT/'artifacts/prepared').mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'artifacts/prepared'/(id+'.blend')))
    expected={o.name for o in moving}
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(dest))
    actual={o.name for o in bpy.context.scene.objects}
    assert expected.issubset(actual),(id,expected-actual)
    REPORT[id]={'parts':sorted(expected),'bytes':dest.stat().st_size,'roundTripVerified':True}
for id,source in [('piano','piano'),('acoustic','acoustic-v2'),('violin','violin-v2'),('trumpet','trumpet-v2'),('saxophone','saxophone-v2'),('drums','drums'),('electric','electric'),('bass','bass')]:prepare(id,source)
(ROOT/'artifacts/prepared/validation.json').write_text(json.dumps(REPORT,indent=2))
