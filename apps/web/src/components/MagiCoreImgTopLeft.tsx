/**
 * Figma MegiCoreAI node 238:7490 — `img-top left`
 * Plate 519×354, clipsContent + Ellipse 8 LAYER_BLUR(200). No frame fill.
 * Soft-mask the clip so the bloom doesn't read as a hard grey rectangle on #0a0a0a.
 * @see https://www.figma.com/design/A8pVy0Wd7vLufWQdKqu9wB/MegiCoreAI?node-id=238-7490
 */
const ASSET = "/brand/magicore/home";
const V = "4";

type MagiCoreImgTopLeftProps = {
  className?: string;
};

export function MagiCoreImgTopLeft({ className = "" }: MagiCoreImgTopLeftProps) {
  return (
    <div
      aria-hidden
      data-node-id="238:7490"
      data-name="img-top left"
      className={`pointer-events-none absolute left-0 top-0 z-[1] aspect-[519/354] w-[27.03%] overflow-hidden mix-blend-screen ${className}`}
      style={{
        // Fade clip edges — hard overflow:hidden on a blurred SVG looks like a solid box.
        WebkitMaskImage:
          "radial-gradient(ellipse 85% 80% at 35% 45%, #000 35%, transparent 72%)",
        maskImage:
          "radial-gradient(ellipse 85% 80% at 35% 45%, #000 35%, transparent 72%)",
      }}
    >
      <div className="relative size-full [container-type:size]">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: 519,
            height: 354,
            transform: "scale(calc(100cqw / 519))",
          }}
        >
          {/* Ellipse 8 — Figma transform plate (238:7488) */}
          <div className="absolute left-[-192px] top-[-226.36px] flex h-[1161.642px] w-[1685.586px] items-center justify-center">
            <div
              className="relative h-[1117.853px] w-[1077.188px] shrink-0"
              style={{
                transform: "rotate(-13deg) skewX(21.68deg) scaleY(-0.93)",
              }}
            >
              <div className="absolute inset-[-17.89%_-18.57%]">
                <img
                  src={`${ASSET}/img-top-left-ellipse.svg?v=${V}`}
                  alt=""
                  className="block size-full max-w-none select-none"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
