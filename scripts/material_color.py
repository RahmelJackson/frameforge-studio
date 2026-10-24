"""Conventional material chroma replacement with original linear-light luminance."""
import numpy as np
from PIL import Image
WEIGHTS=np.array([.2126,.7152,.0722],dtype=np.float64)
def linear(rgb):
    value=np.asarray(rgb,dtype=np.float64)/255
    return np.where(value<=.04045,value/12.92,((value+.055)/1.055)**2.4)
def recolor(image,mask,color,strength):
    source=np.asarray(image.convert('RGB'));rgb=linear(source);luma=rgb@WEIGHTS
    chosen=linear(np.array([int(color[i:i+2],16) for i in [1,3,5]],dtype=np.uint8));target_luma=chosen@WEIGHTS
    direction=chosen/max(target_luma,1e-6)-1 if target_luma>1e-6 else np.zeros(3)
    chroma=luma[:,:,None]*direction
    # Compress chroma into gamut, along constant luminance; never clip highlights blindly.
    limits=np.ones_like(chroma)
    np.divide(1-luma[:,:,None],chroma,out=limits,where=chroma>1e-12)
    np.divide(-luma[:,:,None],chroma,out=limits,where=chroma< -1e-12)
    gamut=np.minimum(1,limits.min(axis=2)).clip(0,1)
    target=luma[:,:,None]+chroma*gamut[:,:,None]
    amount=np.asarray(mask.convert('L'),dtype=np.float64)/255*strength
    output=rgb*(1-amount[:,:,None])+target*amount[:,:,None]
    srgb=np.where(output<=.0031308,output*12.92,1.055*np.maximum(output,0)**(1/2.4)-.055)
    result=np.rint(srgb.clip(0,1)*255).astype(np.uint8)
    result[amount==0]=source[amount==0]
    return Image.fromarray(result)
