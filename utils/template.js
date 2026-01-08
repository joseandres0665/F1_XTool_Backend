// test.js
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const TextToSVG = require('text-to-svg');
const { JSDOM } = require('jsdom');
const screenshot = require('screenshot-desktop');
const Jimp = require("jimp");

// —— POLYFILL DOM FOR PAPER.JS ——
const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
global.window        = dom.window;
global.document      = dom.window.document;
global.DOMParser     = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;
global.Node          = dom.window.Node;
global.navigator     = { userAgent: 'node.js' };

const paper = require('paper');

// —— CONFIG ——
// const OUTPUT   = path.join(__dirname, 'coke.svg');
// const TEXT     = 'Mohammed';
// const W        = 700;
// const H        = 200;
// const FONTSIZE = 120;
const FILL_TTF = path.join(__dirname, '../fonts/CokeR.ttf');
const OUT_TTF  = path.join(__dirname, '../fonts/CokeOutline.ttf');
// ——————————


const { 
  runWindowsScriptForName, 
  runWindowsScriptForPreAction,
  runWindowsScriptForClosePrinting
} = require('./appleScript');
const { readFontSettings } = require('./settings');

async function renderTextWithScreenshot(TEXT, FONTSIZE, W, H, OUTPUT) {
   // load fonts
  const fillT2S    = TextToSVG.loadSync(FILL_TTF);
  const outlineT2S = TextToSVG.loadSync(OUT_TTF);

  // get raw path data
  const opts = { x: 20, y: FONTSIZE, fontSize: FONTSIZE };
  const dFill    = fillT2S.getD(TEXT, opts);
  const dOutline = outlineT2S.getD(TEXT, opts);

  // paper setup
  const canvas = createCanvas(W, H);
  paper.setup(canvas);

  // import each as a Group with a single <path>
  const grpOut = paper.project.importSVG(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${dOutline}"/></svg>`
  );
  const grpFill = paper.project.importSVG(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${dFill}"/></svg>`
  );

  // extract the actual Path item
  const outlinePath = grpOut.children[0];
  const fillPath    = grpFill.children[0];

  // do the subtraction
  const result = outlinePath.subtract(fillPath);

  // grab the combined "d"
  const finalD = result.pathData;

  // write single-path SVG
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <path
    d="${finalD}"
    fill="#000000"
    stroke="#000"
    stroke-width="0"
    fill-rule="evenodd"
  />
</svg>
`;
  fs.writeFileSync(OUTPUT, svg, 'utf8');
  console.log(`✅ Written single-path SVG to ${OUTPUT}`);

  return OUTPUT;
}

async function generateTemplatePNG(name, isFirstPrinting) {
  try {
    const settings = readFontSettings();
    const fontSize = parseInt(settings.fontSize);
    const fontFamily = settings.fontFamily;
    const originX = parseInt(settings.x);
    const originY = parseInt(settings.y);
    const margin = 50;

    
    // Temporary canvas to measure text
    const tempCanvas = createCanvas(1, 1);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `${fontSize}px "${fontFamily}"`;
    
    const textMetrics = tempCtx.measureText(name);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2; // approximate height with line spacing
    
    const canvasWidth = Math.ceil(textWidth + margin * 2);
    const canvasHeight = Math.ceil(textHeight + margin * 2);

    const outputDir = path.join(process.cwd(), 'output'); // or /tmp
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    
    //const real_filename = await renderTextWithScreenshot(fontPath, fontOutlinePath, outputDir, fontSize, canvasWidth, canvasHeight, name);
    const OUTPUT   = path.join(outputDir, `${name}.svg`);
    const real_filename = await renderTextWithScreenshot(name, fontSize, canvasWidth, canvasHeight, OUTPUT);

    await runWindowsScriptForPreAction();

    screenshot().then(async (img) => {
      const image = await Jimp.Jimp.read(img);
    
      // Pick pixel at (100, 200)
      const color = image.getPixelColor(1500 * 2, 150 * 2);
      const rgba = Jimp.intToRGBA(color);
      console.log(rgba);

      if(rgba.r === 92 && rgba.g === 186 && rgba.b === 84) {
        await runWindowsScriptForClosePrinting();
        console.log('runWindowsScriptForClosePrinting');
      }
      console.log('runWindowsScriptForName');
      
      runWindowsScriptForName(`${name}.svg`, name, isFirstPrinting)
        .then(output => console.log("Success:", output))
        .catch(err => console.error("Error:", err));
    });

  } catch (error) {
    console.log(error);
  }
  return "";
}

module.exports = { generateTemplatePNG };