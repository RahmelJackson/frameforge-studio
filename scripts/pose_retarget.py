"""Visible 2D body proportions only; never infer hidden joints or 3D anatomy."""
import math
import numpy as np

METHOD = 'visible-2d-target-proportions-v1'
BODY = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7)]
LEGS = [(1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13)]
HEAD = [(1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
MAPPING = [0, None, 12, 14, 16, 11, 13, 15, 24, 26, 28, 23, 25, 27, 5, 2, 8, 7]
LIMITATIONS = ('Visible 2D limb proportions measured from one target image. Foreshortening in that image is retained. '
              'No depth, occlusion repair, face/finger motion or identity guarantee. Inspect the guide before generation.')


def pixels(points, size):
    if len(points) != 18 or len(size) != 2 or min(size) <= 0:
        raise ValueError('Invalid pose geometry.')
    result = []
    for p in points:
        if p is None:
            result.append(None)
        elif len(p) != 2 or not all(math.isfinite(v) and 0 <= v <= 1 for v in p):
            raise ValueError('Pose points must be finite and inside the picture.')
        else:
            result.append(np.asarray(p, dtype=float) * size)
    return result


def checked_length(points, a, b, label):
    if points[a] is None or points[b] is None:
        raise ValueError(label + ': a required joint is missing or uncertain. Use a clear, unobstructed pose.')
    length = float(np.linalg.norm(points[b] - points[a]))
    if length < 2:
        raise ValueError(label + ': a required bone is too small or foreshortened to measure reliably.')
    return length


def retarget_sequence(sequence, source_size, target_points, target_size, framing):
    if framing not in ('upper', 'full') or not sequence:
        raise ValueError('Choose a nonempty upper-body or full-body sequence.')
    target = pixels(target_points, target_size)
    source = [pixels(points, source_size) for points in sequence]
    target_span = checked_length(target, 2, 5, 'Target shoulders')
    driver_spans = [checked_length(frame, 2, 5, 'Driver shoulders') for frame in source]
    if target_span < 8 or min(driver_spans) < 8:
        raise ValueError('Shoulders must be clearly separated in the target and every driver frame.')
    span = float(np.median(driver_spans))
    required = BODY + (LEGS if framing == 'full' else [])
    edges = list(required)
    # Optional head landmarks are carried only when both the target and every
    # driver frame expose their complete chain. No synthetic face joints.
    available = {1, *(b for _, b in required)}
    for a, b in HEAD:
        if a in available and target[a] is not None and target[b] is not None and all(f[a] is not None and f[b] is not None for f in source):
            if np.linalg.norm(target[b] - target[a]) >= 2 and all(np.linalg.norm(f[b] - f[a]) >= 2 for f in source):
                edges.append((a, b)); available.add(b)
    lengths = []
    for a, b in edges:
        target_length = checked_length(target, a, b, 'Target')
        for i, frame in enumerate(source):
            checked_length(frame, a, b, 'Driver frame ' + str(i))
        lengths.append({'from': a, 'to': b, 'targetPixels': target_length,
                        'relativeToShoulders': target_length / target_span,
                        'driverPixels': target_length / target_span * span})
    out = []
    for frame in source:
        pose = [None] * 18
        pose[1] = frame[1].copy()
        for edge in lengths:
            a, b = edge['from'], edge['to']
            direction = frame[b] - frame[a]
            pose[b] = pose[a] + direction / np.linalg.norm(direction) * edge['driverPixels']
        out.append([(p / source_size).tolist() if p is not None else None for p in pose])
    return out, {'method': METHOD, 'rootJoint': 1, 'targetShoulderPixels': target_span,
                 'driverMedianShoulderPixels': span, 'lengths': lengths,
                 'policy': 'Freeze target-relative bone lengths; preserve driver directions and neck trajectory, then fit the whole clip once.',
                 'limitations': LIMITATIONS}


def reconstruct_checked(meta):
    """Independent arithmetic reconstruction for the saved-evidence verifier.

    Recompute lengths and directions from detected landmarks, not saved output
    points or retarget lengths. This checks the operation, not model accuracy.
    """
    if meta['retarget']['method'] != METHOD:
        raise ValueError('Unknown target-proportion method.')
    size = tuple(meta['size']); target_meta = meta['target']; target_size = target_meta['size']
    framing = meta['framing']; source_landmarks = meta['rawLandmarks']; target_landmarks = target_meta['landmarks']

    def mapped(landmarks):
        if len(landmarks) != 33:
            raise ValueError('Expected all 33 detected landmarks.')
        rows = []
        for idx in MAPPING:
            if idx is None:
                rows.append(None); continue
            row = landmarks[idx]
            if not all(math.isfinite(row[k]) for k in ('x', 'y', 'z', 'visibility', 'presence')):
                raise ValueError('Non-finite detected landmark.')
            rows.append([row['x'], row['y']] if min(row['visibility'], row['presence']) >= .6 and 0 <= row['x'] <= 1 and 0 <= row['y'] <= 1 else None)
        if rows[2] is not None and rows[5] is not None:
            rows[1] = [(rows[2][j] + rows[5][j]) / 2 for j in range(2)]
        return rows

    raw = [mapped(x) for x in source_landmarks]; target = mapped(target_landmarks)
    if raw != meta['rawPoints'] or target != target_meta['points']:
        raise ValueError('Saved joints do not match the detected landmarks.')

    def convert(points, dimensions):
        return [None if p is None else [p[k] * dimensions[k] for k in range(2)] for p in points]
    driver = [convert(frame, size) for frame in raw]; target = convert(target, target_size)

    def distance(frame, a, b):
        if frame[a] is None or frame[b] is None:
            raise ValueError('A required retarget joint is absent.')
        value = math.hypot(*(frame[b][j] - frame[a][j] for j in range(2)))
        if value < 2:
            raise ValueError('A required retarget bone is degenerate.')
        return value
    target_span = distance(target, 2, 5); spans = sorted(distance(f, 2, 5) for f in driver)
    if target_span < 8 or min(spans) < 8:
        raise ValueError('Shoulder span is too small.')
    middle = len(spans) // 2; scale_span = spans[middle] if len(spans) % 2 else (spans[middle - 1] + spans[middle]) / 2
    edges = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7)]
    if framing == 'full':
        edges += [(1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13)]
    elif framing != 'upper':
        raise ValueError('Unsupported framing.')
    present = {1, *(b for _, b in edges)}
    for a, b in [(1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]:
        if a in present and all(frame[a] is not None and frame[b] is not None for frame in [target, *driver]):
            try:
                for frame in [target, *driver]: distance(frame, a, b)
            except ValueError:
                continue
            edges.append((a, b)); present.add(b)
    measured = []
    for a, b in edges:
        length = distance(target, a, b)
        measured.append({'from': a, 'to': b, 'targetPixels': length, 'relativeToShoulders': length / target_span, 'driverPixels': length / target_span * scale_span})
    info = meta['retarget']
    if len(info['lengths']) != len(measured) or info['rootJoint'] != 1 or not math.isclose(info['targetShoulderPixels'], target_span, abs_tol=1e-8) or not math.isclose(info['driverMedianShoulderPixels'], scale_span, abs_tol=1e-8):
        raise ValueError('Target-proportion measurements changed.')
    for saved, actual in zip(info['lengths'], measured):
        if saved['from'] != actual['from'] or saved['to'] != actual['to'] or any(not math.isclose(saved[k], actual[k], abs_tol=1e-8) for k in ('targetPixels', 'relativeToShoulders', 'driverPixels')):
            raise ValueError('Saved target bone lengths changed.')
    reconstructed = []
    for frame in driver:
        pose = [None] * 18; pose[1] = frame[1][:]
        for edge in measured:
            a, b = edge['from'], edge['to']; length = distance(frame, a, b)
            pose[b] = [pose[a][j] + (frame[b][j] - frame[a][j]) / length * edge['driverPixels'] for j in range(2)]
        reconstructed.append(pose)
    visible = [p for frame in reconstructed for p in frame if p is not None]
    low = [min(p[j] for p in visible) for j in range(2)]; high = [max(p[j] for p in visible) for j in range(2)]
    if min(high[j] - low[j] for j in range(2)) < 5:
        raise ValueError('Retargeted guide is too small or flat.')
    scale = min(size[j] * .84 / (high[j] - low[j]) for j in range(2)); center = [(high[j] + low[j]) / 2 for j in range(2)]
    fit = meta['fit']
    if not math.isclose(fit['scale'], scale, abs_tol=1e-8) or any(not math.isclose(fit['sourcePixelCenter'][j], center[j], abs_tol=1e-8) or not math.isclose(fit['targetPixelCenter'][j], size[j] / 2, abs_tol=1e-8) for j in range(2)) or fit['margin'] != .08:
        raise ValueError('The guide must use one fixed whole-clip fit.')
    result = [[None if p is None else [((p[j] - center[j]) * scale + size[j] / 2) / size[j] for j in range(2)] for p in frame] for frame in reconstructed]
    if len(meta['points']) != len(result):
        raise ValueError('Saved retarget frame count changed.')
    for saved_frame, frame in zip(meta['points'], result):
        if len(saved_frame) != 18:
            raise ValueError('Saved retarget joint count changed.')
        for saved, p in zip(saved_frame, frame):
            if (saved is None) != (p is None) or p is not None and (len(saved) != 2 or any(not math.isclose(saved[j], p[j], abs_tol=1e-8) for j in range(2))):
                raise ValueError('Saved retarget points do not match independent reconstruction.')
    return result
