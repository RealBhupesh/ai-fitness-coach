import * as THREE from "three";
import { POSE_CONNECTIONS } from "@/lib/pose/exercises";
import { angle, distance } from "@/lib/pose/math";
import type { Landmark, ExerciseId, FrameAnalysis } from "@/lib/pose/types";
export interface ThreeHUDState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  jointMeshes: Map<number, THREE.Mesh>;
  lineSegments: THREE.LineSegments;
  gridHelper: THREE.GridHelper;
  cage?: THREE.LineSegments;
  sparkGroups?: Map<number, THREE.Group>;
  initialized: boolean;
}

export function initThreeHUD(canvas: HTMLCanvasElement): ThreeHUDState {
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 360;
  const aspect = width / height;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
  camera.position.set(0, 0.2, 7.8);
  camera.lookAt(0, 0.2, -0.5);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const gridHelper = new THREE.GridHelper(14, 28, 0x06b6d4, 0x1e293b);
  gridHelper.position.y = -2.4;
  gridHelper.position.z = -1;
  gridHelper.rotation.x = Math.PI / 18;
  scene.add(gridHelper);

  // Futuristic Bounding cage wireframe cuboid enclosing the skeleton in 3D
  const cageGeo = new THREE.BoxGeometry(4.8, 5.8, 3.8);
  const cageEdges = new THREE.EdgesGeometry(cageGeo);
  const cageMat = new THREE.LineBasicMaterial({
    color: 0x0891b2,
    transparent: true,
    opacity: 0.35,
  });
  const cage = new THREE.LineSegments(cageEdges, cageMat);
  cage.position.set(0, 0.2, -0.5);
  scene.add(cage);

  const ambient = new THREE.AmbientLight(0xffffff, 0.95);
  scene.add(ambient);

  const jointMeshes = new Map<number, THREE.Mesh>();
  const jointsToRender = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

  const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);

  jointsToRender.forEach((idx) => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    jointMeshes.set(idx, mesh);
  });

  // Small orbiting electron-like glowing sparkles surrounding active limbs
  const sparkGroups = new Map<number, THREE.Group>();
  const sparkJoints = [13, 14, 15, 16, 25, 26]; // elbows, wrists, knees
  const sparkGeo = new THREE.SphereGeometry(0.035, 8, 8);

  sparkJoints.forEach((jointIdx) => {
    const group = new THREE.Group();
    scene.add(group);
    sparkGroups.set(jointIdx, group);

    for (let i = 0; i < 4; i++) {
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.85,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);

      const angle = (i / 4) * Math.PI * 2;
      const radius = 0.22 + Math.random() * 0.08;
      spark.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 0.1);
      group.add(spark);
    }
  });

  const boneMaterial = new THREE.LineBasicMaterial({
    color: 0x0891b2,
    transparent: true,
    opacity: 0.8,
  });

  const lineGeo = new THREE.BufferGeometry();
  const linePositions = new Float32Array(POSE_CONNECTIONS.length * 6);
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));

  const lineSegments = new THREE.LineSegments(lineGeo, boneMaterial);
  scene.add(lineSegments);

  return {
    scene,
    camera,
    renderer,
    jointMeshes,
    lineSegments,
    gridHelper,
    cage,
    sparkGroups,
    initialized: true,
  };
}

