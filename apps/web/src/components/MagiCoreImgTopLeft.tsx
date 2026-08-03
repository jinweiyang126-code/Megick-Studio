/**
 * Figma MegiCoreAI node 238:7490 — `img-top left`
 * Design frame: 519×354 with clipped Ellipse 8 glow (rotated / skewed)
 */
const ASSET = "/brand/magicore/home";
const V = "2";

type MagiCoreImgTopLeftProps = {
  className?: string;
};

export function MagiCoreImgTopLeft({ className = "" }: MagiCoreImgTopLeftProps) {
  return (
    <div
      aria-hidden
      data-node-id="238:7490"
      data-name="img-top left"
      className={`pointer-events-none absolute left-0 top-0 z-[1] h-[220px] w-[320px] overflow-hidden sm:h-[280px] sm:w-[420px] lg:h-[354px] lg:w-[519px] ${className}`}
    >
      {/* Ellipse 8 — Figma transform plate */}
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
  );
}
