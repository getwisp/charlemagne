# Erzeugt die Pixelgrafiken der Win95-Bedienelemente als CSS-Variablen.
# Aufruf: python3 scripts/gen-win95-controls.py > src/ui/win95-vars.css
import urllib.parse, sys
PAL={'k':'#000','w':'#fff','g':'#c0c0c0','h':'#dfdfdf','d':'#808080'}
def svg(rows):
    h=len(rows); w=len(rows[0]); rects=[]
    for y,row in enumerate(rows):
        x=0
        while x<w:
            ch=row[x]; e=x+1
            while e<w and row[e]==ch: e+=1
            if ch!='.': rects.append(f"<rect x='{x}' y='{y}' width='{e-x}' height='1' fill='{PAL[ch]}'/>")
            x=e
    s=f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' shape-rendering='crispEdges'>{''.join(rects)}</svg>"
    return 'url("data:image/svg+xml,' + urllib.parse.quote(s, safe="=:/ '<>,") + '")'
check=['......k','.....kk','k...kkk','kk.kkk.','kkkkk..','.kkk...','..k....']
def radio(dot):
    rows=[]
    for y in range(12):
        r=''
        for x in range(12):
            dx=x-5.5; dy=y-5.5; d=(dx*dx+dy*dy)**0.5
            tl=(x+y)<11
            if d>=6: c='.'
            elif d>=5: c='d' if tl else 'w'
            elif d>=4: c='k' if tl else 'h'
            else: c='w'
            if dot and d<2: c='k'
            r+=c
        rows.append(r)
    return rows
def button(w,h):
    rows=[]
    for y in range(h):
        r=[]
        for x in range(w):
            if x==w-1 or y==h-1: c='k'
            elif x==w-2 or y==h-2: c='d'
            elif x==0 or y==0: c='h'
            elif x==1 or y==1: c='w'
            else: c='g'
            r.append(c)
        rows.append(r)
    return rows
def arrow(w,h,direction):
    rows=button(w,h)
    cx=(w-2)//2; cy=(h-2)//2
    for i in range(4):
        half=3-i
        for j in range(-half,half+1):
            if direction=='down': x,y=cx+j, cy-1+i
            elif direction=='up': x,y=cx+j, cy+2-i
            elif direction=='right': x,y=cx-1+i, cy+j
            else: x,y=cx+2-i, cy+j
            rows[y][x]='k'
    return [''.join(r) for r in rows]
out = {
 'check': svg(check),
 'radio': svg(radio(False)),
 'radio-on': svg(radio(True)),
 'arrow-down': svg(arrow(16,16,'down')),
 'arrow-up': svg(arrow(16,16,'up')),
 'arrow-left': svg(arrow(16,16,'left')),
 'arrow-right': svg(arrow(16,16,'right')),
 'select-btn': svg(arrow(16,17,'down')),
 'checker': svg(['wg','gw']),
}
sys.stdout.write(":root {\n" + "".join(f"  --img-{k}: {v};\n" for k,v in out.items()) + "}\n")
