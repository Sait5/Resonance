"""Purpose-built instrument geometry. These meshes are the instruments, not hit proxies."""
import bpy, math
from mathutils import Vector

def material(name,color,metal=0,roughness=.35):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    s=m.node_tree.nodes['Principled BSDF'];s.inputs['Base Color'].default_value=(*color,1)
    s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=roughness
    return m

def finish_acoustic(body):
    top=material('Acoustic_SpruceTop',(.43,.23,.09),0,.36)
    side=material('Acoustic_RosewoodSides',(.075,.018,.008),0,.3)
    image=bpy.data.images.new('Spruce_grain',width=256,height=512)
    pixels=[]
    for y in range(512):
        for x in range(256):
            grain=.91+.055*math.sin(x*2.7+.8*math.sin(y*.016))+.035*math.sin(x*.32+math.sin(y*.009))
            pixels.extend((.63*grain,.43*grain,.23*grain,1))
    image.pixels=pixels;image.pack()
    nodes=top.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=image
    top.node_tree.links.new(tex.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])
    mesh=body.data;mesh.materials.append(top);top_index=len(mesh.materials)-1;mesh.materials.append(side);side_index=len(mesh.materials)-1
    uv=mesh.uv_layers.new(name='WoodGrain')
    for face in mesh.polygons:
        current=mesh.materials[face.material_index]
        if not current or current.name!='Acoustic_Cavity':face.material_index=top_index if face.center.y<-.095 else side_index
        for index in face.loop_indices:
            p=mesh.vertices[mesh.loops[index].vertex_index].co;uv.data[index].uv=((p.x+.2)/.4,(p.z-.15)/.5)
    fret=material('Acoustic_EbonyFretboard',(.012,.008,.006),0,.4)
    for name in ['acoustic-guitar-on-stand_1','acoustic-guitar-on-stand_1.002']:
        obj=bpy.data.objects[name];obj.data.materials.clear();obj.data.materials.append(fret)
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o==body or o.get('motion')=='string':continue
        if min(v.co.z for v in o.data.vertices)>1.018:
            for v in o.data.vertices:v.co.y-=.14
    head=bpy.data.objects['acoustic-guitar-on-stand_0.002']
    head.data.materials.clear();head.data.materials.append(side)
    bpy.context.view_layer.objects.active=head
    mod=head.modifiers.new('Headstock eased edges','BEVEL');mod.width=.005;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)

