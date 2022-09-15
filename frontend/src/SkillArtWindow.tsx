import React, {
  useRef, useState, useMemo,
} from 'react';
import { useGesture } from '@use-gesture/react';
import { useInterval } from 'usehooks-ts';
import { TerminalWindowProps } from './TerminalWindowProps';
import { DrawFill } from './DrawFill';
import { TerminalWindow } from './TerminalWindow';
// import { useImgElement } from './useImgElement';
import { CustomCursorHover } from './CustomCursor';
import { TerminalWindowButton } from './TerminalWindowButton';
import { SceneName } from './SceneController';
import { SlideName } from './SlideName';
import { contactHref } from './contactHref';
import { useBreakpoints } from './useBreakpoints';
import { aboutContent } from './aboutContent';
// import { useImgElement } from './useImgElement';

const { skills } = aboutContent;

const resolutionMultiplier = 2.0;

const DEBUG_DRAWFILLS = false;

const drawFatLinePath = (
  ctx:CanvasRenderingContext2D,
  [x1, y1]:[number, number],
  [x2, y2]:[number, number],
  stroke:number,
) => {
  // The angle between our points
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Start on a point tangential to circle1
  ctx.moveTo(
    x1 + Math.cos(angle + Math.PI / 2) * stroke,
    y1 + Math.sin(angle + Math.PI / 2) * stroke,
  );
  // Arc 180 deg to other side of c1
  ctx.arc(x1, y1, stroke, angle + Math.PI / 2, angle - Math.PI / 2);
  // Line to corresponding point on c2
  ctx.lineTo(
    x2 + Math.cos(angle - Math.PI / 2) * stroke,
    y2 + Math.sin(angle - Math.PI / 2) * stroke,
  );
  // Arc 180 to other side of c2
  ctx.arc(x2, y2, stroke, angle - Math.PI / 2, angle + Math.PI / 2);

  // Closing the path takes us back to our first point
};

export const DrawToRevealCanvas = ({ drawFill, onDraw = () => {} }:{
  drawFill:DrawFill;
  onDraw:() => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);

  const gestureProps = useGesture(
    {
      // @ts-ignore
      onDrag: ({ xy, delta }) => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) throw new Error('no ctx');
        const [x, y] = xy;
        const [prevX, prevY] = [x - delta[0], y - delta[1]];
        const stroke = Math.max(canvasRef.current.width / 10, canvasRef.current.height / 10);
        const { width, height } = canvasRef.current;

        ctx.save();
        ctx.beginPath();
        drawFatLinePath(ctx, [prevX, prevY], [x, y], stroke);
        ctx.clip();
        drawFill(ctx, width, height);
        ctx.restore();

        onDraw();
      },
    },
    {
      transform: ([x, y]) => {
        if (!canvasRef.current) return [x, y];
        const boundingRect = canvasRef.current.getBoundingClientRect();
        return [(x - boundingRect.left) * resolutionMultiplier,
          (y - boundingRect.top) * resolutionMultiplier];
      },
    },
  );

  // Update canvas resolution if dimensions change
  useInterval(() => {
    if (!canvasRef.current) return;
    if (canvasRef.current.width !== canvasRef.current.offsetWidth * resolutionMultiplier
      || canvasRef.current.height !== canvasRef.current.offsetHeight * resolutionMultiplier) {
      canvasRef.current.width = canvasRef.current.offsetWidth * resolutionMultiplier;
      canvasRef.current.height = canvasRef.current.offsetHeight * resolutionMultiplier;
    }

    // Debug drawfill
    if (DEBUG_DRAWFILLS) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) throw new Error('no ctx');
      const { width, height } = canvasRef.current;
      drawFill(ctx, width, height);
    }
  }, 200);

  return (
    <CustomCursorHover cursor="paint">
      <canvas
        ref={canvasRef}
        {...gestureProps()}
        className="top-0 left-0 w-full h-full top left touch-none"
      />
    </CustomCursorHover>
  );
};

type MultilineTextOptions = {
  font?: string;
  stroke?: boolean;
  verbose?: boolean;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lineHeight?: number;
  minFontSize?: number;
  maxFontSize?: number;
  logFunction?: (_text:string) => void;
  centerY?: boolean;
  centerX?: boolean;
  nbsp?: string;
  br?: string;
}

