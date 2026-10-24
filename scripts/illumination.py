"""Transfer only a smooth, bounded luminance field from an AI lighting proposal."""
import numpy as np
from PIL import Image

def linear(rgb):
    value=np.asarray(rgb,dtype=np.float32)/255
    return np.where(value<=.04045,value/12.92,((value+.055)/1.055)**2.4)

def apply_field(source,field):
    rgb=linear(source)*np.exp2(field[:,:,None])
    clipped=float(np.mean(np.any(rgb>1,axis=2)))
    rgb=np.clip(rgb,0,1)
    srgb=np.where(rgb<=.0031308,rgb*12.92,1.055*np.power(rgb,1/2.4)-.055)
    return Image.fromarray(np.clip(np.rint(srgb*255),0,255).astype('uint8')),clipped

def lighting_field(source,candidate,strength,max_ev,previous=None,fps=16):
    if source.size!=candidate.size:raise ValueError('Lighting proposal and original must have the same dimensions.')
    if not 0<=strength<=1 or not .1<=max_ev<=2:raise ValueError('Lighting controls are out of range.')
    def smooth_luminance(image):
        luminance=linear(image)@np.array([.2126,.7152,.0722],dtype=np.float32)
        # Keep floating-point precision through the blur, especially in shadows.
        from scipy.ndimage import gaussian_filter
        return gaussian_filter(luminance,sigma=min(source.size)/12,mode='reflect')
    field=np.clip(np.log2((smooth_luminance(candidate)+.01)/(smooth_luminance(source)+.01)),-max_ev,max_ev)*strength
    if previous is not None:
        # Bound changes in the correction, not genuine motion/exposure in the source.
        field=previous+np.clip((field-previous)*.25,-.5/fps,.5/fps)
    return field.astype(np.float32)