export function updateThreeHUD(
  threeState: ThreeHUDState | null,
  landmarks: Landmark[] | null,
  score: number,
  streakCount: number,
  mirror: boolean,
  exerciseId: ExerciseId,
  analysis?: FrameAnalysis
) {
  if (!threeState?.initialized || !landmarks?.length) return;

  const { scene, camera, renderer, jointMeshes, lineSegments, gridHelper, cage, sparkGroups } = threeState;

  const perfColor = score >= 88 ? 0x10b981 : score >= 72 ? 0xf59e0b : score >= 55 ? 0xf97316 : 0xf43f5e;
  const activeColor = streakCount >= 5 ? 0xd946ef : streakCount >= 3 ? 0x06b6d4 : perfColor;

  if (gridHelper && gridHelper.material) {
    (gridHelper.material as THREE.LineBasicMaterial).color.setHex(activeColor);
  }

  if (cage && cage.material) {
    (cage.material as THREE.LineBasicMaterial).color.setHex(activeColor);
  }

  const scaleX = 7.2;
  const scaleY = 7.2;
  const scaleZ = 5.0;

  jointMeshes.forEach((mesh, idx) => {
    const pt = landmarks[idx];
    if (pt && (pt.visibility ?? 0) > 0.4) {
      mesh.visible = true;
      const adjustedX = mirror ? (1.5 - pt.x - 1.0) : (pt.x - 0.5);
      mesh.position.x = adjustedX * scaleX;
      mesh.position.y = (0.5 - pt.y) * scaleY;
      mesh.position.z = -(pt.z ?? 0) * scaleZ;

      (mesh.material as THREE.MeshBasicMaterial).color.setHex(activeColor);
    } else {
      mesh.visible = false;
    }
  });

  if (sparkGroups) {
    sparkGroups.forEach((group, jointIdx) => {
      const parentMesh = jointMeshes.get(jointIdx);
      if (parentMesh && parentMesh.visible) {
        group.visible = true;
        group.position.copy(parentMesh.position);

        group.rotation.x += 0.025;
        group.rotation.y += 0.035;

        group.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            (child.material as THREE.MeshBasicMaterial).color.setHex(activeColor);
          }
        });
      } else {
        group.visible = false;
      }
    });
  }

  const posArr = lineSegments.geometry.attributes.position.array as Float32Array;
  let arrIdx = 0;

  for (const [a, b] of POSE_CONNECTIONS) {
    const startMesh = jointMeshes.get(a);
    const endMesh = jointMeshes.get(b);

    if (startMesh?.visible && endMesh?.visible) {
      posArr[arrIdx++] = startMesh.position.x;
      posArr[arrIdx++] = startMesh.position.y;
      posArr[arrIdx++] = startMesh.position.z;

      posArr[arrIdx++] = endMesh.position.x;
      posArr[arrIdx++] = endMesh.position.y;
      posArr[arrIdx++] = endMesh.position.z;
    } else {
      posArr[arrIdx++] = 0; posArr[arrIdx++] = 0; posArr[arrIdx++] = 0;
      posArr[arrIdx++] = 0; posArr[arrIdx++] = 0; posArr[arrIdx++] = 0;
    }
  }

  lineSegments.geometry.attributes.position.needsUpdate = true;
  (lineSegments.material as THREE.LineBasicMaterial).color.setHex(activeColor);

  // Dynamic Camera Orbit Sway: Orbit left and right by +/- 25 degrees, and sway pitch!
  // This produces a fully visible, beautiful 3D depth parallax where the floor grid,
  // coordinates cage, and skeleton rotate clearly inside the camera box.
  const time = Date.now() * 0.0006;
  const radius = 7.8;
  const angleRad = Math.sin(time * 0.8) * 0.45; // Orbit left and right
  camera.position.x = Math.sin(angleRad) * radius;
  camera.position.z = Math.cos(angleRad) * radius;
  camera.position.y = Math.cos(time * 0.4) * 0.35 + 0.2; // Pitch sway
  camera.lookAt(0, 0.2, -0.5);

  renderer.render(scene, camera);
}

