# L3「光轨 · 圆润小写」定稿：生成 SVG（字标浅 / 深、图标）。坐标：x-height 区 40..100，升部 0。
W=15
def S(d,col): return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{W}" stroke-linecap="round" stroke-linejoin="round"/>'
def C(cx,cy,r,col): return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{col}" stroke-width="{W}"/>'
def glyphs(ink,blue):
    g=[(58, S('M52,40 V100',ink)+C(26,70,26,ink)),
       (50, S('M0,0 V100',ink)+S('M48,40 L12,74',ink)+S('M24,64 L50,100',ink)),
       (58, S('M52,40 V100',ink)+C(26,70,26,ink)),
       (36, S('M0,100 V68 A28,28 0 0 1 36,42',ink)),
       (0,  S('M0,46 V100',ink)+f'<circle cx="0" cy="18" r="9.5" fill="{blue}"/>')]
    out='';x=0
    for w,d in g: out+=f'<g transform="translate({x},0)">{d}</g>'; x+=w+22
    return out,x-22
def wordmark(ink,blue):
    body,w=glyphs(ink,blue); p=W/2+1
    vb=f'{-p:.1f} {-p:.1f} {w+2*p:.1f} {100+2*p:.1f}'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{body}</svg>'
def icon(bg,ink,blue,dot=True):
    a=S('M52,40 V100',ink)+C(26,70,26,ink)
    d=f'<circle cx="70" cy="26" r="10" fill="{blue}"/>' if dot else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="{bg}"/>'
            f'<g transform="translate(35,-6)">{a}{d}</g></svg>')
open('akari-wordmark-light.svg','w').write(wordmark('#12151c','#2563eb'))
open('akari-wordmark-dark.svg','w').write(wordmark('#eceef2','#4a9dff'))
open('akari-icon.svg','w').write(icon('#12151c','#ffffff','#4a9dff'))
open('akari-icon-light.svg','w').write(icon('#ffffff','#12151c','#2563eb'))
