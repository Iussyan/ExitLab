# ExitLab — Plan Import & Geometry Verification

## Accepted P0 input
PNG, JPG/JPEG, PDF page(s). PDF can contain raster or vectors, but MVP may first render the selected page to an image with PDF.js. Do not promise precise reconstruction of arbitrary plans.

## User workflow
1. Upload file (size/type limits, clear error feedback; reject executable content disguised as images).
2. Select floor/page and orient crop/rotate; show source preview.
3. Set scale: user identifies two points with a **known real-world distance**. Display calculation and units; do not guess meters from pixel count.
4. Extract tentative walls/room regions/doors/exits via ordinary image processing and optionally Meta vision tools. Use confidence only as a review hint, not proof.
5. Show a **draft overlay** on top of plan. User can drag, remove, split, merge, and add elements; specifically confirm exits and door openings.
6. Validate connectivity and all geometry constraints. Flag missing dimensions, ambiguous walls, overlapping polygons, detached doors, inaccessible rooms.
7. User explicitly confirms geometry and scale; create canonical `Building` with provenance, then allow simulation and 3D cutaway.

## Key distinction
- PDF or photo => usually 2D drawing; generated 3D is **approximate extrusion**, with user-set wall height and no inferred structural truth.
- SVG/DXF => possible 2D vector geometry in later phase.
- IFC => structured building model, later phase; still requires movement/connectivity extraction and verification.
- DWG, RVT, SKP native formats are **not** supported directly in P0.

## Rendering rules
Convert line segments to walls with door cutouts and flat floors in Three.js/R3F. A door is a hole/opening in correct wall, not a glowing icon over an impassable mesh. 2D/3D/simulation consume the *same validated model*. Avoid independently generated AI 3D images masquerading as simulation geometry.

## Failure / fallback
If extraction fails, do not block the whole product: preserve uploaded image as background and let user trace geometry manually. For demo include one prepared, fully reviewed JSON fixture so the core stress-testing loop never depends on OCR/vision accuracy.

## Security and rights
Limit upload size/pages, process files safely, and avoid exposing sensitive real facility plans publicly. Use synthetic/self-owned/licensed demo plans and track attribution.