// Forked and heavily edited from https://gitlab.com/davideblasutto/canvas-multiline-text/-/blob/master/index.js
type Line = {
  text: string;
  x: number;
  y: number;
}
function multilineText(
  ctx:CanvasRenderingContext2D,
  text:string,
  providedOpts:MultilineTextOptions = {},
) {
  // Default options
  const opts = {
    font: 'sans-serif',
    stroke: false,
    verbose: false,
    rect: {
      x: 0,
      y: 0,
      width: ctx.canvas.width,
      height: ctx.canvas.height,
    },
    lineHeight: 1.1,
    minFontSize: 20,
    maxFontSize: 100,
    logFunction: console.log,
    centerY: false,
    centerX: false,
    nbsp: '&nbsp;',
    br: '\n',
    ...providedOpts,
  };
  if (!providedOpts.font) { opts.font = 'sans-serif'; }
  if (typeof providedOpts.stroke === 'undefined') { opts.stroke = false; }
  if (typeof opts.verbose === 'undefined') { opts.verbose = false; }
  if (!opts.rect) {
    opts.rect = {
      x: 0,
      y: 0,
      width: ctx.canvas.width,
      height: ctx.canvas.height,
    };
  }

  const words = text.split(' ')
    .map((word) => word.trim().replaceAll(' ', '')
      .replaceAll(opts.nbsp, ' '))
    .filter((word) => word !== '');
  if (opts.verbose) opts.logFunction(`Text contains ${words.length} words`);

  let x = opts.rect.x + (opts.centerX ? opts.rect.width / 2 : 0);
  let y = opts.rect.y + opts.minFontSize; // It's the bottom line of the letters
  let lines:Line[] = [];

  ctx.textBaseline = 'alphabetic';

  let fontSize:number;
  // Finds max font size  which can be used to print whole text in opts.rec
  for (fontSize = opts.minFontSize; fontSize <= opts.maxFontSize; fontSize += 1) {
    // Line height
    const lineHeight = fontSize * opts.lineHeight;

    // Set font for testing with measureText()
    ctx.font = ` ${fontSize}px ${opts.font}`;

    // Start
    x = opts.rect.x + (opts.centerX ? opts.rect.width / 2 : 0);
    y = opts.rect.y + lineHeight; // It's the bottom line of the letters
    const testLines:Line[] = [];
    let line = '';

    let aWordWasTooBig = false;
    // Cycles on words
    // eslint-disable-next-line no-restricted-syntax
    for (const word of words) {
      // Add next word to line
      const linePlus = `${line + word} `;
      if (ctx.measureText(word).width > (opts.rect.width)) aWordWasTooBig = true;

      // If added word exceeds rect width...
      if (ctx.measureText(linePlus).width > (opts.rect.width) || word === opts.br) {
        // ..."prints" (save) the line without last word
        testLines.push({ text: line, x, y });
        // New line with ctx last word
        line = `${word} `;
        y += lineHeight;
      } else {
        // ...continues appending words
        line = linePlus;
      }
    }
    if (aWordWasTooBig) break;

    // "Print" (save) last line
    testLines.push({ text: line, x, y });

    // If bottom of rect is reached then breaks "fontSize" cycle
    if (y > opts.rect.height + opts.rect.y) { break; }

    // Otherwise saves lines
    lines = testLines;
  }

  if (!lines.length) {
    throw new Error('Could not draw with those constraints!');
  }

  if (opts.verbose) opts.logFunction(`Font used: ${ctx.font}`);

  if (opts.centerX) {
    ctx.textAlign = 'center';
  }

  // Print lines
  // eslint-disable-next-line no-restricted-syntax
  for (const line of lines) {
    if (opts.centerY) {
      const leftOverY = opts.rect.y
        + opts.rect.height
        - lines[lines.length - 1].y
        - (fontSize * opts.lineHeight) / 2;
      line.y += leftOverY / 2;
    }
    if (opts.stroke) {
      ctx.strokeText(line.text.trim(), line.x, line.y);
    } else {
      ctx.fillText(line.text.trim(), line.x, line.y);
    }
  }

  // Returns font size
  return fontSize;
}

const useAddDrawFill = (
  drawFills:[DrawFill, string][],
  text:string,
  bgColor:string,
  textColor:string,
  breakpoint:boolean,
) => {
  const rotationAmountStable = useMemo(() => Math.random(), []);
  const displaceXAmountStable = useMemo(() => Math.random(), []);
  const displaceYAmountStable = useMemo(() => Math.random(), []);

  drawFills.push([(ctx, w, h) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const paddingX = breakpoint ? w * 0.15 : w * 0.15;
    const paddingTop = breakpoint ? w * 0.12 : h * 0.2;
    const paddingBottom = breakpoint ? w * 0.08 : h * 0.25;

    const areaW = w - paddingX * 2;
    const areaH = h - paddingTop - paddingBottom;

    let rotationAmount = rotationAmountStable;
    let displaceXAmount = displaceXAmountStable;
    let displaceYAmount = displaceYAmountStable;

    if (DEBUG_DRAWFILLS) {
      rotationAmount = Math.random();
      displaceXAmount = Math.random();
      displaceYAmount = Math.random();

      const rotation1 = ((-5) / 360) * Math.PI * 2;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rotation1);
      ctx.translate(-w / 2, -h / 2);

      ctx.fillStyle = 'black';
      ctx.rect(
        paddingX,
        paddingTop,
        areaW,
        areaH,
      );
      ctx.fill();

      ctx.resetTransform();
    }

    const rotation = ((-5 + 2 * (rotationAmount * 2 - 1)) / 360) * Math.PI * 2;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rotation);
    ctx.translate(-w / 2, -h / 2);

    ctx.fillStyle = textColor;
    multilineText(ctx, text, {
      rect: {
        x: paddingX + 10 * (displaceXAmount * 2 - 1),
        y: paddingTop + 10 * (displaceYAmount * 2 - 1),
        width: areaW,
        height: areaH,
      },
      font: 'Roboto Mono',
      maxFontSize: 500,
      centerX: true,
      centerY: true,
      br: '<br>', // Fake br
      nbsp: '&nbsp;', // Fake br
    });

    ctx.resetTransform();
  }, bgColor]);
};