export function draw(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  landmarks: Landmark[] | null,
  score: number,
  mirror: boolean,
  exerciseId?: ExerciseId,
  analysis?: FrameAnalysis,
  skipSkeleton2D = false
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (video) {
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
  } else {
    canvas.width = canvas.width || 640;
    canvas.height = canvas.height || 360;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks?.length) return;

  const defaultColor = score >= 88 ? "#10b981" : score >= 72 ? "#f59e0b" : score >= 55 ? "#f97316" : "#f43f5e";

  ctx.save();
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  // Draw target guideline HUD overlays
  if (exerciseId === "squat" && analysis) {
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    if (leftKnee && rightKnee && (leftKnee.visibility ?? 0) > 0.5 && (rightKnee.visibility ?? 0) > 0.5) {
      const avgKneeY = ((leftKnee.y + rightKnee.y) / 2) * canvas.height;
      ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, avgKneeY);
      ctx.lineTo(canvas.width, avgKneeY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(16, 185, 129, 0.45)";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("TARGET DEPTH", 15, avgKneeY - 4);
    }
  }

  if (!skipSkeleton2D) {
    // Draw HUD lines (bones) with localized color highlights based on joint metrics!
    ctx.lineWidth = 4.5;
  for (const [a, b] of POSE_CONNECTIONS) {
    const start = landmarks[a];
    const end = landmarks[b];
    if (!start || !end || (start.visibility ?? 0) < 0.4 || (end.visibility ?? 0) < 0.4) continue;

    let stroke = defaultColor;
    if (analysis && analysis.metrics.length) {
      if (exerciseId === "bicep_curl") {
        const isArm = (a === 11 && b === 13) || (a === 13 && b === 15) || (a === 12 && b === 14) || (a === 14 && b === 16);
        if (isArm) {
          const elbowPath = analysis.metrics.find((m) => m.name.includes("Elbow"))?.score ?? 100;
          const wristStack = analysis.metrics.find((m) => m.name.includes("Wrist"))?.score ?? 100;
          const minArmScore = Math.min(elbowPath, wristStack);
          stroke = minArmScore >= 85 ? "#10b981" : minArmScore >= 70 ? "#f59e0b" : "#f43f5e";
        }
        const isTorso = (a === 11 && b === 23) || (a === 12 && b === 24) || (a === 11 && b === 12);
        if (isTorso) {
          const torsoStab = analysis.metrics.find((m) => m.name.includes("Torso"))?.score ?? 100;
          stroke = torsoStab >= 85 ? "#10b981" : torsoStab >= 70 ? "#f59e0b" : "#f43f5e";
        }
      } else if (exerciseId === "squat") {
        const isLeg = (a === 23 && b === 25) || (a === 25 && b === 27) || (a === 24 && b === 26) || (a === 26 && b === 28);
        if (isLeg) {
          const depth = analysis.metrics.find((m) => m.name.includes("Depth"))?.score ?? 100;
          const kneeTrack = analysis.metrics.find((m) => m.name.includes("Knee"))?.score ?? 100;
          const minLegScore = Math.min(depth, kneeTrack);
          stroke = minLegScore >= 85 ? "#10b981" : minLegScore >= 70 ? "#f59e0b" : "#f43f5e";
        }
        const isTorso = (a === 11 && b === 23) || (a === 12 && b === 24) || (a === 11 && b === 12) || (a === 23 && b === 24);
        if (isTorso) {
          const torsoStack = analysis.metrics.find((m) => m.name.includes("Torso"))?.score ?? 100;
          stroke = torsoStack >= 85 ? "#10b981" : torsoStack >= 70 ? "#f59e0b" : "#f43f5e";
        }
      } else if (exerciseId === "pushup" || exerciseId === "plank") {
        const isBody = (a === 11 && b === 23) || (a === 23 && b === 25) || (a === 25 && b === 27) || (a === 12 && b === 24) || (a === 24 && b === 26) || (a === 26 && b === 28);
        if (isBody) {
          const bodyLine = analysis.metrics.find((m) => m.name.includes("Body"))?.score ?? 100;
          stroke = bodyLine >= 85 ? "#10b981" : bodyLine >= 70 ? "#f59e0b" : "#f43f5e";
        }
        const isArm = (a === 11 && b === 13) || (a === 13 && b === 15) || (a === 12 && b === 14) || (a === 14 && b === 16);
        if (isArm) {
          const depth = analysis.metrics.find((m) => m.name.includes("Depth"))?.score ?? 100;
          stroke = depth >= 85 ? "#10b981" : depth >= 70 ? "#f59e0b" : "#f43f5e";
        }
      } else if (exerciseId === "lunge") {
        const isLeg = (a === 23 && b === 25) || (a === 25 && b === 27) || (a === 24 && b === 26) || (a === 26 && b === 28);
        if (isLeg) {
          const frontKnee = analysis.metrics.find((m) => m.name.includes("Front"))?.score ?? 100;
          stroke = frontKnee >= 85 ? "#10b981" : frontKnee >= 70 ? "#f59e0b" : "#f43f5e";
        }
        const isTorso = (a === 11 && b === 23) || (a === 12 && b === 24) || (a === 11 && b === 12);
        if (isTorso) {
          const torso = analysis.metrics.find((m) => m.name.includes("Torso"))?.score ?? 100;
          stroke = torso >= 85 ? "#10b981" : torso >= 70 ? "#f59e0b" : "#f43f5e";
        }
      }
    }

    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
    ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
    ctx.stroke();
  }

  // Draw joints (dots) with halo glow if warning/critical
  for (const [idx, point] of landmarks.entries()) {
    if (!point || (point.visibility ?? 0) < 0.35) continue;
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 6, 0, Math.PI * 2);
    ctx.fillStyle = defaultColor;
    ctx.fill();

    if (analysis && (idx === 13 || idx === 14 || idx === 25 || idx === 26)) {
      const isElbow = idx === 13 || idx === 14;
      const isKnee = idx === 25 || idx === 26;

      if (isElbow && exerciseId === "bicep_curl") {
        const elbowPath = analysis.metrics.find((m) => m.name.includes("Elbow"))?.score ?? 100;
        if (elbowPath < 70) {
          ctx.strokeStyle = "rgba(244, 63, 94, 0.45)";
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (isKnee && exerciseId === "squat") {
        const kneeTrack = analysis.metrics.find((m) => m.name.includes("Knee"))?.score ?? 100;
        if (kneeTrack < 70) {
          ctx.strokeStyle = "rgba(244, 63, 94, 0.5)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 16, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }
  }

  // Helper to draw clean angle readouts on canvas
  function drawAngleHUD(aIdx: number, bIdx: number, cIdx: number, label: string) {
    if (!landmarks) return;
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    const c = landmarks[cIdx];
    if (a && b && c && (a.visibility ?? 0) > 0.45 && (b.visibility ?? 0) > 0.5 && (c.visibility ?? 0) > 0.45) {
      const pixel = (point: Landmark) => ({ ...point, x: point.x * (canvas?.width ?? 1280), y: point.y * (canvas?.height ?? 720) });
      const ang = angle(pixel(a), pixel(b), pixel(c));
      const bx = b.x * (canvas?.width ?? 1280);
      const by = b.y * (canvas?.height ?? 720);

      if (ctx) {
        ctx.fillStyle = "rgba(9, 9, 11, 0.72)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;

        const boxW = 54;
        const boxH = 30;
        ctx.beginPath();
        ctx.roundRect(bx - boxW / 2, by - 38, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(ang)}°`, bx, by - 24);

        ctx.fillStyle = "#a1a1aa";
        ctx.font = "bold 7px Inter, sans-serif";
        ctx.fillText(label, bx, by - 12);
      }
    }
  }

  if (exerciseId === "bicep_curl") {
    drawAngleHUD(11, 13, 15, "L ELBOW");
    drawAngleHUD(12, 14, 16, "R ELBOW");
  } else if (exerciseId === "squat") {
    drawAngleHUD(23, 25, 27, "L KNEE");
    drawAngleHUD(24, 26, 28, "R KNEE");
  } else if (exerciseId === "pushup" || exerciseId === "plank") {
    drawAngleHUD(11, 13, 15, "L ELBOW");
    drawAngleHUD(12, 14, 16, "R ELBOW");
  } else if (exerciseId === "lunge") {
    drawAngleHUD(23, 25, 27, "L KNEE");
    drawAngleHUD(24, 26, 28, "R KNEE");
  }

  ctx.restore();

  if (analysis && (analysis.injuryRisks.length || analysis.corrections.length)) {
    const textStr = (analysis.injuryRisks[0] || analysis.corrections[0]).toUpperCase();
    const isCritical = analysis.injuryRisks.length > 0;

    ctx.save();
    ctx.font = "bold 13px Inter, sans-serif";
    ctx.textAlign = "center";

    const bannerH = 34;
    const textWidth = ctx.measureText(textStr).width;
    const bannerW = Math.max(260, textWidth + 36);
    const bannerX = canvas.width / 2;
    const bannerY = canvas.height - 45;

    ctx.fillStyle = isCritical ? "rgba(244, 63, 94, 0.92)" : "rgba(245, 158, 11, 0.92)";
    ctx.shadowColor = isCritical ? "rgba(244, 63, 94, 0.45)" : "rgba(245, 158, 11, 0.45)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(bannerX - bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH, 8);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(textStr, bannerX, bannerY + 4);
    ctx.restore();
  } else if (analysis && score >= 88) {
    ctx.save();
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.textAlign = "center";
    const bannerX = canvas.width / 2;
    const bannerY = canvas.height - 40;

    ctx.fillStyle = "rgba(16, 185, 129, 0.85)";
    ctx.beginPath();
    ctx.roundRect(bannerX - 70, bannerY - 14, 140, 24, 6);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText("FORM EXCELLENT", bannerX, bannerY + 2);
    ctx.restore();
  }
}
