/**
 * Figma MegiCoreAI node 238:6439 — `bg-bottom`
 * Design canvas: 1920×348
 * Layers: Ellipse 13/14/15 + Vector 10/11 (cyan→navy atmospheric glow)
 */
const ASSET = "/brand/magicore/home";
const V = "1";

type MagiCoreBgBottomProps = {
  className?: string;
};

export function MagiCoreBgBottom({ className = "" }: MagiCoreBgBottomProps) {
  return (
    <div
      aria-hidden
      data-node-id="238:6439"
      data-name="bg-bottom"
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[220px] overflow-hidden bg-[#0a0a0a] sm:h-[280px] lg:h-[348px] ${className}`}
    >
      {/* Fixed design-space plate, centered & clipped */}
      <div className="absolute bottom-0 left-1/2 h-[348px] w-[1920px] max-w-none -translate-x-1/2 overflow-hidden">
        {/* Ellipse 13 — right bloom */}
        <div className="absolute left-[654px] top-[253px] h-[1246px] w-[1366px]">
          <div className="absolute inset-[-24.08%_-21.96%]">
            <img
              src={`${ASSET}/bg-bottom-e13.svg?v=${V}`}
              alt=""
              className="block size-full max-w-none select-none"
              draggable={false}
            />
          </div>
        </div>

        {/* Ellipse 14 — rotated mid glow */}
        <div className="absolute left-[-434.81px] top-[170.64px] flex h-[916.592px] w-[1407.837px] items-center justify-center">
          <div className="relative h-[689.744px] w-[1303.657px] rotate-[10.54deg]">
            <div className="absolute inset-[-57.99%_-30.68%]">
              <img
                src={`${ASSET}/bg-bottom-e14.svg?v=${V}`}
                alt=""
                className="block size-full max-w-none select-none"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* Vector 11 */}
        <div className="absolute left-[-335.73px] top-[77.19px] h-[773.591px] w-[1173.163px]">
          <div className="absolute inset-[-25.85%_-17.05%]">
            <img
              src={`${ASSET}/bg-bottom-v11.svg?v=${V}`}
              alt=""
              className="block size-full max-w-none select-none"
              draggable={false}
            />
          </div>
        </div>

        {/* Vector 10 */}
        <div className="absolute left-[-95.5px] top-[488.04px] h-[637.616px] w-[1861.096px]">
          <div className="absolute inset-[-31.37%_-10.75%]">
            <img
              src={`${ASSET}/bg-bottom-v10.svg?v=${V}`}
              alt=""
              className="block size-full max-w-none select-none"
              draggable={false}
            />
          </div>
        </div>

        {/* Ellipse 15 — left cyan bloom */}
        <div className="absolute left-[-319px] top-[-89px] h-[530px] w-[591px]">
          <div className="absolute inset-[-56.6%_-50.76%]">
            <img
              src={`${ASSET}/bg-bottom-e15.svg?v=${V}`}
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
