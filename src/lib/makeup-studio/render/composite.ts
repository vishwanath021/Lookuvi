import { hexRgb, MATTE_VEIL } from "@/lib/makeup-studio/core/palette";
import type { MakeupLayers } from "@/lib/makeup-studio/render/layers";

/**
 * Canvas2D composite. Multiply, soft-light, and screen keep the photo's texture.
 * Used on its own when WebGL2 is missing, and as the backup blit when a shader fails.
 */
export function compositeCanvas(target: CanvasRenderingContext2D, layers: MakeupLayers) {
  const { width, height, recipe } = layers;
  target.clearRect(0, 0, width, height);
  target.globalAlpha = 1;
  target.globalCompositeOperation = "source-over";
  target.drawImage(layers.photo, 0, 0);

  if (recipe.coverage > 0.01) {
    const smooth = document.createElement("canvas");
    smooth.width = width;
    smooth.height = height;
    const smoothCtx = smooth.getContext("2d");
    if (smoothCtx) {
      smoothCtx.drawImage(layers.blurred, 0, 0);
      smoothCtx.globalCompositeOperation = "destination-in";
      smoothCtx.drawImage(layers.skin, 0, 0);
      target.globalAlpha = recipe.coverage;
      target.drawImage(smooth, 0, 0);
      target.globalAlpha = 1;
    }
  }

  if (recipe.matte > 0.01) {
    const veil = document.createElement("canvas");
    veil.width = width;
    veil.height = height;
    const veilCtx = veil.getContext("2d");
    if (veilCtx) {
      veilCtx.fillStyle = MATTE_VEIL;
      veilCtx.fillRect(0, 0, width, height);
      veilCtx.globalCompositeOperation = "destination-in";
      veilCtx.drawImage(layers.skin, 0, 0);
      target.globalCompositeOperation = "multiply";
      target.globalAlpha = recipe.matte;
      target.drawImage(veil, 0, 0);
      target.globalAlpha = 1;
      target.globalCompositeOperation = "source-over";
    }
  }

  target.globalCompositeOperation = "multiply";
  target.drawImage(layers.blush, 0, 0);
  target.drawImage(layers.eyes, 0, 0);

  const lip = document.createElement("canvas");
  lip.width = width;
  lip.height = height;
  const lipCtx = lip.getContext("2d");
  if (lipCtx) {
    lipCtx.drawImage(layers.lips, 0, 0);
    target.globalAlpha = recipe.lipMultiply;
    target.drawImage(lip, 0, 0);
    target.globalCompositeOperation = "soft-light";
    target.globalAlpha = recipe.lipSoft;
    target.drawImage(lip, 0, 0);
    target.globalAlpha = 1;
  }

  target.globalCompositeOperation = "screen";
  target.drawImage(layers.sheen, 0, 0);
  target.globalCompositeOperation = "source-over";
  target.drawImage(layers.detail, 0, 0);
  target.globalAlpha = 1;
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uPhoto;
uniform sampler2D uBlur;
uniform sampler2D uSkin;
uniform sampler2D uBlush;
uniform sampler2D uEyes;
uniform sampler2D uLips;
uniform sampler2D uSheen;
uniform sampler2D uDetail;
uniform float uCoverage;
uniform float uMatte;
uniform float uLipMul;
uniform float uLipSoft;
uniform vec3 uMatteColour;
in vec2 vUv;
out vec4 o;

vec3 screenBlend(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}
vec3 softBlend(vec3 base, vec3 blend) {
  return (1.0 - 2.0 * blend) * base * base + 2.0 * blend * base;
}

void main() {
  vec3 col = texture(uPhoto, vUv).rgb;
  float skin = texture(uSkin, vUv).a;
  vec3 blurred = texture(uBlur, vUv).rgb;
  col = mix(col, blurred, skin * uCoverage);
  col = mix(col, col * uMatteColour, skin * uMatte);
  vec4 blush = texture(uBlush, vUv);
  col = mix(col, col * blush.rgb, blush.a);
  vec4 eyes = texture(uEyes, vUv);
  col = mix(col, col * eyes.rgb, eyes.a);
  vec4 lip = texture(uLips, vUv);
  col = mix(col, col * lip.rgb, lip.a * uLipMul);
  col = mix(col, softBlend(col, lip.rgb), lip.a * uLipSoft);
  vec4 sheen = texture(uSheen, vUv);
  col = mix(col, screenBlend(col, sheen.rgb), sheen.a);
  vec4 detail = texture(uDetail, vUv);
  col = mix(col, detail.rgb, detail.a);
  o = vec4(col, 1.0);
}`;

type Program = {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  textures: WebGLTexture[];
};

const programs = new WeakMap<WebGL2RenderingContext, Program>();

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "compile";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function programFor(gl: WebGL2RenderingContext): Program {
  const cached = programs.get(gl);
  if (cached) return cached;
  const vert = compile(gl, gl.VERTEX_SHADER, VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!program) throw new Error("program");
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "link");
  }
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const textures: WebGLTexture[] = [];
  for (let i = 0; i < 8; i += 1) {
    const texture = gl.createTexture();
    if (!texture) throw new Error("texture");
    textures.push(texture);
  }
  const built = { program, buffer, textures };
  programs.set(gl, built);
  return built;
}

function bind(gl: WebGL2RenderingContext, texture: WebGLTexture, unit: number, source: HTMLCanvasElement) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/** WebGL2 composite of the same masks. Throws if the context cannot draw. */
export function compositeWebgl(gl: WebGL2RenderingContext, layers: MakeupLayers) {
  if (gl.isContextLost()) throw new Error("lost");
  const gpu = programFor(gl);
  const { recipe } = layers;
  gl.viewport(0, 0, layers.width, layers.height);
  gl.useProgram(gpu.program);
  const sources = [layers.photo, layers.blurred, layers.skin, layers.blush, layers.eyes, layers.lips, layers.sheen, layers.detail];
  const names = ["uPhoto", "uBlur", "uSkin", "uBlush", "uEyes", "uLips", "uSheen", "uDetail"];
  sources.forEach((source, index) => {
    bind(gl, gpu.textures[index], index, source);
    gl.uniform1i(gl.getUniformLocation(gpu.program, names[index]), index);
  });
  gl.uniform1f(gl.getUniformLocation(gpu.program, "uCoverage"), recipe.coverage);
  gl.uniform1f(gl.getUniformLocation(gpu.program, "uMatte"), recipe.matte);
  gl.uniform1f(gl.getUniformLocation(gpu.program, "uLipMul"), recipe.lipMultiply);
  gl.uniform1f(gl.getUniformLocation(gpu.program, "uLipSoft"), recipe.lipSoft);
  const matte = hexRgb(MATTE_VEIL);
  gl.uniform3f(gl.getUniformLocation(gpu.program, "uMatteColour"), matte[0], matte[1], matte[2]);
  gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  if (gl.getError() !== gl.NO_ERROR) throw new Error("gl");
}

export function blitCanvas(gl: WebGL2RenderingContext, source: HTMLCanvasElement) {
  const gpu = programFor(gl);
  const copy = gl.createTexture();
  if (!copy) return;
  gl.viewport(0, 0, source.width, source.height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, copy);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const pass = gl.createProgram();
  if (!pass) return;
  const vert = compile(gl, gl.VERTEX_SHADER, VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float;
uniform sampler2D uPhoto;
in vec2 vUv;
out vec4 o;
void main() { o = texture(uPhoto, vUv); }`);
  gl.attachShader(pass, vert);
  gl.attachShader(pass, frag);
  gl.bindAttribLocation(pass, 0, "aPos");
  gl.linkProgram(pass);
  gl.useProgram(pass);
  gl.uniform1i(gl.getUniformLocation(pass, "uPhoto"), 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.deleteProgram(pass);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  gl.deleteTexture(copy);
}
