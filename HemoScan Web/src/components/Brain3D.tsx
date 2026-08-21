import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const Brain3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Scene, Camera, and Renderer
    const scene = new THREE.Scene();
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // 2. Generate Lobe Points (representing the two hemispheres of the brain)
    const pointsCount = 450;
    const vertices: number[] = [];
    const colors: number[] = [];

    // Helper: Map points into two lobes with sinusoidal wrinkles (gyri/sulci)
    for (let i = 0; i < pointsCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      // Ellipsoidal base shape
      const rx = 4.0;
      const ry = 3.0;
      const rz = 2.8;

      let x = rx * Math.sin(phi) * Math.cos(theta);
      let y = ry * Math.sin(phi) * Math.sin(theta);
      let z = rz * Math.cos(phi);

      // Create two distinct hemispheres (left/right separation gap)
      if (x > 0) {
        x += 0.2; // Right lobe offset
      } else {
        x -= 0.2; // Left lobe offset
      }

      // Add wrinkly texture to simulate gyri/sulci using sine/cosine waves
      const wrinkle = 0.25 * Math.sin(y * 4) * Math.cos(x * 4);
      x += wrinkle;
      y += wrinkle;
      z += wrinkle;

      vertices.push(x, y, z);

      // Gradient color palette: Violet (#8b5cf6) to Cyan (#06b6d4)
      const colorRatio = (x + rx) / (2 * rx);
      const r = THREE.MathUtils.lerp(139 / 255, 6 / 255, colorRatio);
      const g = THREE.MathUtils.lerp(92 / 255, 182 / 255, colorRatio);
      const b = THREE.MathUtils.lerp(246 / 255, 212 / 255, colorRatio);
      colors.push(r, g, b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // 3. Create Points Mesh
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const brainPoints = new THREE.Points(geometry, pointsMaterial);
    scene.add(brainPoints);

    // 4. Create Interconnecting Network Lines (Neural paths)
    const lineIndices: number[] = [];
    const maxDistance = 2.4; // max distance for node connection

    const positionAttribute = geometry.getAttribute('position');
    for (let i = 0; i < pointsCount; i++) {
      const x1 = positionAttribute.getX(i);
      const y1 = positionAttribute.getY(i);
      const z1 = positionAttribute.getZ(i);

      for (let j = i + 1; j < pointsCount; j++) {
        // Do not connect left lobe with right lobe nodes directly to keep division clear
        const x2 = positionAttribute.getX(j);
        if ((x1 > 0 && x2 < 0) || (x1 < 0 && x2 > 0)) continue;

        const y2 = positionAttribute.getY(j);
        const z2 = positionAttribute.getZ(j);

        const dist = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2);
        if (dist < maxDistance) {
          lineIndices.push(i, j);
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', positionAttribute);
    lineGeometry.setIndex(lineIndices);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });

    const brainLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(brainLines);

    // 5. User Interaction Variables
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      // Normalize coordinate offsets [-1.0, 1.0]
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 6. Handle Window Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // 7. Animation Loop
    let animationFrameId = 0;

    const animate = () => {
      // Steady autonomous rotation
      brainPoints.rotation.y += 0.003;
      brainLines.rotation.y += 0.003;
      
      // Smooth interpolation rotation tracking the cursor
      targetRotationY = mouseX * 0.45;
      targetRotationX = -mouseY * 0.45;

      brainPoints.rotation.y += (targetRotationY - brainPoints.rotation.y) * 0.05;
      brainPoints.rotation.x += (targetRotationX - brainPoints.rotation.x) * 0.05;

      brainLines.rotation.y += (targetRotationY - brainLines.rotation.y) * 0.05;
      brainLines.rotation.x += (targetRotationX - brainLines.rotation.x) * 0.05;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // 8. Lifecycle cleanup (Disposes memory & prevents crashes)
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if (containerRef.current && renderer.domElement) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        containerRef.current.removeChild(renderer.domElement);
      }
      
      geometry.dispose();
      lineGeometry.dispose();
      pointsMaterial.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex: 0, 
        pointerEvents: 'none',
        overflow: 'hidden'
      }} 
    />
  );
};
export default Brain3D;
