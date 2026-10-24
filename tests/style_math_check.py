import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import numpy as np
from style_math import pool,style_scale,subtract_content
cards=np.array([[1,2,3],[7,8,9],[-2,1,6]],dtype=np.float32)
assert np.array_equal(pool(cards),cards.sum(0)/3)
assert np.allclose(pool(cards[::-1]),pool(cards))
assert np.linalg.norm(pool(cards)-pool(cards[:-1]))>0
assert style_scale(.8)=={'up':{'block_0':[0,.8,0]}}
assert style_scale(0)=={'up':{'block_0':[0,0,0]}}
for invalid in [[],[[0,0,0]],[[float('nan'),1]],np.ones((17,4)),np.ones((2,3,4))]:
 try:pool(invalid);raise AssertionError('Invalid card embeddings accepted')
 except ValueError:pass
print('Whole-board mean, all-card contribution, order invariance and fixed style-only routing pass.')
average=pool(cards);content=np.array([.2,.4,.6],dtype=np.float32)
assert np.array_equal(subtract_content(average,content,.5),average-content*.5)
assert np.array_equal(subtract_content(average,content,0),average)
for bad in [np.zeros(4),np.array([float('nan'),1,2])]:
 try:subtract_content(average,bad,.5);raise AssertionError('Mismatched/nonfinite subtraction accepted')
 except ValueError:pass
