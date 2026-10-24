"""Whole-board global embeddings; no layout coordinates enter conditioning."""
import numpy as np
def pool(cards):
    values=np.asarray(cards,dtype=np.float32)
    if values.ndim!=2 or not 1<=len(values)<=16 or not np.isfinite(values).all() or np.any(np.linalg.norm(values,axis=1)<1e-8):raise ValueError('Expected 1–16 finite nonzero card embeddings.')
    return values.mean(axis=0,dtype=np.float32)

def style_scale(strength):
    if not np.isfinite(strength) or not 0<=strength<=1.2:raise ValueError('Style strength is out of range.')
    return {'up':{'block_0':[0.0,float(strength),0.0]}}

def subtract_content(average,content,strength):
    a=np.asarray(average,dtype=np.float32);c=np.asarray(content,dtype=np.float32)
    if a.ndim!=1 or a.shape!=c.shape or not np.isfinite(a).all() or not np.isfinite(c).all() or not np.isfinite(strength) or not 0<=strength<=1:raise ValueError('Content subtraction needs matching finite global embeddings and a bounded strength.')
    return a-c*strength