def tube(name,points,radii,mat,wall=0,segments=24):
    pts=[Vector(p) for p in points];verts=[];faces=[]
    for layer in range(2 if wall else 1):
        for i,p in enumerate(pts):
            tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
            ref=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
            u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
            r=radii[i]-(wall if layer else 0)
            for j in range(segments):verts.append(p+r*(math.cos(j*math.tau/segments)*u+math.sin(j*math.tau/segments)*v))
    rings=len(pts);layer_size=rings*segments
    for layer in range(2 if wall else 1):
        base=layer*layer_size
        for i in range(rings-1):
            for j in range(segments):
                a=base+i*segments+j;b=base+i*segments+(j+1)%segments
                face=(a,b,b+segments,a+segments);faces.append(tuple(reversed(face)) if layer else face)
    if wall:
        for ring in [0,rings-1]:
            for j in range(segments):
                a=ring*segments+j;b=ring*segments+(j+1)%segments;faces.append((a,a+layer_size,b+layer_size,b))
    else:
        faces.append(tuple(reversed(range(segments))));faces.append(tuple(range((rings-1)*segments,rings*segments)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(mat)
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    for p in mesh.polygons:p.use_smooth=True
    return o

def curve_points(points,radii,steps=6):
    result=[];sizes=[];points=[Vector(p) for p in points]
    for i in range(len(points)-1):
        p0=points[max(0,i-1)];p1=points[i];p2=points[i+1];p3=points[min(i+2,len(points)-1)]
        for k in range(steps):
            t=k/steps
            result.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
            sizes.append(radii[i]*(1-t)+radii[i+1]*t)
    return result+[points[-1]],sizes+[radii[-1]]

def saxophone():
    for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)
    gold=material('Sax_LacqueredBrass',(.55,.30,.07),.82,.25)
    silver=material('Sax_Nickel',(.55,.57,.54),.8,.25)
    pearl=material('Sax_Pearl',(.82,.78,.65),.1,.23)
    black=material('Sax_Ebonite',(.012,.014,.012),.05,.28)
    path=[(0,0,2.22),(0,0,1.7),(0,0,.65),(-.04,0,.40),(-.17,0,.25),(-.36,0,.25),(-.51,0,.40),(-.55,0,.65),(-.60,-.035,.90),(-.68,-.09,1.20)]
    radii=[.067,.083,.108,.12,.123,.125,.13,.15,.20,.32]
    points,sizes=curve_points(path,radii)
    tube('Sax_ConicalBodyAndBell',points,sizes,gold,.008,40)
    tube('Sax_RolledBellRim',[points[-2],points[-1]],[.315,.329],gold,.01,48)
    points,sizes=curve_points([(0,0,2.21),(0,0,2.4),(0,-.09,2.55),(0,-.28,2.57),(0,-.41,2.51)],[.067,.056,.043,.037,.034])
    tube('Sax_Crook',points,sizes,gold,.005,32)
    tube('Sax_Mouthpiece',[(0,-.37,2.53),(0,-.49,2.48),(0,-.64,2.44)],[.044,.038,.018],black,0,28)
    tube('Sax_Ligature',[(0,-.45,2.50),(0,-.49,2.485)],[.046,.043],gold,.004,28)
    for x in [-.11,.11]:
        tube('Sax_KeyRod',[(x,-.025,.58),(x,-.025,2.12)],[.009,.009],silver)
        for z in [.64,1.14,1.60,2.08]:tube('Sax_RodPillar',[(x*.7,0,z),(x,-.025,z)],[.018,.012],gold)
    # Main finger cups, pearl touches and lever arms are one movable assembly each.
    for i,z in enumerate([2.08,1.89,1.70,1.49,1.28,1.07,.86,.66,.51,.38]):
        y=-(.076+(2.1-z)*.022)
        cup=tube('Sax_Cup',[(0,y,z),(0,y-.028,z)],[.052,.049],gold)
        touch=tube('Sax_PearlTouch',[(0,y-.03,z),(0,y-.037,z)],[.029,.027],pearl)
        arm=tube('Sax_Lever',[(.11,-.025,z),(0,y-.015,z)],[.009,.009],silver)
        bpy.ops.object.select_all(action='DESELECT')
        for o in [cup,touch,arm]:o.select_set(True)
        bpy.context.view_layer.objects.active=cup;bpy.ops.object.join();cup.name=f'Sax_Key_{i+1:02}'
        cup['note']=[62,60,58,56,55,53,51,63,51,53][i];cup['motion']='sax';cup['axis']='z';cup['amount']=.016
    for z in [.40,.64]:
        tube('Sax_BowGuard',[(-.14,-.1,z),(-.26,-.17,z),(-.43,-.1,z)],[.012]*3,silver)

def violin_bow():
    wood=material('Bow_Pernambuco',(.13,.035,.008),0,.3)
    hair=material('Bow_Horsehair',(.7,.64,.48),0,.65)
    ebony=material('Bow_Ebony',(.012,.009,.008),0,.3)
    pieces=[]
    points=[(-.29,.171,.112),(-.18,.171,.117),(0,.171,.12),(.20,.171,.111),(.29,.171,.105)]
    p,r=curve_points(points,[.0028,.0025,.002,.0015,.001])
    pieces.append(tube('Bow_Stick',p,r,wood,0,12))
    for j in range(6):pieces.append(tube('Bow_Hair',[(-.27,.168+j*.001,.098),(.29,.168+j*.001,.098)],[.00035]*2,hair,0,6))
    pieces.append(tube('Bow_Frog',[(-.27,.171,.10),(-.245,.171,.10)],[.006]*2,ebony,0,8))
    pieces.append(tube('Bow_Tip',[(.29,.171,.098),(.29,.171,.105)],[.0015]*2,wood,0,8))
    bpy.ops.object.select_all(action='DESELECT')
    for o in pieces:o.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();bow=pieces[0];bow.name='Violin_Bow'
    bow['note']=69;bow['motion']='bow';bow['axis']='x';bow['amount']=.35
