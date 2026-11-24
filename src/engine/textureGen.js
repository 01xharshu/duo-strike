import * as THREE from 'three';

function createCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

export function createRealisticTextures() {
  const { canvas: cFort, ctx: ctxFort } = createCanvas(512);
  ctxFort.fillStyle = '#C8A97E';
  ctxFort.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    ctxFort.fillStyle = Math.random() > 0.5 ? 'rgba(255,245,220,0.08)' : 'rgba(60,40,20,0.1)';
    ctxFort.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  ctxFort.strokeStyle = 'rgba(55, 38, 22, 0.45)';
  ctxFort.lineWidth = 4;
  for (let y = 0; y < 512; y += 64) {
    ctxFort.beginPath();
    ctxFort.moveTo(0, y);
    ctxFort.lineTo(512, y);
    ctxFort.stroke();
    const offset = (y / 64) % 2 === 0 ? 0 : 64;
    for (let x = offset; x < 512; x += 128) {
      ctxFort.beginPath();
      ctxFort.moveTo(x, y);
      ctxFort.lineTo(x, y + 64);
      ctxFort.stroke();
    }
  }
  const fortStoneMap = new THREE.CanvasTexture(cFort);
  fortStoneMap.wrapS = fortStoneMap.wrapT = THREE.RepeatWrapping;
  fortStoneMap.colorSpace = THREE.SRGBColorSpace;

  const { canvas: cPort, ctx: ctxPort } = createCanvas(512);
  ctxPort.fillStyle = '#DCE6EE';
  ctxPort.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 24) {
    ctxPort.fillStyle = x % 48 === 0 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.16)';
    ctxPort.fillRect(x, 0, 12, 512);
  }
  ctxPort.strokeStyle = '#1E2A32';
  ctxPort.lineWidth = 10;
  ctxPort.strokeRect(5, 5, 502, 502);
  ctxPort.fillStyle = '#FFC800';
  ctxPort.fillRect(10, 464, 492, 36);
  const containerMap = new THREE.CanvasTexture(cPort);
  containerMap.wrapS = containerMap.wrapT = THREE.RepeatWrapping;
  containerMap.colorSpace = THREE.SRGBColorSpace;

  const { canvas: cRock, ctx: ctxRock } = createCanvas(512);
  ctxRock.fillStyle = '#757E88';
  ctxRock.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    ctxRock.fillStyle = Math.random() > 0.5 ? 'rgba(235,242,250,0.09)' : 'rgba(22,28,34,0.16)';
    ctxRock.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
  }
  ctxRock.strokeStyle = 'rgba(25, 30, 36, 0.38)';
  ctxRock.lineWidth = 3;
  for (let i = 0; i < 28; i++) {
    ctxRock.beginPath();
    ctxRock.moveTo(Math.random() * 512, Math.random() * 512);
    ctxRock.lineTo(Math.random() * 512, Math.random() * 512);
    ctxRock.stroke();
  }
  const mountainRockMap = new THREE.CanvasTexture(cRock);
  mountainRockMap.wrapS = mountainRockMap.wrapT = THREE.RepeatWrapping;
  mountainRockMap.colorSpace = THREE.SRGBColorSpace;

  const { canvas: cMetal, ctx: ctxMetal } = createCanvas(256);
  ctxMetal.fillStyle = '#323E48';
  ctxMetal.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    ctxMetal.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
    ctxMetal.fillRect(0, y, 256, 1);
  }
  const metalMap = new THREE.CanvasTexture(cMetal);
  metalMap.wrapS = metalMap.wrapT = THREE.RepeatWrapping;
  metalMap.colorSpace = THREE.SRGBColorSpace;

  const { canvas: cFloor, ctx: ctxFloor } = createCanvas(512);
  ctxFloor.fillStyle = '#528A44';
  ctxFloor.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    ctxFloor.fillStyle = Math.random() > 0.5 ? 'rgba(88,204,2,0.16)' : 'rgba(30,55,25,0.18)';
    ctxFloor.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  const groundMap = new THREE.CanvasTexture(cFloor);
  groundMap.wrapS = groundMap.wrapT = THREE.RepeatWrapping;
  groundMap.repeat.set(48, 48);
  groundMap.colorSpace = THREE.SRGBColorSpace;

  const { canvas: cRoad, ctx: ctxRoad } = createCanvas(256);
  ctxRoad.fillStyle = '#4B5560';
  ctxRoad.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    ctxRoad.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    ctxRoad.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctxRoad.strokeStyle = 'rgba(255, 200, 0, 0.52)';
  ctxRoad.lineWidth = 4;
  ctxRoad.strokeRect(2, 2, 252, 252);
  const roadMap = new THREE.CanvasTexture(cRoad);
  roadMap.wrapS = roadMap.wrapT = THREE.RepeatWrapping;
  roadMap.repeat.set(22, 22);
  roadMap.colorSpace = THREE.SRGBColorSpace;

  return { fortStoneMap, containerMap, mountainRockMap, metalMap, groundMap, roadMap };
}