export const SkillArtWindow = ({
  setScene, setSlide,
  ...terminalWindowProps
}: {
  setScene:(_scene:SceneName) => void,
  setSlide:(_slide:SlideName) => void,
} & Omit<TerminalWindowProps, 'children'>) => {
  const drawFills:[DrawFill, string][] = [];
  const [colorsUsed, setColorsUsed] = useState<Set<number>>(new Set());

  const breakpoints = useBreakpoints();
  const breakpoint = breakpoints.about;

  useAddDrawFill(
    drawFills,
    skills[0],
    'red',
    'white',
    breakpoint,
  );
  useAddDrawFill(
    drawFills,
    skills[1],
    'violet',
    'black',
    breakpoint,
  );
  useAddDrawFill(
    drawFills,
    skills[2],
    'orange',
    'black',
    breakpoint,
  );
  useAddDrawFill(
    drawFills,
    skills[3],
    'yellow',
    'black',
    breakpoint,
  );
  useAddDrawFill(
    drawFills,
    skills[4],
    'lime',
    'black',
    breakpoint,
  );
  useAddDrawFill(
    drawFills,
    skills[5],
    'blue',
    'white',
    breakpoint,
  );

  const [currentFill, setCurrentFill] = useState(0);

  const [showInstructions, setShowInstructions] = useState(true);
  const [showCta, setShowCta] = useState(false);

  return (
    <>
      <TerminalWindow
        {...terminalWindowProps}
        draggableByTitleBarOnly
        noCloseButton
      >

        <div
          className="absolute top-0 left-0 grid w-full h-full overflow-hidden place-items-center"
        >
          <div
            className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%]
            rotate-[5deg] touch-none"
          >
            <DrawToRevealCanvas
              drawFill={drawFills[currentFill][0]}
              onDraw={() => {
                if (showInstructions) setShowInstructions(false);
                if (!colorsUsed.has(currentFill)) {
                  setColorsUsed((currentSet) => new Set([...currentSet, currentFill]));
                  if (colorsUsed.size > 0) {
                    setShowCta(true);
                  }
                }
              }}
            />
          </div>
          {showInstructions && (
          <div className="font-display text-center text-[4em] leading-[1] uppercase text-[#ccc] translate-y-[-10%] pointer-events-none p-[0.2em] max-w-[8em]">
            Draw on me
            {breakpoint ? <br /> : ' '}
            in every color
          </div>
          )}
          <div className="absolute top-0 left-0 flex">
            {drawFills.map(
              ([_drawFill, color], index) => (
                <button
                  key={color}
                  onClick={() => setCurrentFill(index)}
                  type="button"
                  className={`grid place-items-center  border-black w-[3em] h-[3em]
                  ${currentFill === index ? 'border-[0.5em]' : 'border-2'}
                `}
                  style={{
                    backgroundColor: color,
                  }}
                  aria-label={color}
                />
              ),
            )}

          </div>
        </div>
      </TerminalWindow>
      {showCta && (
      <TerminalWindow
        title={null}
        className={`
          justify-self-end
          ${breakpoint
          ? 'mt-[-1em] mr-[-1em]'
          : 'mt-[-10em] mr-[4em] self-end'}
        `}
      >
        <nav
          className={`
            p-[0.75em] flex gap-[0.75em]
            ${breakpoint ? 'items-end h-full' : 'flex-col items-center'}
          `}
        >
          <TerminalWindowButton
            key="art-board"
            color="black"
            bgColor="yellow"
            onClick={() => {
              setScene('menu');
              setSlide('intro');
            }}
          >
            BACK_TO_MENU
          </TerminalWindowButton>
          <TerminalWindowButton
            key="back-to-menu-and-contact"
            bgColor="yellow"
            href={contactHref}
          >
            CONTACT_ME
          </TerminalWindowButton>
        </nav>
      </TerminalWindow>
      )}
    </>
  );
};
