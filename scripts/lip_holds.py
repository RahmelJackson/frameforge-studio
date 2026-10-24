"""Explicit original-picture holds; no automatic occlusion claim."""
def strength_at(index, fps, ranges):
    time=index/fps
    for item in ranges:
        if item['start']<=time<item['end']:return 0.0
    distances=[(item['start']-time)*fps/2 if time<item['start'] else ((time-item['end'])*fps+1)/2 for item in ranges]
    return min(1.0,max(0.0,min(distances,default=1)))

def held_at(index,fps,ranges):
    return any(item['start']<=index/fps<item['end'] for item in ranges)
