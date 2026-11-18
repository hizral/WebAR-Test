import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';

class WebARController {
  constructor() {
    this.mindarThree = null;
    this.anchors = [];
    this.isRunning = false;
    this.unityObjectName = "WebARManager";

    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
  }

  async init(targetSrc = "StreamingAssets/targets.mind", maxTrack = 1) {
    if (this.isRunning) return;

    const container = document.querySelector("#ar-container");

    this.mindarThree = new MindARThree({
      container: container,
      imageTargetSrc: targetSrc,
      maxTrack: maxTrack,
      uiLoading: "no",
      uiScanning: "no",
      uiError: "no",
      filterMinCF: 0.0001,
      filterBeta: 0.001
    });

    const { renderer, scene, camera } = this.mindarThree;

    for (let i = 0; i < maxTrack; i++) {
      const anchor = this.mindarThree.addAnchor(i);

      anchor.onTargetFound = () => {
        this.sendToUnity("OnTargetFound", i.toString());
      };

      anchor.onTargetLost = () => {
        this.sendToUnity("OnTargetLost", i.toString());
      };

      this.anchors.push(anchor);
    }

    try {
      await this.mindarThree.start();
      this.isRunning = true;
      this.sendToUnity("OnARReady", this.getCameraFOV().toString());

      renderer.setAnimationLoop(() => {
        this.updateTracking();
      });
    } catch (error) {
      console.error("MindAR Start Failed:", error);
      this.sendToUnity("OnARError", error.message || "Camera access denied");
    }
  }

  getCameraFOV() {
    if (!this.mindarThree || !this.mindarThree.camera) return 60;
    return this.mindarThree.camera.fov;
  }

  updateTracking() {
    if (!this.isRunning || !window.unityInstance) return;

    for (let i = 0; i < this.anchors.length; i++) {
      const anchor = this.anchors[i];
      if (!anchor.group.visible) continue;

      anchor.group.updateMatrixWorld(true);
      anchor.group.matrixWorld.decompose(this.pos, this.quat, this.scale);

      const ux = this.pos.x;
      const uy = this.pos.y;
      const uz = -this.pos.z;

      const qx = -this.quat.x;
      const qy = -this.quat.y;
      const qz = this.quat.z;
      const qw = this.quat.w;

      const sx = this.scale.x;
      const sy = this.scale.y;
      const sz = this.scale.z;

      const payload = `${i},${ux.toFixed(5)},${uy.toFixed(5)},${uz.toFixed(5)},${qx.toFixed(5)},${qy.toFixed(5)},${qz.toFixed(5)},${qw.toFixed(5)},${sx.toFixed(5)},${sy.toFixed(5)},${sz.toFixed(5)}`;
      this.sendToUnity("OnTargetPoseUpdated", payload);
    }
  }

  stop() {
    if (!this.isRunning || !this.mindarThree) return;
    this.mindarThree.stop();
    this.mindarThree.renderer.setAnimationLoop(null);
    this.isRunning = false;
  }

  sendToUnity(methodName, payload) {
    if (window.unityInstance) {
      window.unityInstance.SendMessage(this.unityObjectName, methodName, payload);
    }
  }
}

window.WebARController = new WebARController();
