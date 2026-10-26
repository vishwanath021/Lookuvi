/**
 * FaceMesh index groups for this studio.
 * Indices follow the public 478-point topology. The rings are ordered for our masks.
 * Person's right is on the viewer's left in an unmirrored photo.
 */

/** Silhouette from the forehead, around the person's left cheek, under the chin, and back. */
export const SKIN_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;

/** Width of the face, cheek edge to cheek edge. */
export const FACE_EDGE_RIGHT = 234;
export const FACE_EDGE_LEFT = 454;

export const CHEEK_RIGHT = 50;
export const CHEEK_LEFT = 280;
export const NOSE_TIP = 4;
export const NOSE_BRIDGE = 6;
export const FOREHEAD = 10;
export const CHIN = 152;

/** Outer lip, person's right corner, across the top, around the left, and back under. */
export const LIP_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146] as const;
/** Inner lip, same direction, so the mouth opening can be cut out. */
export const LIP_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95] as const;
export const LIP_LOWER = 14;

/** Lid-to-brow band. Outer corner, along the upper lid, then back under the brow. */
export const SHADOW_RIGHT = [33, 246, 161, 160, 159, 158, 157, 173, 133, 55, 65, 52, 53, 46] as const;
export const SHADOW_LEFT = [263, 466, 388, 387, 386, 385, 384, 398, 362, 285, 295, 282, 283, 276] as const;

/** Eye opening used to keep foundation off the eyes and to paint a cut-crease lid. */
export const EYE_OPEN_RIGHT = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246] as const;
export const EYE_OPEN_LEFT = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466] as const;

export const LASH_UPPER_RIGHT = [33, 246, 161, 160, 159, 158, 157, 173, 133] as const;
export const LASH_UPPER_LEFT = [263, 466, 388, 387, 386, 385, 384, 398, 362] as const;
export const LASH_LOWER_RIGHT = [33, 7, 163, 144, 145, 153, 154, 155, 133] as const;
export const LASH_LOWER_LEFT = [263, 249, 390, 373, 374, 380, 381, 382, 362] as const;

/** Closed brow rings so foundation does not smear the brows. */
export const BROW_RIGHT = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46] as const;
export const BROW_LEFT = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276] as const;

export const REGION_RINGS = [
  SKIN_OVAL,
  LIP_OUTER,
  LIP_INNER,
  SHADOW_RIGHT,
  SHADOW_LEFT,
  EYE_OPEN_RIGHT,
  EYE_OPEN_LEFT,
  LASH_UPPER_RIGHT,
  LASH_UPPER_LEFT,
  BROW_RIGHT,
  BROW_LEFT,
] as const;
